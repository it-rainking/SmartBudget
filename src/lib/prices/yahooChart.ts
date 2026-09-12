import type { PriceQuote } from './types'

// Secondo canale Yahoo, usato quando `quote` di yahoo-finance2 fallisce.
//
// `quote` passa da un flusso cookie + crumb: la libreria deve prima ottenere un
// cookie di consenso e poi un token. Da alcuni ambienti server quel flusso non
// si completa (errori tipo "No set-cookie header") e allora fallisce *ogni*
// ticker, non qualcuno. L'endpoint chart risponde invece senza crumb, quindi
// copre esattamente quel caso. Nessuna API key, nessuna dipendenza in più.
const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'
const TIMEOUT_MS = 10_000

// Estratta dalla chiamata di rete per essere testabile: la forma della risposta
// Yahoo è l'unica parte che vale la pena verificare senza rete.
export function parseChartResponse(json: unknown): PriceQuote | null {
  const meta = (json as { chart?: { result?: { meta?: Record<string, unknown> }[] } })?.chart?.result?.[0]?.meta
  if (!meta) return null

  const price = meta.regularMarketPrice
  if (typeof price !== 'number' || !isFinite(price)) return null

  // Il chiuso precedente serve solo alla variazione giornaliera: se manca, la
  // posizione resta valida senza quel dato.
  const previousClose = meta.chartPreviousClose ?? meta.previousClose
  const changePct =
    typeof previousClose === 'number' && previousClose > 0
      ? ((price - previousClose) / previousClose) * 100
      : null

  return {
    price,
    changePct,
    currency: typeof meta.currency === 'string' && meta.currency ? meta.currency : 'EUR',
  }
}

export async function getChartQuote(ticker: string): Promise<PriceQuote | null> {
  try {
    const res = await fetch(`${CHART_URL}/${encodeURIComponent(ticker)}?interval=1d&range=1d`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Senza uno User-Agent da browser Yahoo risponde 429/403 a molte richieste server.
        'User-Agent': 'Mozilla/5.0 (compatible; SmartBudget/1.0)',
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      console.warn(`[yahoo:chart] HTTP ${res.status} per ${ticker}`)
      return null
    }
    return parseChartResponse(await res.json())
  } catch (e) {
    console.warn(`[yahoo:chart] richiesta fallita per ${ticker}: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}
