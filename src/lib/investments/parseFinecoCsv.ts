import Papa from 'papaparse'

export interface ParsedHoldingRow {
  isin: string
  name: string
  quantity: number
  avg_cost: number
  /** Valuta di denominazione del titolo, quando l'export la espone. */
  currency?: string
  /** Simbolo di borsa dal CSV (colonna "Simbolo"). */
  symbol?: string
  /** Mercato di quotazione dal CSV (colonna "Mercato"). */
  market?: string
  /** Tipo strumento dal CSV (colonna "Strumento"): ETF, Azioni, Obbligazioni... */
  instrument_type?: string
  /**
   * Fattore di quotazione: 1 per azioni/ETF, 100 per i titoli quotati in
   * percentuale del nominale (obbligazioni). Controvalore = quantità * prezzo /
   * price_divisor.
   */
  price_divisor: number
}

export interface ParseFinecoResult {
  rows: ParsedHoldingRow[]
  warnings: string[]
  /** Header effettivamente riconosciuto: usato nei messaggi d'errore per capire cosa ha letto il parser. */
  detectedColumns: string[]
}

// 2 lettere (country code) + 10 alfanumerici. Volutamente più permissiva del
// check digit ISO 6166: un export con un codice interno non deve far saltare la riga.
const ISIN_RE = /\b[A-Z]{2}[A-Z0-9]{10}\b/
const DELIMITERS = [';', ',', '\t', '|']
const MAX_HEADER_SCAN_ROWS = 25

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// ---------------------------------------------------------------------------
// Decodifica
// ---------------------------------------------------------------------------

/**
 * Fineco esporta in Windows-1252 (non UTF-8): decodificare a occhi chiusi come
 * UTF-8 rompe "Quantità" -> "Quantit�" e l'header non viene più
 * riconosciuto. Si prova UTF-8 e, se compaiono caratteri di sostituzione, si
 * ricade su Windows-1252.
 */
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)

  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)

  const utf8 = new TextDecoder('utf-8').decode(bytes)
  if (!utf8.includes('�')) return utf8

  try {
    return new TextDecoder('windows-1252').decode(bytes)
  } catch {
    return utf8
  }
}

/**
 * Riconosce i file che non sono CSV di testo (xlsx/xls/pdf/HTML): senza questo
 * controllo l'utente riceve un generico "colonne mancanti" e non capisce che il
 * problema è il formato del file scaricato.
 */
export function detectNonCsvFormat(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer)
  if (bytes.length === 0) return 'Il file è vuoto.'

  const startsWith = (sig: number[]) => sig.every((b, i) => bytes[i] === b)
  if (startsWith([0x50, 0x4b, 0x03, 0x04])) {
    return 'Il file è un foglio Excel (.xlsx), non un CSV. Aprilo e salvalo come "CSV (delimitato da separatore di elenco)", poi ricaricalo.'
  }
  if (startsWith([0xd0, 0xcf, 0x11, 0xe0])) {
    return 'Il file è un foglio Excel (.xls), non un CSV. Aprilo e salvalo come "CSV (delimitato da separatore di elenco)", poi ricaricalo.'
  }
  if (startsWith([0x25, 0x50, 0x44, 0x46])) {
    return 'Il file è un PDF, non un CSV. Da Fineco scegli l\'export in formato CSV/Excel.'
  }

  const head = new TextDecoder('utf-8').decode(bytes.slice(0, 512)).trim().toLowerCase()
  if (head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<table')) {
    return 'Il file è una pagina HTML, non un CSV. Riscarica l\'export dal menu "Esporta" di Fineco.'
  }
  return null
}

// ---------------------------------------------------------------------------
// Numeri
// ---------------------------------------------------------------------------

/**
 * Parsa un importo senza dare per scontata la convenzione italiana: separatore
 * decimale dedotto dall'ultimo separatore presente ("1.234,56" -> 1234.56,
 * "1,234.56" -> 1234.56). Con soli punti si distingue migliaia da decimali
 * dalla lunghezza dei gruppi ("1.234" -> 1234, "95.32" -> 95.32).
 */
