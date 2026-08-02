// Tipi dominio per il modulo Investimenti

export type AssetClass = 'etf_equity' | 'etf_bond' | 'etf_thematic' | 'stock' | 'cash' | 'other'
export type PriceSource = 'gsheet' | 'yahoo'

export interface Asset {
  id: string
  user_id: string
  isin: string
  ticker_gf: string
  ticker_yahoo: string | null
  name: string
  asset_class: AssetClass
  currency: string
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
  quantity: number
  avg_cost: number
  imported_at: string
  last_price: number | null
  change_pct: number | null
  price_source: PriceSource | null
  fetched_at: string | null
  market_value: number
  pnl_abs: number
  pnl_pct: number
  weight_pct: number
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
}

export interface ImportDiff {
  new_positions: number
  changed_positions: number
  removed_positions: number
  unmapped_isins: string[]
}
