import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { decodeCsvBuffer, detectNonCsvFormat, parseFinecoCsv } from '@/lib/investments/parseFinecoCsv'
import { isKnownMarket, resolveTickerFromCsv } from '@/lib/investments/resolveTicker'
import type { Database } from '@/types/database'
import type { AssetClass, ImportDiff } from '@/types/investments'

const DEFAULT_ASSET_CLASS: AssetClass = 'other'

// Classe dedotta dalla colonna "Strumento" del CSV, solo quando è inequivocabile:
// "ETF" non dice se è azionario o obbligazionario, quindi resta al lookup.
function classifyFromInstrumentType(instrumentType: string | undefined, percentQuoted: boolean): AssetClass | null {
  if (percentQuoted) return 'bond'
  const t = instrumentType?.toLowerCase() ?? ''
  if (!t) return null
  if (/\betf\b|\betc\b|\betn\b/.test(t)) return null
  if (t.includes('azion') || t.includes('stock') || t.includes('equity')) return 'stock'
  return null
}
const MAX_CSV_BYTES = 5 * 1024 * 1024

// POST /api/investments/import
// Riceve il CSV export Fineco (Patrimonio -> Portafoglio titoli) come
// multipart/form-data (campo "file"), risolve gli ISIN via isin_ticker_lookup
// e sostituisce integralmente le holdings dell'utente (snapshot, non delta).
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  let csvText: string
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'File CSV mancante' }, { status: 400 })
    }
    if (file.size > MAX_CSV_BYTES) {
      return NextResponse.json({ error: 'Il file supera i 5 MB: non sembra un export di portafoglio.' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    // Il file va letto come byte, non come testo: Fineco esporta in Windows-1252
    // e Blob.text() lo forza a UTF-8 corrompendo gli header accentati.
    const formatError = detectNonCsvFormat(buffer)
    if (formatError) return NextResponse.json({ error: formatError }, { status: 400 })
    csvText = decodeCsvBuffer(buffer)
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida: impossibile leggere il file caricato.' }, { status: 400 })
  }

  let parsedRows: ReturnType<typeof parseFinecoCsv>['rows']
  let warnings: string[]
  let detectedColumns: string[]
  try {
    const result = parseFinecoCsv(csvText)
    parsedRows = result.rows
    warnings = result.warnings
    detectedColumns = result.detectedColumns
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'CSV non valido' }, { status: 400 })
  }

  if (parsedRows.length === 0) {
    // Intestazione riconosciuta ma zero righe: è il caso dell'export scaricato
    // senza posizioni aperte, non un problema di formato del file.
    const detail = warnings.length > 0
      ? ` Dettaglio: ${warnings.join(' ')}`
      : detectedColumns.length > 0
        ? ' Il file contiene solo l\'intestazione: riesporta il portafoglio con le posizioni aperte.'
        : ''
    return NextResponse.json({ error: `Nessuna posizione valida trovata nel CSV.${detail}` }, { status: 400 })
  }

  try {
    // Stato precedente (per il diff), prima di sostituire le holdings.
    const [{ data: existingAssets }, { data: existingHoldings }] = await Promise.all([
      supabase.from('assets').select('id, isin, ticker_gf, ticker_yahoo, name, asset_class, currency').eq('user_id', user.id),
      supabase.from('holdings').select('asset_id, quantity, avg_cost').eq('user_id', user.id),
    ])
    const existingByIsin = new Map((existingAssets ?? []).map((a) => [a.isin, a]))
    const assetIdToIsin = new Map((existingAssets ?? []).map((a) => [a.id, a.isin]))
    const beforeByIsin = new Map(
      (existingHoldings ?? [])
        .map((h) => {
          const isin = assetIdToIsin.get(h.asset_id)
          return isin ? [isin, { quantity: Number(h.quantity), avg_cost: Number(h.avg_cost) }] as const : null
        })
        .filter((x): x is [string, { quantity: number; avg_cost: number }] => x !== null)
    )

    // Risoluzione ticker: consulta la tabella di lookup globale, mai inventare un ticker.
    const isins = parsedRows.map((r) => r.isin)
    const { data: lookupRows } = await supabase
      .from('isin_ticker_lookup')
      .select('isin, ticker_gf, ticker_yahoo, name, asset_class')
      .in('isin', isins)
    const lookupByIsin = new Map((lookupRows ?? []).map((l) => [l.isin, l]))

    const unmappedIsins: string[] = []
    const derivedTickers: { isin: string; ticker_gf: string }[] = []
    const unknownMarkets = new Set<string>()

    const assetsToUpsert = parsedRows.map((row) => {
      const lookup = lookupByIsin.get(row.isin)
      const existing = existingByIsin.get(row.isin)
      const percentQuoted = row.price_divisor !== 1

      // Ordine di risoluzione del ticker: tabella di lookup (autorevole e
      // manutenuta a mano) -> derivazione da Simbolo + Mercato del CSV ->
      // valore già presente sull'asset. Un ticker/classe impostati in
      // precedenza non vengono mai sovrascritti con un valore vuoto.
      const derived = lookup?.ticker_gf ? null : resolveTickerFromCsv(row.symbol, row.market, { percentQuoted })
      const tickerGf = lookup?.ticker_gf || derived?.ticker_gf || existing?.ticker_gf || ''
      if (derived?.ticker_gf && !existing?.ticker_gf) {
        derivedTickers.push({ isin: row.isin, ticker_gf: derived.ticker_gf })
      }
      if (!tickerGf) {
        unmappedIsins.push(row.isin)
        if (!percentQuoted && row.market && !isKnownMarket(row.market)) unknownMarkets.add(row.market)
      }

      return {
        user_id: user.id,
        isin: row.isin,
        ticker_gf: tickerGf,
        ticker_yahoo: lookup?.ticker_yahoo || derived?.ticker_yahoo || existing?.ticker_yahoo || null,
        name: lookup?.name || row.name || existing?.name || row.isin,
        asset_class: (lookup?.asset_class as AssetClass | null)
          ?? classifyFromInstrumentType(row.instrument_type, percentQuoted)
          ?? (existing?.asset_class as AssetClass | null)
          ?? DEFAULT_ASSET_CLASS,
        // La valuta arriva dal CSV: un titolo in USD lasciato a EUR falserebbe
        // il controvalore mostrato accanto alla posizione.
        currency: row.currency || existing?.currency || 'EUR',
        // Fattore di quotazione rilevato sul CSV: senza, le obbligazioni
        // verrebbero valorizzate 100 volte il loro controvalore reale.
        price_divisor: row.price_divisor,
      }
    })

    const { data: upsertedAssets, error: upsertError } = await supabase
      .from('assets')
      .upsert(assetsToUpsert, { onConflict: 'user_id,isin' })
      .select('id, isin')
    if (upsertError) {
      return NextResponse.json({ error: `Errore salvataggio asset: ${upsertError.message}` }, { status: 500 })
    }
    const assetIdByIsin = new Map((upsertedAssets ?? []).map((a) => [a.isin, a.id]))

    const { error: deleteError } = await supabase.from('holdings').delete().eq('user_id', user.id)
    if (deleteError) {
      return NextResponse.json({ error: `Errore sostituzione holdings: ${deleteError.message}` }, { status: 500 })
    }

    const holdingsToInsert = parsedRows
      .map((row) => {
        const assetId = assetIdByIsin.get(row.isin)
        if (!assetId) return null
        return {
          user_id: user.id,
          asset_id: assetId,
          quantity: row.quantity,
          avg_cost: row.avg_cost,
          source: 'fineco_csv',
          imported_at: new Date().toISOString(),
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    const { error: insertError } = await supabase.from('holdings').insert(holdingsToInsert)
    if (insertError) {
      return NextResponse.json({ error: `Errore inserimento holdings: ${insertError.message}` }, { status: 500 })
    }

    const afterIsins = new Set(parsedRows.map((r) => r.isin))
    const diff: ImportDiff = {
      imported_positions: holdingsToInsert.length,
      new_positions: parsedRows.filter((r) => !beforeByIsin.has(r.isin)).length,
      changed_positions: parsedRows.filter((r) => {
        const before = beforeByIsin.get(r.isin)
        return before && (before.quantity !== r.quantity || before.avg_cost !== r.avg_cost)
      }).length,
      removed_positions: [...beforeByIsin.keys()].filter((isin) => !afterIsins.has(isin)).length,
      unmapped_isins: unmappedIsins,
      derived_tickers: derivedTickers,
      unknown_markets: [...unknownMarkets],
      percent_quoted_positions: parsedRows.filter((r) => r.price_divisor !== 1).length,
    }

    return NextResponse.json({ diff, warnings })
  } catch (err) {
    // Qualunque eccezione imprevista deve tornare comunque come JSON: il client
    // legge sempre res.json() e un errore HTML lo lascerebbe senza messaggio.
    const message = err instanceof Error ? err.message : 'Errore imprevisto durante l\'import'
    return NextResponse.json({ error: `Errore durante l'import: ${message}` }, { status: 500 })
  }
}
