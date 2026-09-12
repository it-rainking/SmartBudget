import YahooFinance from 'yahoo-finance2'
import type { PriceProvider, PriceQuote } from './types'
import { getChartQuote } from './yahooChart'

const yahooFinance = new YahooFinance()

// Fallback non ufficiale (Yahoo non ha una API key stabile/pubblica): isolato
// dietro PriceProvider per poter essere sostituito (es. Twelve Data) senza
// toccare il resto del price fetcher. Due canali in cascata, perche quello
// della libreria dipende da un flusso cookie/crumb che da alcuni ambienti
// server non si completa.
export const yahooProvider: PriceProvider = {
  async getQuote(ticker: string): Promise<PriceQuote | null> {
    return (await quoteViaLibrary(ticker)) ?? (await getChartQuote(ticker))
  },
}

// Canale primario: `quote` restituisce piu dati ed e quello mantenuto dalla
// libreria. Quando non risponde subentra l'endpoint chart (vedi yahooChart.ts).
async function quoteViaLibrary(ticker: string): Promise<PriceQuote | null> {
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
    // Il motivo va nei log: quando il flusso cookie/crumb non si completa
    // fallisce ogni ticker, e senza questa riga il cron sembrerebbe soltanto
    // non trovare nulla. Il chiamante riceve null e passa all'endpoint chart.
    console.warn(`[yahoo] richiesta fallita per ${ticker}: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}