export function parseAmount(raw: string | undefined | null): number {
  if (raw === undefined || raw === null) return NaN
  const original = raw.replace(/ /g, ' ').trim()
  if (!original) return NaN
  if (/^(n\.?\s?d\.?|n\/a|-{1,2}|\.{3})$/i.test(original)) return NaN

  const negative = /^\(.*\)$/.test(original) || /-/.test(original)
  const cleaned = original.replace(/[^0-9.,]/g, '')
  if (!cleaned || !/[0-9]/.test(cleaned)) return NaN

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let normalized: string

  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  } else if (lastComma >= 0) {
    // Solo virgole: in un export italiano la virgola è il decimale. Più virgole
    // possono essere solo separatori di migliaia.
    const parts = cleaned.split(',')
    normalized = parts.length > 2 ? parts.join('') : `${parts[0]}.${parts[1]}`
  } else if (lastDot >= 0) {
    const parts = cleaned.split('.')
    const groupsAreThousands = parts.slice(1).every((p) => p.length === 3)
    normalized = groupsAreThousands && parts.length > 1 ? parts.join('') : cleaned
  } else {
    normalized = cleaned
  }

  const value = parseFloat(normalized)
  if (isNaN(value)) return NaN
  return negative ? -Math.abs(value) : value
}

// ---------------------------------------------------------------------------
// Riconoscimento colonne
// ---------------------------------------------------------------------------

function isIsinHeader(h: string): boolean {
  return h === 'isin' || h.includes('isin')
}

function isQuantityHeader(h: string): boolean {
  if (h.includes('controvalore') || h.includes('valore')) return false
  if (h.startsWith('quantit')) return true
  return ['qta', 'q_ta', 'qty', 'quantity', 'pezzi', 'quote', 'n_quote', 'numero_quote', 'nominale', 'n_azioni'].includes(h)
}

function isAvgCostHeader(h: string): boolean {
  if (h.includes('controvalore') || h.includes('valore') || h.includes('importo') || h.includes('totale')) return false
  if (['pmc', 'prezzo_medio', 'prezzo_di_carico', 'prezzo_carico', 'costo_medio', 'carico_medio', 'avg_cost'].includes(h)) return true
  // "P.zo medio di carico" è il nome usato dall'export Fineco: normalizzato
  // diventa "p_zo_medio_di_carico", quindi né "prezzo" né "prz" lo intercettano.
  const isPrice = h.includes('prezzo') || h.startsWith('prz') || h.startsWith('p_zo') || h.startsWith('pzo')
    || h.includes('costo') || h.includes('pmc') || h.includes('price')
  const isCarico = h.includes('carico') || h.includes('medio')
  return isPrice && isCarico
}

// "Valore di carico" / "Controvalore di carico": fallback per ricavare il
// prezzo medio quando l'export non espone il PMC ma solo il costo totale.
function isCostValueHeader(h: string): boolean {
  const isValue = h.includes('controvalore') || h.includes('valore') || h.includes('importo') || h.includes('costo')
  return isValue && h.includes('carico')
}

// Nome descrittivo prima del simbolo: "Descrizione" è più utile di "Simbolo"
// quando l'export espone entrambe le colonne.
// Nell'export Fineco "Strumento" è il tipo (ETF/Azioni/Fondo), non il nome:
// va cercato solo se non c'è una colonna descrittiva vera.
const NAME_KEYS_BY_PRIORITY = [
  ['descrizione', 'denominazione', 'titolo', 'prodotto', 'nome', 'name'],
  ['strumento'],
  ['simbolo', 'ticker', 'codice_strumento'],
]

function findNameColumn(headers: string[]): number {
  for (const keys of NAME_KEYS_BY_PRIORITY) {
    const index = headers.findIndex((h) => h && keys.some((k) => h === k || h.includes(k)))
    if (index >= 0) return index
  }
  return -1
}

function isSymbolHeader(h: string): boolean {
  return ['simbolo', 'ticker', 'sigla', 'symbol'].includes(h)
}

