import YahooFinance from 'yahoo-finance2'
import type { PriceProvider, PriceQuote } from './types'

const yahooFinance = new YahooFinance()

// Fallback non ufficiale (yahoo-finance2 non ha una API key stabile/pubblica):
// isolato dietro PriceProvider per poter essere sostituito (es. Twelve Data)
// senza toccare il resto del price fetcher.
export const yahooProvider: PriceProvider = {
  async getQuote(ticker: string): Promise<PriceQuote | null> {
    try {
      const quote = await yahooFinance.quote(ticker)
      if (!quote?.regularMarketPrice) return null
      return {
        price: quote.regularMarketPrice,
        changePct: quote.regularMarketChangePercent ?? null,
        currency: quote.currency ?? 'EUR',
      }
    } catch {
      return null
    }
  },
}
