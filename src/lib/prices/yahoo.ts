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
      if (!quote?.regularMarketPrice) {
        console.warn(`[yahoo] nessun prezzo per ${ticker}: ticker inesistente o senza quotazione`)
        return null
      }
      return {
        price: quote.regularMarketPrice,
        changePct: quote.regularMarketChangePercent ?? null,
        currency: quote.currency ?? 'EUR',
      }
    } catch (e) {
      // Il fallback resta silenzioso verso il chiamante (null = nessun prezzo),
      // ma il motivo va nei log: quando Yahoo smette di rispondere da un certo
      // ambiente fallisce ogni ticker, e senza questa riga il cron sembrerebbe
      // semplicemente non trovare nulla.
      console.warn(`[yahoo] richiesta fallita per ${ticker}: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }
  },
}