function isMarketHeader(h: string): boolean {
  return ['mercato', 'borsa', 'market', 'exchange'].includes(h)
}

function isInstrumentTypeHeader(h: string): boolean {
  return ['strumento', 'tipo', 'tipologia', 'tipo_strumento', 'categoria'].includes(h)
}

function isFxRateHeader(h: string): boolean {
  return h.includes('cambio') && !h.includes('mercato')
}

function normalizeCurrency(raw: string | undefined): string | undefined {
  const code = raw?.trim().toUpperCase()
  return code && /^[A-Z]{3}$/.test(code) ? code : undefined
}

function isCurrencyHeader(h: string): boolean {
  return ['valuta', 'divisa', 'currency', 'ccy'].includes(h)
}

interface ColumnMap {
  isin: number
  quantity: number
  avgCost: number
  costValue: number
  name: number
  currency: number
  symbol: number
  market: number
  instrumentType: number
  fxRate: number
}

function mapColumns(headers: string[]): ColumnMap {
  const find = (pred: (h: string) => boolean) => headers.findIndex((h) => h && pred(h))
  return {
    isin: find(isIsinHeader),
    quantity: find(isQuantityHeader),
    avgCost: find(isAvgCostHeader),
    costValue: find(isCostValueHeader),
    name: findNameColumn(headers),
    currency: find(isCurrencyHeader),
    symbol: find(isSymbolHeader),
    market: find(isMarketHeader),
    instrumentType: find(isInstrumentTypeHeader),
    fxRate: find(isFxRateHeader),
  }
}

function mapScore(map: ColumnMap): number {
  return [map.isin, map.quantity, map.avgCost, map.costValue, map.name, map.currency, map.symbol, map.market]
    .filter((i) => i >= 0).length
}

// ---------------------------------------------------------------------------
// Fattore di quotazione (obbligazioni)
// ---------------------------------------------------------------------------

const PERCENT_QUOTED_KEYWORDS = ['obblig', 'bond', 'titoli di stato', 'titolo di stato', 'governat', 'btp', 'bot', 'cct', 'ctz']
const CANDIDATE_DIVISORS = [1, 100]
const DIVISOR_TOLERANCE = 0.01

/**
 * Un ETF obbligazionario quota in euro per quota, non in percentuale: la parola
 * "bond"/"obbligazionario" nel nome o nel tipo non basta a farne un titolo
 * quotato in percentuale. "UCITS" è il marcatore più affidabile sui fondi
 * europei, dove non sempre compare la sigla ETF.
 */
export function isFundLike(text: string | undefined): boolean {
  if (!text) return false
  return /\betf\b|\betc\b|\betn\b|\bucits\b|\bsicav\b|\bfondo\b/i.test(text)
}

// I titoli di Stato non sempre hanno un tipo strumento utilizzabile, ma il nome
// Fineco è riconoscibile: "BTP-1FB33 5,75", "GREECE-30GE28 3,75", "BUND...".
const GOVERNMENT_BOND_NAME_RE = /^(btp|bot|cct|ctz|bund|oat|bonos|gilt|treasury|greece|italy|spain|portugal|france|germany)\b|^(btp|greece)-/i

export function isPercentQuotedType(instrumentType: string | undefined, name?: string): boolean {
  const haystack = [instrumentType, name].filter(Boolean).join(' ')
  if (!haystack) return false
  if (isFundLike(haystack)) return false

  const t = instrumentType?.toLowerCase() ?? ''
  if (PERCENT_QUOTED_KEYWORDS.some((k) => t.includes(k))) return true

  // Ripiego sul nome: usato solo quando il confronto numerico con il valore di
  // carico non ha potuto decidere.
  return !!name && GOVERNMENT_BOND_NAME_RE.test(name.trim())
}

