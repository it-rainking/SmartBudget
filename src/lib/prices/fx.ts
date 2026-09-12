// Cambi valuta per il modulo investimenti.
//
// Il portafoglio Fineco contiene posizioni in valuta diversa da quella del
// profilo (tipicamente USD in un portafoglio EUR): senza conversione i totali
// sommano importi non omogenei. Qui stanno le funzioni pure (quali coppie
// servono, come si chiamano i ticker, come si converte un importo), così il
// cron e la route di riepilogo restano sottili e la logica è testabile senza
// rete né database.

export interface FxPair {
  /** Valuta di partenza, es. USD. */
  base: string
  /** Valuta di arrivo, es. EUR. */
  quote: string
}

export interface FxRateRow extends FxPair {
  /** Quante unità di `quote` per una unità di `base`. */
  rate: number
}

/** Tabella dei cambi indicizzata per coppia, costruita una volta per richiesta. */
export type FxTable = Map<string, number>

const CURRENCY_RE = /^[A-Z]{3}$/

/**
 * Normalizza un codice valuta. Fineco può scrivere `eur`, ` EUR ` o lasciare
 * la cella vuota: in tutti questi casi la valuta di default resta EUR, coerente
 * con il default della colonna `assets.currency`.
 */
export function normalizeCurrency(raw: string | null | undefined): string {
  const code = (raw ?? '').trim().toUpperCase()
  return CURRENCY_RE.test(code) ? code : 'EUR'
}

function key(base: string, quote: string): string {
  return `${base}>${quote}`
}

/**
 * Coppie da scaricare: ogni valuta presente nel portafoglio verso ogni valuta
 * di riferimento degli utenti. Le coppie identiche (EUR→EUR) sono escluse:
 * il cambio è 1 per definizione e non va chiesto a nessuno.
 */
export function fxPairsNeeded(
  assetCurrencies: (string | null | undefined)[],
  baseCurrencies: (string | null | undefined)[]
): FxPair[] {
  const froms = [...new Set(assetCurrencies.map(normalizeCurrency))].sort()
  const tos = [...new Set(baseCurrencies.map(normalizeCurrency))].sort()
  const pairs: FxPair[] = []
  for (const base of froms) {
    for (const quote of tos) {
      if (base !== quote) pairs.push({ base, quote })
    }
  }
  return pairs
}

/**
 * Simboli con cui chiedere il cambio alle due sorgenti prezzi già in uso:
 * `CURRENCY:USDEUR` è la sintassi GOOGLEFINANCE del Sheet ponte, `USDEUR=X`
 * quella di Yahoo. Nessuna nuova integrazione esterna.
 */
export function fxTickers(pair: FxPair): { tickerGf: string; tickerYahoo: string } {
  const symbol = `${pair.base}${pair.quote}`
  return { tickerGf: `CURRENCY:${symbol}`, tickerYahoo: `${symbol}=X` }
}

export function buildFxTable(rows: FxRateRow[]): FxTable {
  const table: FxTable = new Map()
  for (const row of rows) {
    const base = normalizeCurrency(row.base)
    const quote = normalizeCurrency(row.quote)
    const rate = Number(row.rate)
    if (!isFinite(rate) || rate <= 0) continue
    table.set(key(base, quote), rate)
  }
  return table
}

/**
 * Cambio da `from` a `to`, oppure null se non ricavabile. Si prova, in ordine:
 * coppia identica, cambio diretto, cambio inverso (EUR→USD dà anche USD→EUR),
 * e infine un passaggio intermedio (USD→EUR + EUR→GBP dà USD→GBP). Null è un
 * esito legittimo: meglio non convertire che convertire a un tasso inventato.
 */
export function fxRate(table: FxTable, from: string, to: string): number | null {
  const a = normalizeCurrency(from)
  const b = normalizeCurrency(to)
  if (a === b) return 1

  const direct = table.get(key(a, b))
  if (direct) return direct

  const inverse = table.get(key(b, a))
  if (inverse) return 1 / inverse

  const currencies = new Set<string>()
  for (const k of table.keys()) {
    const [base, quote] = k.split('>')
    currencies.add(base)
    currencies.add(quote)
  }
  for (const via of currencies) {
    if (via === a || via === b) continue
    const first = table.get(key(a, via)) ?? (table.get(key(via, a)) ? 1 / table.get(key(via, a))! : null)
    if (!first) continue
    const second = table.get(key(via, b)) ?? (table.get(key(b, via)) ? 1 / table.get(key(b, via))! : null)
    if (!second) continue
    return first * second
  }

  return null
}

/** Importo convertito, o null se il cambio non è disponibile. */
export function convertAmount(amount: number, from: string, to: string, table: FxTable): number | null {
  const rate = fxRate(table, from, to)
  return rate === null ? null : amount * rate
}
