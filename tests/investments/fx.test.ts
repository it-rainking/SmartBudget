import { describe, expect, it } from 'vitest'
import { buildFxTable, convertAmount, fxPairsNeeded, fxRate, fxTickers, normalizeCurrency } from '@/lib/prices/fx'

describe('normalizeCurrency', () => {
  it('normalizza maiuscole e spazi', () => {
    expect(normalizeCurrency(' usd ')).toBe('USD')
  })

  it('usa EUR come default per valori vuoti o non validi', () => {
    expect(normalizeCurrency(null)).toBe('EUR')
    expect(normalizeCurrency('')).toBe('EUR')
    expect(normalizeCurrency('dollari')).toBe('EUR')
  })
})

describe('fxPairsNeeded', () => {
  it('esclude le coppie con stessa valuta di partenza e arrivo', () => {
    expect(fxPairsNeeded(['EUR', 'EUR'], ['EUR'])).toEqual([])
  })

  it('produce una coppia per ogni valuta estera verso ogni valuta di conto', () => {
    expect(fxPairsNeeded(['EUR', 'USD', 'usd', 'GBP'], ['EUR'])).toEqual([
      { base: 'GBP', quote: 'EUR' },
      { base: 'USD', quote: 'EUR' },
    ])
  })

  it('copre più valute di conto (utenti diversi)', () => {
    expect(fxPairsNeeded(['USD'], ['EUR', 'CHF'])).toEqual([
      { base: 'USD', quote: 'CHF' },
      { base: 'USD', quote: 'EUR' },
    ])
  })
})

describe('fxTickers', () => {
  it('usa la sintassi GOOGLEFINANCE per il Sheet ponte e quella Yahoo per il fallback', () => {
    expect(fxTickers({ base: 'USD', quote: 'EUR' })).toEqual({
      tickerGf: 'CURRENCY:USDEUR',
      tickerYahoo: 'USDEUR=X',
    })
  })
})

describe('fxRate', () => {
  const table = buildFxTable([{ base: 'USD', quote: 'EUR', rate: 0.92 }])

  it('vale 1 per la stessa valuta anche senza righe in tabella', () => {
    expect(fxRate(buildFxTable([]), 'EUR', 'EUR')).toBe(1)
  })

  it('usa il cambio diretto', () => {
    expect(fxRate(table, 'USD', 'EUR')).toBe(0.92)
  })

  it('deriva il cambio inverso', () => {
    expect(fxRate(table, 'EUR', 'USD')).toBeCloseTo(1 / 0.92, 10)
  })

  it('triangola passando per una valuta intermedia', () => {
    const t = buildFxTable([
      { base: 'USD', quote: 'EUR', rate: 0.92 },
      { base: 'GBP', quote: 'EUR', rate: 1.17 },
    ])
    expect(fxRate(t, 'USD', 'GBP')).toBeCloseTo(0.92 / 1.17, 10)
  })

  it('ritorna null quando il cambio non è ricavabile', () => {
    expect(fxRate(table, 'JPY', 'EUR')).toBeNull()
  })

  it('scarta righe con cambio non positivo o non numerico', () => {
    const t = buildFxTable([
      { base: 'USD', quote: 'EUR', rate: 0 },
      { base: 'JPY', quote: 'EUR', rate: Number.NaN },
    ])
    expect(fxRate(t, 'USD', 'EUR')).toBeNull()
    expect(fxRate(t, 'JPY', 'EUR')).toBeNull()
  })
})

describe('convertAmount', () => {
  const table = buildFxTable([{ base: 'USD', quote: 'EUR', rate: 0.92 }])

  it('converte un controvalore in valuta di conto', () => {
    expect(convertAmount(1000, 'USD', 'EUR', table)).toBeCloseTo(920, 10)
  })

  it('lascia invariato un importo già nella valuta di conto', () => {
    expect(convertAmount(1000, 'EUR', 'EUR', table)).toBe(1000)
  })

  it('ritorna null invece di sommare valute diverse a cambio inventato', () => {
    expect(convertAmount(1000, 'JPY', 'EUR', table)).toBeNull()
  })
})
