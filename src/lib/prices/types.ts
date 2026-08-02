export interface PriceQuote {
  price: number
  changePct: number | null
  currency: string
}

export interface PriceProvider {
  getQuote(ticker: string): Promise<PriceQuote | null>
}
