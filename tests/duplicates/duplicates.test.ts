import { describe, expect, it } from 'vitest'
import {
  dayBandIndexes,
  descriptionSimilarity,
  duplicatePairKey,
  findPossibleDuplicates,
} from '@/lib/duplicates'

const tx = (id: string, date: string, amount: number, description = '', type = 'expense', installment_plan_id: string | null = null) =>
  ({ id, date, amount, description, type, installment_plan_id })

describe('dayBandIndexes', () => {
  it('alterna al cambio di data, ignorando i giorni vuoti', () => {
    expect(dayBandIndexes(['2026-10-09', '2026-10-09', '2026-10-07', '2026-10-05', '2026-10-05']))
      .toEqual([0, 0, 1, 0, 0])
  })
  it('elenco vuoto', () => {
    expect(dayBandIndexes([])).toEqual([])
  })
})

describe('descriptionSimilarity', () => {
  it('ignora maiuscole, numeri e parole da estratto conto', () => {
    expect(descriptionSimilarity('PAGAMENTO POS 12/03 ESSELUNGA', 'Esselunga')).toBe(1)
  })
  it('descrizioni vuote non sono simili', () => {
    expect(descriptionSimilarity('', '')).toBe(0)
  })
})

describe('findPossibleDuplicates', () => {
  it('stesso importo in giorni consecutivi', () => {
    const pairs = findPossibleDuplicates([tx('a', '2026-10-01', 42.5), tx('b', '2026-10-02', 42.5)])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].reason).toBe('amount')
  })

  it('stesso importo a due giorni di distanza senza descrizione simile: no', () => {
    expect(findPossibleDuplicates([tx('a', '2026-10-01', 42.5), tx('b', '2026-10-03', 42.5)])).toHaveLength(0)
  })

  it('descrizione simile e importo vicino entro 3 giorni', () => {
    const pairs = findPossibleDuplicates([
      tx('a', '2026-10-01', 50, 'Amazon EU ordine'),
      tx('b', '2026-10-04', 52, 'AMAZON EU'),
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].reason).toBe('description')
  })

  it('importo e descrizione insieme hanno la precedenza', () => {
    const pairs = findPossibleDuplicates([
      tx('x', '2026-10-10', 10),
      tx('y', '2026-10-10', 10.05),
      tx('a', '2026-10-01', 30, 'Netflix abbonamento'),
      tx('b', '2026-10-01', 30, 'NETFLIX abbonamento'),
    ])
    expect(pairs.map((p) => p.reason)).toEqual(['both', 'amount'])
  })

  it('tipi diversi, rate dello stesso piano e coppie scartate sono esclusi', () => {
    expect(findPossibleDuplicates([tx('a', '2026-10-01', 20), tx('b', '2026-10-01', 20, '', 'income')])).toHaveLength(0)
    expect(findPossibleDuplicates([tx('a', '2026-10-01', 20, '', 'expense', 'p'), tx('b', '2026-10-01', 20, '', 'expense', 'p')])).toHaveLength(0)
    expect(findPossibleDuplicates(
      [tx('a', '2026-10-01', 20), tx('b', '2026-10-01', 20)],
      new Set([duplicatePairKey('b', 'a')]),
    )).toHaveLength(0)
  })
})
