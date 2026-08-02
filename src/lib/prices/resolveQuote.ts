import type { PriceProvider, PriceQuote } from './types'

export interface ResolvedQuote extends PriceQuote {
  source: 'gsheet' | 'yahoo'
}

// Decide se usare il prezzo dal Google Sheet ponte o il fallback Yahoo per un
// singolo asset. Isolato dal resto del cron per essere testabile senza rete:
// sheetsProvider è già null se il Sheet non è configurato, e la sua getQuote
// ritorna null per ticker mancanti/in errore (#N/A) o se il foglio è stantio.
export async function resolveAssetQuote(
  tickerGf: string,
  tickerYahoo: string | null,
  sheetsProvider: PriceProvider | null,
  yahooProvider: PriceProvider
): Promise<ResolvedQuote | null> {
  if (sheetsProvider) {
    const fromSheet = await sheetsProvider.getQuote(tickerGf)
    if (fromSheet) return { ...fromSheet, source: 'gsheet' }
  }
  if (!tickerYahoo) return null
  const fromYahoo = await yahooProvider.getQuote(tickerYahoo)
  return fromYahoo ? { ...fromYahoo, source: 'yahoo' } : null
}
