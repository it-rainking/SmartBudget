import { describe, expect, it } from 'vitest'
import { addDays, addMonthsClamped, installmentDates, isPaypalMethod, splitInstallments } from '@/lib/utils'
import { buildInstallmentPlans, findImportedInstallmentDuplicates } from '@/lib/installments'
import type { Transaction } from '@/types'

function rata(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'x',
    user_id: 'u',
    type: 'expense',
    category_id: 'c',
    subcategory_id: null,
    amount: 10,
    date: '2026-01-15',
    description: 'Cuffie',
    payment_method: 'PayPal',
    tags: null,
    notes: null,
    is_recurring: false,
    recurring_id: null,
    recurring_expense_id: null,
    installment_plan_id: 'p1',
    installment_number: 1,
    installment_count: 3,
    is_exceptional: false,
    created_at: '',
    updated_at: '',
    ...overrides,
  } as Transaction
}

describe('splitInstallments', () => {
  it('somma sempre esattamente il totale, resto sulla prima rata', () => {
    expect(splitInstallments(100)).toEqual([33.34, 33.33, 33.33])
    expect(splitInstallments(99.99)).toEqual([33.33, 33.33, 33.33])
    expect(splitInstallments(0.1)).toEqual([0.04, 0.03, 0.03])
  })

  it('non introduce errori di virgola mobile', () => {
    for (const total of [19.99, 45.1, 1234.57, 2000]) {
      const sumCents = splitInstallments(total).reduce((s, a) => s + Math.round(a * 100), 0)
      expect(sumCents).toBe(Math.round(total * 100))
    }
  })
})

describe('date delle rate', () => {
  it('stesso giorno nei mesi successivi, con clamp a fine mese', () => {
    expect(installmentDates('2026-01-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
    expect(installmentDates('2028-01-30')).toEqual(['2028-01-30', '2028-02-29', '2028-03-30'])
  })

  it('attraversa il cambio anno', () => {
    expect(installmentDates('2026-11-15')).toEqual(['2026-11-15', '2026-12-15', '2027-01-15'])
    expect(addMonthsClamped('2026-12-31', 2)).toBe('2027-02-28')
  })

  it('addDays gestisce i cambi mese', () => {
    expect(addDays('2026-03-01', -3)).toBe('2026-02-26')
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('isPaypalMethod', () => {
  it('riconosce varianti rinominate', () => {
    expect(isPaypalMethod('PayPal')).toBe(true)
    expect(isPaypalMethod('paypal business')).toBe(true)
    expect(isPaypalMethod('Carta')).toBe(false)
    expect(isPaypalMethod(null)).toBe(false)
  })
})

describe('buildInstallmentPlans', () => {
  const rows = [
    rata({ id: 'a', installment_number: 1, amount: 33.34, date: '2026-01-15' }),
    rata({ id: 'b', installment_number: 2, amount: 33.33, date: '2026-02-15' }),
    rata({ id: 'c', installment_number: 3, amount: 33.33, date: '2026-03-15' }),
  ]

  it('calcola stato, residuo e prossima rata', () => {
    const [plan] = buildInstallmentPlans(rows, '2026-02-01', '2026-02-31', '2026-02-20')
    expect(plan.status).toBe('in_corso')
    expect(plan.chargedCount).toBe(2)
    expect(plan.totalAmount).toBe(100)
    expect(plan.chargedAmount).toBe(66.67)
    expect(plan.remainingAmount).toBe(33.33)
    expect(plan.amountInMonth).toBe(33.33)
    expect(plan.nextInstallment?.id).toBe('c')
    expect(plan.missingCount).toBe(0)
  })

  it('esclude i piani senza rate nel mese', () => {
    expect(buildInstallmentPlans(rows, '2026-05-01', '2026-05-31', '2026-05-10')).toEqual([])
  })

  it('una rata eliminata non fa sembrare il piano completo a 2/2', () => {
    const [plan] = buildInstallmentPlans(rows.slice(0, 2), '2026-02-01', '2026-02-31', '2026-02-20')
    expect(plan.installmentCount).toBe(3)
    expect(plan.missingCount).toBe(1)
    expect(plan.status).toBe('completato')
    expect(plan.nextInstallment).toBeNull()
  })

  it('stato programmato prima della prima rata', () => {
    const [plan] = buildInstallmentPlans(rows, '2026-01-01', '2026-01-31', '2026-01-10')
    expect(plan.status).toBe('programmato')
    expect(plan.remainingAmount).toBe(100)
  })
})

describe('findImportedInstallmentDuplicates', () => {
  const existing = [
    { id: 'r1', date: '2026-02-15', amount: 33.33, type: 'expense' },
    { id: 'r2', date: '2026-03-15', amount: 33.33, type: 'expense' },
  ]

  it('riconosce la rata con scarto di qualche giorno e descrizione diversa', () => {
    const dup = findImportedInstallmentDuplicates(
      [
        { date: '2026-02-17', amount: 33.33, type: 'expense' },
        { date: '2026-02-17', amount: 12, type: 'expense' },
      ],
      existing
    )
    expect([...dup]).toEqual([0])
  })

  it('ogni rata assorbe una sola riga importata', () => {
    const dup = findImportedInstallmentDuplicates(
      [
        { date: '2026-02-15', amount: 33.33, type: 'expense' },
        { date: '2026-02-16', amount: 33.33, type: 'expense' },
      ],
      existing
    )
    expect(dup.size).toBe(1)
  })

  it('ignora date fuori tolleranza e tipi diversi', () => {
    const dup = findImportedInstallmentDuplicates(
      [
        { date: '2026-02-25', amount: 33.33, type: 'expense' },
        { date: '2026-02-15', amount: 33.33, type: 'income' },
      ],
      existing
    )
    expect(dup.size).toBe(0)
  })
})
