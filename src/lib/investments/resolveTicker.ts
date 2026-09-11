// Risoluzione del ticker di mercato a partire dalle colonne "Simbolo" e
// "Mercato" dell'export Fineco.
//
// La tabella `isin_ticker_lookup` resta la fonte autorevole e vince sempre:
// questa derivazione serve solo a non lasciare senza prezzi le posizioni che
// non sono ancora state mappate a mano. Non è un'invenzione — simbolo e mercato
// arrivano dal broker — ma vale solo per i mercati che sappiamo tradurre: per
// gli altri si restituisce null e l'ISIN viene segnalato come non mappato,
// perché un ticker sbagliato darebbe un prezzo sbagliato, che è peggio di
// nessun prezzo.

export interface ResolvedTicker {
  ticker_gf: string
  ticker_yahoo: string | null
}

interface MarketMapping {
  /** Prefisso borsa usato da Google Finance (es. "BIT" per Borsa Italiana). */
  gfPrefix: string
  /** Suffisso Yahoo Finance (es. ".MI"); stringa vuota per i mercati USA. */
  yahooSuffix: string
}

// Chiavi normalizzate (minuscole, senza separatori) dei mercati Fineco noti.
const MARKETS: Record<string, MarketMapping> = {
  // Borsa Italiana e sue piattaforme
  mta: { gfPrefix: 'BIT', yahooSuffix: '.MI' },
  mtaa: { gfPrefix: 'BIT', yahooSuffix: '.MI' },
  etfplus: { gfPrefix: 'BIT', yahooSuffix: '.MI' },
  miv: { gfPrefix: 'BIT', yahooSuffix: '.MI' },
  sedex: { gfPrefix: 'BIT', yahooSuffix: '.MI' },
  borsaitaliana: { gfPrefix: 'BIT', yahooSuffix: '.MI' },
  euronextmilan: { gfPrefix: 'BIT', yahooSuffix: '.MI' },
  milano: { gfPrefix: 'BIT', yahooSuffix: '.MI' },
  // Germania
  xetra: { gfPrefix: 'ETR', yahooSuffix: '.DE' },
  etr: { gfPrefix: 'ETR', yahooSuffix: '.DE' },
  francoforte: { gfPrefix: 'ETR', yahooSuffix: '.DE' },
  frankfurt: { gfPrefix: 'ETR', yahooSuffix: '.DE' },
  deutscheborse: { gfPrefix: 'ETR', yahooSuffix: '.DE' },
  // Stati Uniti (Yahoo non usa suffissi)
  nasdaq: { gfPrefix: 'NASDAQ', yahooSuffix: '' },
  nyse: { gfPrefix: 'NYSE', yahooSuffix: '' },
  newyork: { gfPrefix: 'NYSE', yahooSuffix: '' },
  nysearca: { gfPrefix: 'NYSEARCA', yahooSuffix: '' },
  arca: { gfPrefix: 'NYSEARCA', yahooSuffix: '' },
  amex: { gfPrefix: 'NYSEAMERICAN', yahooSuffix: '' },
  nyseamerican: { gfPrefix: 'NYSEAMERICAN', yahooSuffix: '' },
  // Resto d'Europa
  lse: { gfPrefix: 'LON', yahooSuffix: '.L' },
  londra: { gfPrefix: 'LON', yahooSuffix: '.L' },
  london: { gfPrefix: 'LON', yahooSuffix: '.L' },
  euronextparis: { gfPrefix: 'EPA', yahooSuffix: '.PA' },
  parigi: { gfPrefix: 'EPA', yahooSuffix: '.PA' },
  paris: { gfPrefix: 'EPA', yahooSuffix: '.PA' },
  euronextamsterdam: { gfPrefix: 'AMS', yahooSuffix: '.AS' },
  amsterdam: { gfPrefix: 'AMS', yahooSuffix: '.AS' },
  euronextbrussels: { gfPrefix: 'EBR', yahooSuffix: '.BR' },
  bruxelles: { gfPrefix: 'EBR', yahooSuffix: '.BR' },
  six: { gfPrefix: 'SWX', yahooSuffix: '.SW' },
  svizzera: { gfPrefix: 'SWX', yahooSuffix: '.SW' },
  zurigo: { gfPrefix: 'SWX', yahooSuffix: '.SW' },
  bme: { gfPrefix: 'BME', yahooSuffix: '.MC' },
  madrid: { gfPrefix: 'BME', yahooSuffix: '.MC' },
  // Codici osservati negli export Fineco reali.
  aff: { gfPrefix: 'BIT', yahooSuffix: '.MI' },
  euronextnl: { gfPrefix: 'AMS', yahooSuffix: '.AS' },
  euronextfr: { gfPrefix: 'EPA', yahooSuffix: '.PA' },
  euronextbe: { gfPrefix: 'EBR', yahooSuffix: '.BR' },
}

