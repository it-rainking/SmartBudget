import { describe, expect, it, vi } from 'vitest'
import { isSheetStale, parseSheetQuotes } from '@/lib/prices/googleSheets'
import { resolveAssetQuote } from '@/lib/prices/resolveQuote'
import { parseChartResponse } from '@/lib/prices/yahooChart'
import type { PriceProvider } from '@/lib/prices/types'

describe('parseSheetQuotes', () => {
  it('scarta le righe con cella #N/A', () => {
    const rows = [
      ['BIT:VWCE', '95.32', '95.10', '0.23', 'EUR'],
      ['BIT:UNKNOWN', '#N/A', '#N/A', '#N/A', 'EUR'],
    ]
    const quotes = parseSheetQuotes(rows)
    expect(quotes.get('BIT:VWCE')).toEqual({ price: 95.32, changePct: 0.23, currency: 'EUR' })
    expect(quotes.has('BIT:UNKNOWN')).toBe(false)
  })
})

describe('isSheetStale', () => {
  it('considera stantio un foglio senza timestamp', () => {
    expect(isSheetStale(undefined)).toBe(true)
  })

  it('considera stantio un timestamp più vecchio di 2 ore', () => {
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(isSheetStale(old)).toBe(true)
  })

  it('considera fresco un timestamp recente', () => {
    const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(isSheetStale(recent)).toBe(false)
  })
})

describe('resolveAssetQuote', () => {
  it('usa il prezzo dal Google Sheet quando disponibile', async () => {
    const sheets: PriceProvider = {
      getQuote: async () => ({ price: 10, changePct: 1, currency: 'EUR' }),
    }
    const yahoo: PriceProvider = { getQuote: vi.fn().mockResolvedValue(null) }

    const result = await resolveAssetQuote('BIT:VWCE', 'VWCE.MI', sheets, yahoo)
    expect(result).toEqual({ price: 10, changePct: 1, currency: 'EUR', source: 'gsheet' })
    expect(yahoo.getQuote).not.toHaveBeenCalled()
  })

  it('fa fallback a Yahoo quando la cella Sheet è #N/A (getQuote ritorna null)', async () => {
    const sheets: PriceProvider = { getQuote: vi.fn().mockResolvedValue(null) }
    const yahoo: PriceProvider = {
      getQuote: vi.fn().mockResolvedValue({ price: 20, changePct: -0.5, currency: 'USD' }),
    }

    const result = await resolveAssetQuote('BIT:UNKNOWN', 'UNKNOWN.MI', sheets, yahoo)
    expect(result).toEqual({ price: 20, changePct: -0.5, currency: 'USD', source: 'yahoo' })
    expect(sheets.getQuote).toHaveBeenCalledWith('BIT:UNKNOWN')
    expect(yahoo.getQuote).toHaveBeenCalledWith('UNKNOWN.MI')
  })

  it('fa fallback a Yahoo quando il Sheet ponte non è configurato (provider null)', async () => {
    const yahoo: PriceProvider = {
      getQuote: vi.fn().mockResolvedValue({ price: 30, changePct: 0, currency: 'EUR' }),
    }
    const result = await resolveAssetQuote('BIT:VWCE', 'VWCE.MI', null, yahoo)
    expect(result?.source).toBe('yahoo')
  })

  it('ritorna null se non c\'è ticker_yahoo e il Sheet non risolve', async () => {
    const sheets: PriceProvider = { getQuote: vi.fn().mockResolvedValue(null) }
    const yahoo: PriceProvider = { getQuote: vi.fn() }
    const result = await resolveAssetQuote('BIT:UNKNOWN', null, sheets, yahoo)
    expect(result).toBeNull()
    expect(yahoo.getQuote).not.toHaveBeenCalled()
  })
})

describe('parseChartResponse', () => {
  const chartJson = (meta: Record<string, unknown>) => ({ chart: { result: [{ meta }] } })

  it('estrae prezzo, valuta e variazione dal chiuso precedente', () => {
    expect(
      parseChartResponse(chartJson({ regularMarketPrice: 110, chartPreviousClose: 100, currency: 'USD' }))
    ).toEqual({ price: 110, changePct: 10, currency: 'USD' })
  })

  it('accetta previousClose quando chartPreviousClose manca', () => {
    const quote = parseChartResponse(chartJson({ regularMarketPrice: 90, previousClose: 100, currency: 'EUR' }))
    expect(quote?.changePct).toBeCloseTo(-10, 10)
  })

  it('lascia null la variazione senza chiuso precedente utilizzabile', () => {
    expect(parseChartResponse(chartJson({ regularMarketPrice: 50, chartPreviousClose: 0 }))).toEqual({
      price: 50,
      changePct: null,
      currency: 'EUR',
    })
  })

  it('usa EUR quando la valuta manca', () => {
    expect(parseChartResponse(chartJson({ regularMarketPrice: 50 }))?.currency).toBe('EUR')
  })

  it('ritorna null su risposte senza prezzo utilizzabile', () => {
    expect(parseChartResponse(chartJson({ regularMarketPrice: 'n/d' }))).toBeNull()
    expect(parseChartResponse(chartJson({}))).toBeNull()
    expect(parseChartResponse({ chart: { result: [] } })).toBeNull()
    expect(parseChartResponse({})).toBeNull()
    expect(parseChartResponse(null)).toBeNull()
  })
})
