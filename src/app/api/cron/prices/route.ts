import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { secretsMatch } from '@/lib/security'
import { fxPairsNeeded, fxTickers } from '@/lib/prices/fx'
import { createGoogleSheetsProvider } from '@/lib/prices/googleSheets'
import { resolveAssetQuote } from '@/lib/prices/resolveQuote'
import type { PriceProvider } from '@/lib/prices/types'
import { yahooProvider } from '@/lib/prices/yahoo'
import type { Database } from '@/types/database'

// POST /api/cron/prices
// Job schedulato (vedi .github/workflows/cron-prices.yml): per ogni asset con
// un ticker Google Finance risolto, legge il prezzo dal Sheet ponte; se la
// cella è #N/A o il foglio è stantio (>2h), usa yahoo-finance2 come fallback.
// Nello stesso giro aggiorna i cambi valuta (fx_rates) usati dal riepilogo per
// rendere omogenei i totali. Scrive con la service role key (bypassa RLS),
// stesso pattern di /api/notifications/process.
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || !authHeader || !secretsMatch(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Le env vanno verificate prima di creare il client: con una chiave mancante
  // createClient non protesta, ma ogni query fallisce in silenzio e il job
  // sembrerebbe girare a vuoto su un portafoglio vuoto.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    const missing = [
      !supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
      !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
    ].filter(Boolean)
    return NextResponse.json(
      { error: `Configurazione incompleta: ${missing.join(', ')} non impostata/e nell'ambiente` },
      { status: 500 }
    )
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey)

  const { data: allAssets, error: assetsError } = await supabase
    .from('assets')
    .select('id, ticker_gf, ticker_yahoo, currency')

  // Una lettura fallita non è un portafoglio vuoto: senza questo controllo un
  // errore di credenziali o di rete uscirebbe come { ok: true, updated: 0 },
  // indistinguibile da un giro andato a buon fine con niente da aggiornare.
  if (assetsError) {
    return NextResponse.json(
      { error: `Lettura degli asset fallita: ${assetsError.message}` },
      { status: 500 }
    )
  }

  // Basta uno dei due ticker: un asset con il solo ticker Yahoo (ticker dedotto
  // dal CSV, o mercato non coperto dal Sheet ponte) deve comunque ricevere il
  // prezzo dal fallback.
  const assets = (allAssets ?? []).filter((a) => a.ticker_gf || a.ticker_yahoo)

  // Portafoglio davvero senza asset quotabili: `total` distingue questo caso da
  // un errore, e `assets_total` dice se il problema è che mancano i ticker.
  if (!assets.length) {
    return NextResponse.json({
      ok: true,
      updated: 0,
      total: 0,
      assets_total: (allAssets ?? []).length,
    })
  }

  let sheetsProvider: PriceProvider | null = null
  let sheetError: string | null = null
  try {
    sheetsProvider = await createGoogleSheetsProvider()
  } catch (e) {
    // Sheet ponte non configurato (env mancanti) o Sheets API non raggiungibile:
    // si prosegue con il solo fallback Yahoo per tutti gli asset. Il motivo entra
    // nella risposta: sapere su quale delle due sorgenti si sta contando è la
    // prima cosa da guardare quando non arriva nessun prezzo.
    sheetsProvider = null
    sheetError = e instanceof Error ? e.message : String(e)
  }

  let fxUpdated = { updated: 0, total: 0 }
  let fxError: string | null = null
  try {
    fxUpdated = await refreshFxRates(supabase, allAssets, sheetsProvider)
  } catch (e) {
    // I cambi non devono far saltare i prezzi: si riportano nella risposta e il
    // giro prosegue, così un portafoglio in euro resta aggiornato comunque.
    fxError = e instanceof Error ? e.message : String(e)
  }


  const snapshots: Database['public']['Tables']['price_snapshots']['Insert'][] = []
  for (const asset of assets) {
    const quote = await resolveAssetQuote(asset.ticker_gf, asset.ticker_yahoo, sheetsProvider, yahooProvider)
    if (!quote) continue
    snapshots.push({
      asset_id: asset.id,
      price: quote.price,
      change_pct: quote.changePct,
      currency: quote.currency,
      source: quote.source,
    })
  }

  if (snapshots.length > 0) {
    const { error } = await supabase.from('price_snapshots').insert(snapshots)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    updated: snapshots.length,
    total: assets.length,
    fx_updated: fxUpdated.updated,
    fx_total: fxUpdated.total,
    price_source: sheetsProvider ? 'gsheet+yahoo' : 'yahoo',
    ...(sheetError ? { sheet_error: sheetError } : {}),
    ...(fxError ? { fx_error: fxError } : {}),
  })
}

// Aggiorna i cambi per ogni coppia (valuta presente in portafoglio → valuta di
// riferimento di un utente), sulle stesse due sorgenti dei prezzi. `fx_rates`
// tiene una riga per coppia aggiornata in place: serve l'ultimo cambio noto,
// non la serie storica. Se una coppia non si risolve si lascia il valore
// precedente: un cambio vecchio di qualche ora è comunque più corretto che
// sommare dollari a euro.
async function refreshFxRates(
  supabase: SupabaseClient<Database>,
  assets: { currency: string }[],
  sheetsProvider: PriceProvider | null
): Promise<{ updated: number; total: number }> {
  const { data: settingsRows, error: settingsError } = await supabase.from('settings').select('currency')
  if (settingsError) throw new Error(`Lettura delle valute di conto fallita: ${settingsError.message}`)

  const pairs = fxPairsNeeded(
    assets.map((a) => a.currency),
    (settingsRows ?? []).map((s) => s.currency)
  )
  if (!pairs.length) return { updated: 0, total: 0 }

  const rows: Database['public']['Tables']['fx_rates']['Insert'][] = []
  for (const pair of pairs) {
    const { tickerGf, tickerYahoo } = fxTickers(pair)
    const quote = await resolveAssetQuote(tickerGf, tickerYahoo, sheetsProvider, yahooProvider)
    if (!quote || !(quote.price > 0)) continue
    rows.push({
      base: pair.base,
      quote: pair.quote,
      rate: quote.price,
      source: quote.source,
      fetched_at: new Date().toISOString(),
    })
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('fx_rates').upsert(rows, { onConflict: 'base,quote' })
    // Tipicamente: migrazione fx non ancora applicata. Vale la pena dirlo — senza
    // cambi il riepilogo lascia le posizioni in valuta estera fuori dai totali.
    if (error) throw new Error(`Scrittura dei cambi fallita: ${error.message}`)
  }
  return { updated: rows.length, total: pairs.length }
}