/**
 * Mercati riconosciuti ma da cui non si ricava un ticker interrogabile.
 *
 * Equiduct è un MTF paneuropeo su cui gli stessi titoli sono negoziati in
 * duplice quotazione: il simbolo non identifica una piazza di Google Finance, e
 * il prezzo del listino primario è spesso in un'altra valuta rispetto al
 * carico, quindi dedurlo darebbe un P&L sbagliato. MOT ed EuroTLX sono i
 * mercati obbligazionari: lì il "simbolo" Fineco non è un ticker.
 *
 * Sono elencati esplicitamente per non farli comparire fra i "mercati non
 * riconosciuti": il ticker va impostato a mano in isin_ticker_lookup, e questa
 * è un'informazione diversa da "non so cosa sia questo mercato".
 */
const UNQUOTABLE_MARKETS = new Set(['equiduct', 'mot', 'eurotlx', 'tlx', 'himtf', 'hi_mtf', 'extramot'])

function normalizeMarket(market: string): string {
  return market
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

// Suffissi di piazza in stile Yahoo. Servono a riconoscerli in coda al simbolo,
// non a generarli: la generazione usa yahooSuffix della mappa mercati.
const MARKET_SUFFIXES = new Set([
  '.MI', '.AS', '.DE', '.L', '.PA', '.BR', '.SW', '.MC', '.VI', '.ST',
  '.F', '.CO', '.HE', '.LS', '.IR', '.OL', '.WA', '.PR',
])

/**
 * Il "Simbolo" dell'export Fineco arriva già con il suffisso di piazza
 * (`RACE.MI`, `2HCA.AS`). Va tolto prima di comporre i ticker, altrimenti
 * Google Finance riceve `BIT:RACE.MI` e Yahoo `RACE.MI.MI`: entrambi
 * inesistenti, e la posizione resta senza prezzo.
 *
 * Solo i suffissi noti vengono rimossi: un punto fa parte del ticker in nomi
 * come `BRK.B`, che deve restare intero.
 */
function stripMarketSuffix(symbol: string): string {
  const dot = symbol.lastIndexOf('.')
  if (dot <= 0) return symbol
  return MARKET_SUFFIXES.has(symbol.slice(dot)) ? symbol.slice(0, dot) : symbol
}

function normalizeSymbol(symbol: string): string {
  return stripMarketSuffix(symbol.trim().toUpperCase().replace(/\s+/g, ''))
}

/**
 * Deriva i ticker Google Finance e Yahoo da simbolo + mercato.
 *
 * Ritorna null quando la derivazione non è affidabile:
 * - simbolo o mercato assenti;
 * - mercato non presente in tabella (meglio nessun prezzo di uno sbagliato);
 * - titolo quotato in percentuale del nominale (obbligazioni): su questi
 *   mercati il "simbolo" Fineco non corrisponde a un ticker interrogabile.
 */
export function resolveTickerFromCsv(
  symbol: string | undefined,
  market: string | undefined,
  options: { percentQuoted?: boolean } = {}
): ResolvedTicker | null {
  if (options.percentQuoted) return null
  if (!symbol?.trim() || !market?.trim()) return null

  const normalized = normalizeMarket(market)
  if (UNQUOTABLE_MARKETS.has(normalized)) return null

  const mapping = MARKETS[normalized]
  if (!mapping) return null

  const cleanSymbol = normalizeSymbol(symbol)
  if (!cleanSymbol || !/^[A-Z0-9.\-]{1,12}$/.test(cleanSymbol)) return null

  return {
    ticker_gf: `${mapping.gfPrefix}:${cleanSymbol}`,
    ticker_yahoo: `${cleanSymbol}${mapping.yahooSuffix}`,
  }
}

/**
 * Mercati che sappiamo cosa sono, per i messaggi diagnostici dell'import:
 * include sia quelli da cui deriviamo il ticker sia quelli per cui va
 * impostato a mano. Serve a non segnalare come "sconosciuto" un mercato che
 * conosciamo benissimo ma che semplicemente non espone un ticker.
 */
export function isKnownMarket(market: string | undefined): boolean {
  if (!market?.trim()) return false
  const normalized = normalizeMarket(market)
  return normalized in MARKETS || UNQUOTABLE_MARKETS.has(normalized)
}
