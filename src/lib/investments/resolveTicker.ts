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
}

function normalizeMarket(market: string): string {
  return market
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\s+/g, '')
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

  const mapping = MARKETS[normalizeMarket(market)]
  if (!mapping) return null

  const cleanSymbol = normalizeSymbol(symbol)
  if (!cleanSymbol || !/^[A-Z0-9.\-]{1,12}$/.test(cleanSymbol)) return null

  return {
    ticker_gf: `${mapping.gfPrefix}:${cleanSymbol}`,
    ticker_yahoo: `${cleanSymbol}${mapping.yahooSuffix}`,
  }
}

/** Mercati riconosciuti, per i messaggi diagnostici dell'import. */
export function isKnownMarket(market: string | undefined): boolean {
  return !!market?.trim() && normalizeMarket(market) in MARKETS
}