/**
 * Le obbligazioni quotano in percentuale del nominale: Fineco riporta la
 * quantità come nominale (10.000) e il prezzo come percentuale (98,50), quindi
 * il controvalore è quantità * prezzo / 100.
 *
 * Il fattore non viene indovinato dal nome dello strumento ma **verificato sul
 * file**: `Valore di carico` è il controvalore già calcolato da Fineco, quindi
 * si prova quale divisore lo riproduce. Il cambio viene provato in entrambe le
 * direzioni perché la convenzione della colonna non è dichiarata nell'export.
 * Il tipo strumento resta come ripiego se il confronto non è possibile.
 */
export function detectPriceDivisor(
  quantity: number,
  avgCost: number,
  costValue: number,
  fxRate: number,
  instrumentType: string | undefined,
  name?: string
): number {
  const fxFactors = [1, ...(!isNaN(fxRate) && fxRate > 0 ? [fxRate, 1 / fxRate] : [])]

  if (!isNaN(costValue) && costValue !== 0) {
    for (const divisor of CANDIDATE_DIVISORS) {
      for (const fx of fxFactors) {
        const expected = (quantity * avgCost / divisor) * fx
        if (Math.abs(expected - costValue) <= DIVISOR_TOLERANCE * Math.abs(costValue)) return divisor
      }
    }
  }

  return isPercentQuotedType(instrumentType, name) ? 100 : 1
}

// ---------------------------------------------------------------------------
// Griglia CSV
// ---------------------------------------------------------------------------

function parseWithDelimiter(text: string, delimiter: string): string[][] {
  const result = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: 'greedy' })
  return (result.data ?? []).filter((r) => Array.isArray(r))
}

/**
 * Il separatore non è dichiarato e l'auto-detect di papaparse sbaglia quando il
 * file ha righe di intestazione libere prima della tabella: si prova ogni
 * separatore e vince quello che produce più colonne in modo consistente.
 */
function parseGrid(text: string): string[][] {
  let best: string[][] = []
  let bestScore = -1

  for (const delimiter of DELIMITERS) {
    const grid = parseWithDelimiter(text, delimiter)
    const widths = grid.map((r) => r.length)
    const maxWidth = widths.length > 0 ? Math.max(...widths) : 0
    if (maxWidth < 2) continue
    // Righe che raggiungono la larghezza massima: premia i separatori che
    // producono una tabella regolare invece di split casuali.
    const consistent = widths.filter((w) => w === maxWidth).length
    const score = maxWidth * 1000 + consistent
    if (score > bestScore) {
      bestScore = score
      best = grid
    }
  }

  return best.length > 0 ? best : parseWithDelimiter(text, ';')
}

interface HeaderDetection {
  index: number
  headers: string[]
  map: ColumnMap
}

function detectHeader(grid: string[][]): HeaderDetection | null {
  let best: HeaderDetection | null = null

  const limit = Math.min(grid.length, MAX_HEADER_SCAN_ROWS)
  for (let i = 0; i < limit; i++) {
    const headers = grid[i].map(normalizeHeader)
    const nonEmpty = headers.filter(Boolean).length
    if (nonEmpty < 2) continue
    const map = mapColumns(headers)
    const score = mapScore(map)
    if (score === 0) continue
    if (!best || score > mapScore(best.map)) {
      best = { index: i, headers, map }
    }
    // Header completo: inutile continuare a scandire.
    if (map.isin >= 0 && map.quantity >= 0 && (map.avgCost >= 0 || map.costValue >= 0)) break
  }

  return best
}

function extractIsin(cell: string | undefined): string | null {
  if (!cell) return null
  const upper = cell.toUpperCase()
  const match = upper.match(ISIN_RE) ?? upper.replace(/\s+/g, '').match(ISIN_RE)
  return match ? match[0] : null
}

/** Se l'header non espone una colonna ISIN, la si cerca nei dati per contenuto. */
function detectIsinColumn(dataRows: string[][], columnCount: number): number {
  let bestIndex = -1
  let bestHits = 0
  for (let c = 0; c < columnCount; c++) {
    let hits = 0
    let filled = 0
    for (const row of dataRows) {
      const cell = row[c]?.trim()
      if (!cell) continue
      filled++
      if (extractIsin(cell)) hits++
    }
    if (filled > 0 && hits > filled / 2 && hits > bestHits) {
      bestHits = hits
      bestIndex = c
    }
  }
  return bestIndex
}

