import { describe, expect, it } from 'vitest'
import { classifyFromCsv } from '@/lib/investments/classifyAsset'
import { detectPriceDivisor, isPercentQuotedType } from '@/lib/investments/parseFinecoCsv'

// Nomi presi dal portafoglio reale: sono la ragione per cui la classificazione
// non può fermarsi alla colonna "Strumento", che dice solo "ETF".
describe('classifyFromCsv', () => {
  it('distingue gli ETF obbligazionari dagli azionari leggendo il nome', () => {
    expect(classifyFromCsv('ETF', 'iShares  EUR Govt Bond 15-30yr UCITS ETF EUR (Dist)', false)).toBe('etf_bond')
    expect(classifyFromCsv('ETF', 'iShares  EUR High Yield Corp Bond UCITS ETF', false)).toBe('etf_bond')
    expect(classifyFromCsv('ETF', 'Vanguard FTSE All-World UCITS ETF (USD) Dis', false)).toBe('etf_equity')
    expect(classifyFromCsv('ETF', 'VanEck Semiconductor UCITS ETF A $', false)).toBe('etf_equity')
    expect(classifyFromCsv('ETF', 'iShares MSCI Korea UCITS ETF USD (Acc)', false)).toBe('etf_equity')
  })

  it('classifica come azioni i titoli azionari', () => {
    expect(classifyFromCsv('Azioni', 'FERRARI', false)).toBe('stock')
    expect(classifyFromCsv('Azioni', 'ALPHAB RG-C-NV', false)).toBe('stock')
  })

  it('classifica come obbligazione un titolo quotato in percentuale', () => {
    expect(classifyFromCsv('Obbligazioni', 'BTP-1FB33 5,75', true)).toBe('bond')
    // Un ETF obbligazionario non è quotato in percentuale e resta etf_bond.
    expect(classifyFromCsv('ETF', 'iShares  EUR Govt Bond 15-30yr UCITS ETF EUR (Dist)', false)).toBe('etf_bond')
  })

  it('non forza una classe quando il CSV non è conclusivo', () => {
    expect(classifyFromCsv(undefined, undefined, false)).toBeNull()
    expect(classifyFromCsv('Certificate', 'PROD X', false)).toBeNull()
  })
})

describe('riconoscimento titoli di Stato dal nome', () => {
  it('riconosce i nomi Fineco dei governativi', () => {
    expect(isPercentQuotedType(undefined, 'BTP-13GN27 VALSU CUM')).toBe(true)
    expect(isPercentQuotedType(undefined, 'BTP-1ST50 2,45')).toBe(true)
    expect(isPercentQuotedType(undefined, 'GREECE-30GE28 3,75')).toBe(true)
  })

  it('non scambia per governativo un ETF che cita i titoli di Stato', () => {
    expect(isPercentQuotedType('ETF', 'iShares  EUR Govt Bond 15-30yr UCITS ETF EUR (Dist)')).toBe(false)
    expect(isPercentQuotedType(undefined, 'Treasury Bond UCITS ETF')).toBe(false)
  })

  it('usa il nome solo quando il valore di carico non decide', () => {
    // Il confronto numerico vince: qui i conti tornano senza divisore.
    expect(detectPriceDivisor(10, 150, 1500, NaN, undefined, 'BTP-1FB33 5,75')).toBe(1)
    // Senza valore di carico si ricade sul nome.
    expect(detectPriceDivisor(10000, 98.5, NaN, NaN, undefined, 'BTP-1FB33 5,75')).toBe(100)
    expect(detectPriceDivisor(10000, 98.5, 9850, NaN, undefined, 'BTP-1FB33 5,75')).toBe(100)
  })
})
