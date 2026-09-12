// Tipi dominio per il modulo Investimenti

export type AssetClass = 'etf_equity' | 'etf_bond' | 'etf_thematic' | 'stock' | 'bond' | 'cash' | 'other'
export type PriceSource = 'gsheet' | 'yahoo'
export type PriceOrigin = 'market' | 'manual' | 'cost'

export interface Asset {
  id: string
  user_id: string
  isin: string
  ticker_gf: string
  ticker_yahoo: string | null
  name: string
  asset_class: AssetClass
  currency: string
  /** 1 per azioni/ETF, 100 per i titoli quotati in percentuale del nominale. */
  price_divisor: number
  created_at: string
  updated_at: string
}

export interface Holding {
  id: string
  user_id: string
  asset_id: string
  quantity: number
  avg_cost: number
  source: string
  imported_at: string
  created_at: string
  updated_at: string
}

export interface PriceSnapshot {
  id: number
  asset_id: string
  price: number
  change_pct: number | null
  currency: string
  source: PriceSource
  fetched_at: string
}

// Riga arricchita restituita da GET /api/investments/summary: una holding
// con l'ultimo prezzo noto e i valori calcolati lato server.
export interface InvestmentPosition {
  holding_id: string
  asset_id: string
  isin: string
  ticker_gf: string
  ticker_yahoo: string | null
  name: string
  asset_class: AssetClass
  currency: string
  price_divisor: number
  quantity: number
  avg_cost: number
  imported_at: string
  last_price: number | null
  /**
   * Da dove viene il prezzo usato per il controvalore, in ordine di precedenza:
   * `market` (snapshot del cron), `manual` (inserito dall'utente per le
   * posizioni senza quotazione), `cost` (nessuno dei due: si usa il carico).
   */
  price_origin: PriceOrigin
  /** Prezzo inserito a mano, se presente — indipendente da quale sia stato usato. */
  manual_price: number | null
  /** Data a cui il prezzo manuale si riferisce (YYYY-MM-DD). */
  manual_priced_at: string | null
  change_pct: number | null
  price_source: PriceSource | null
  fetched_at: string | null
  market_value: number
  pnl_abs: number
  pnl_pct: number
  weight_pct: number
  /** Cambio applicato verso la valuta di riferimento; null se non disponibile. */
  fx_rate: number | null
  /** Controvalore nella valuta di riferimento; null se il cambio manca. */
  market_value_base: number | null
  /** Costo di carico nella valuta di riferimento; null se il cambio manca. */
  cost_base: number | null
  /** P&L assoluto nella valuta di riferimento; null se il cambio manca. */
  pnl_abs_base: number | null
}

/** Prezzo inserito a mano per una posizione senza quotazione automatica. */
export interface ManualPrice {
  id: string
  user_id: string
  asset_id: string
  price: number
  priced_at: string
  note: string | null
  created_at: string
  updated_at: string
}

export interface AssetClassBreakdown {
  asset_class: AssetClass
  market_value: number
  weight_pct: number
}

export interface InvestmentSummary {
  positions: InvestmentPosition[]
  by_asset_class: AssetClassBreakdown[]
  total_market_value: number
  total_cost: number
  total_pnl_abs: number
  total_pnl_pct: number
  positions_as_of: string | null
  prices_as_of: string | null
  /** Valute presenti nel portafoglio. */
  currencies: string[]
  /** Valuta in cui sono espressi i totali (da settings.currency). */
  base_currency: string
  /**
   * Valute per cui manca il cambio: le relative posizioni restano fuori dai
   * totali invece di essere sommate a valuta diversa. La UI lo segnala.
   */
  unconverted_currencies: string[]
  /** Quando sono stati aggiornati i cambi usati (il più vecchio della serie). */
  fx_as_of: string | null
}

export interface ImportDiff {
  /** Posizioni effettivamente scritte in holdings dall'ultimo import. */
  imported_positions: number
  new_positions: number
  changed_positions: number
  removed_positions: number
  unmapped_isins: string[]
  /** ISIN il cui ticker è stato dedotto da Simbolo + Mercato del CSV. */
  derived_tickers: { isin: string; ticker_gf: string }[]
  /** Mercati presenti nel CSV che non sappiamo tradurre in un ticker. */
  unknown_markets: string[]
  /** Posizioni quotate in percentuale del nominale (obbligazioni). */
  percent_quoted_positions: number
}