function isSummaryRow(row: string[]): boolean {
  const first = (row[0] ?? '').trim().toLowerCase()
  return first.startsWith('totale') || first.startsWith('totali') || first.startsWith('total ')
}

// ---------------------------------------------------------------------------
// Parser principale
// ---------------------------------------------------------------------------

/**
 * Parsa l'export del portafoglio titoli Fineco.
 *
 * Nessuna assunzione rigida sul file: separatore, riga di header (può essere
 * preceduta da righe di intestazione libere) e nomi delle colonne vengono
 * rilevati. Le colonne sono riconosciute per significato ("Prz. Medio Carico",
 * "Prezzo medio di carico", "PMC"...) e l'ISIN, se non c'è una colonna
 * dedicata, viene cercato per pattern nei dati. Le righe non interpretabili
 * vengono scartate come warning senza far fallire l'intero import; le posizioni
 * ripetute sullo stesso ISIN vengono aggregate a media ponderata (l'export
 * Fineco può elencare lo stesso titolo su più mercati).
 */
export function parseFinecoCsv(csvText: string): ParseFinecoResult {
  // Line ending normalizzati: papaparse deduce il terminatore dalle prime righe
  // e un file con \r\n misto a \n gli fa collassare la coda in un'unica riga.
  const text = csvText.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim()
  if (!text) {
    throw new Error('Il file CSV è vuoto.')
  }

  const grid = parseGrid(text)
  const detection = detectHeader(grid)
  const headers = detection?.headers ?? []
  const detectedColumns = (detection ? grid[detection.index] : []).map((h) => h.trim()).filter(Boolean)

  const dataRows = (detection ? grid.slice(detection.index + 1) : grid)
    .filter((row) => row.some((cell) => cell?.trim()))
    .filter((row) => !isSummaryRow(row))

  const columnCount = Math.max(headers.length, ...dataRows.map((r) => r.length), 0)
  const map: ColumnMap = detection?.map
    ?? { isin: -1, quantity: -1, avgCost: -1, costValue: -1, name: -1, currency: -1, symbol: -1, market: -1, instrumentType: -1, fxRate: -1 }

  if (map.isin < 0) {
    map.isin = detectIsinColumn(dataRows, columnCount)
  }

  const missing: string[] = []
  if (map.isin < 0) missing.push('ISIN')
  if (map.quantity < 0) missing.push('Quantità')
  if (map.avgCost < 0 && map.costValue < 0) missing.push('Prezzo medio di carico')

  if (missing.length > 0) {
    const found = detectedColumns.length > 0
      ? ` Colonne rilevate nel file: ${detectedColumns.join(', ')}.`
      : ' Nessuna riga di intestazione riconosciuta nel file.'
    throw new Error(
      `Colonne mancanti nel CSV: ${missing.join(', ')}.${found} Verifica di aver esportato il portafoglio titoli da Fineco (Patrimonio → Portafoglio titoli → Esporta).`
    )
  }

  const warnings: string[] = []
  const byIsin = new Map<string, ParsedHoldingRow & { totalCost: number }>()
  const duplicated = new Set<string>()

  dataRows.forEach((row, index) => {
    // Numero di riga nel file originale, per un warning utilizzabile dall'utente.
    const rowNum = (detection ? detection.index + 1 : 0) + index + 1
    const nonEmpty = row.filter((c) => c?.trim()).length
    if (nonEmpty < 2) return

    const isin = extractIsin(row[map.isin])
    const quantity = parseAmount(row[map.quantity])

    if (!isin) {
      // Righe di coda/disclaimer: segnalate solo se sembrano davvero posizioni.
      if (!isNaN(quantity)) warnings.push(`Riga ${rowNum}: ISIN mancante o non valido, riga scartata.`)
      return
    }
    if (isNaN(quantity)) {
      warnings.push(`Riga ${rowNum} (${isin}): quantità non valida, riga scartata.`)
      return
    }
    if (quantity <= 0) {
      warnings.push(`Riga ${rowNum} (${isin}): quantità zero, posizione chiusa ignorata.`)
      return
    }

    const currency = map.currency >= 0 ? normalizeCurrency(row[map.currency]) : undefined

    // Il PMC è espresso nella valuta del titolo, come il prezzo che arriva dal
    // price feed: è quello il valore da confrontare per il P&L. Il "Valore di
    // carico" Fineco è invece già convertito in euro, quindi va usato solo come
    // ripiego e su un titolo in valuta estera va segnalato.
    let avgCost = map.avgCost >= 0 ? parseAmount(row[map.avgCost]) : NaN
    let derivedFromCostValue = false
    if (isNaN(avgCost) && map.costValue >= 0) {
      const costValue = parseAmount(row[map.costValue])
      if (!isNaN(costValue)) {
        avgCost = costValue / quantity
        derivedFromCostValue = true
      }
    }
    if (isNaN(avgCost)) {
      warnings.push(`Riga ${rowNum} (${isin}): prezzo medio di carico non valido, riga scartata.`)
      return
    }
    if (avgCost < 0) avgCost = Math.abs(avgCost)
    if (derivedFromCostValue && currency && currency !== 'EUR') {
      warnings.push(
        `Riga ${rowNum} (${isin}): prezzo di carico ricavato dal valore in euro su un titolo in ${currency}, il P&L può risultare distorto.`
      )
    }

    const name = (map.name >= 0 ? row[map.name]?.trim() : '') || isin
    const symbol = map.symbol >= 0 ? row[map.symbol]?.trim() || undefined : undefined
    const market = map.market >= 0 ? row[map.market]?.trim() || undefined : undefined
    const instrumentType = map.instrumentType >= 0 ? row[map.instrumentType]?.trim() || undefined : undefined
    const priceDivisor = detectPriceDivisor(
      quantity,
      avgCost,
      map.costValue >= 0 ? parseAmount(row[map.costValue]) : NaN,
      map.fxRate >= 0 ? parseAmount(row[map.fxRate]) : NaN,
      instrumentType,
      name
    )
    if (priceDivisor !== 1) {
      warnings.push(
        `Riga ${rowNum} (${isin}): titolo quotato in percentuale del nominale, controvalore calcolato come quantità × prezzo / ${priceDivisor}.`
      )
    }

    const existing = byIsin.get(isin)

    if (!existing) {
      byIsin.set(isin, {
        isin,
        name,
        quantity,
        avg_cost: avgCost,
        currency,
        symbol,
        market,
        instrument_type: instrumentType,
        price_divisor: priceDivisor,
        totalCost: quantity * avgCost,
      })
      return
    }

    // Stesso ISIN su più righe: si sommano le quantità e si ricalcola il prezzo
    // medio ponderato, altrimenti l'insert violerebbe UNIQUE(user_id, asset_id).
    duplicated.add(isin)
    existing.quantity += quantity
    existing.totalCost += quantity * avgCost
    existing.avg_cost = existing.totalCost / existing.quantity
  })

  for (const isin of duplicated) {
    warnings.push(`ISIN ${isin}: più righe nel CSV, quantità sommate e prezzo di carico mediato.`)
  }

  const rows: ParsedHoldingRow[] = [...byIsin.values()].map((r) => ({
    isin: r.isin,
    name: r.name,
    quantity: Math.round(r.quantity * 1e6) / 1e6,
    avg_cost: Math.round(r.avg_cost * 1e4) / 1e4,
    price_divisor: r.price_divisor,
    ...(r.currency ? { currency: r.currency } : {}),
    ...(r.symbol ? { symbol: r.symbol } : {}),
    ...(r.market ? { market: r.market } : {}),
    ...(r.instrument_type ? { instrument_type: r.instrument_type } : {}),
  }))

  return { rows, warnings, detectedColumns }
}
