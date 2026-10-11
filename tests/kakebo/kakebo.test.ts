import { describe, expect, it } from 'vitest'
import { computeSpendingPlan, expenseGroup, isCashMethod, monthWeeks, type PlanExpense, type SpendingGroup } from '@/lib/kakebo'

const expense = (overrides: Partial<PlanExpense>): PlanExpense => ({
  amount: 10,
  date: '2026-10-05',
  category_id: null,
  payment_method: null,
  is_exceptional: false,
  is_recurring: false,
  recurring_expense_id: null,
  installment_plan_id: null,
  ...overrides,
})

const groups: Record<string, SpendingGroup | null> = {
  casa: 'fixed',
  spesa: 'essential',
  shopping: 'optional',
  svago: 'leisure',
  altro: null,
}

describe('monthWeeks', () => {
  it('ottobre 2026: inizia di giovedì, settimane da lunedì a domenica tagliate al mese', () => {
    expect(monthWeeks(10, 2026)).toEqual([
      { index: 1, startDay: 1, endDay: 4 },
      { index: 2, startDay: 5, endDay: 11 },
      { index: 3, startDay: 12, endDay: 18 },
      { index: 4, startDay: 19, endDay: 25 },
      { index: 5, startDay: 26, endDay: 31 },
    ])
  })

  it('febbraio 2027 non bisestile copre tutti i 28 giorni', () => {
    const weeks = monthWeeks(2, 2027)
    expect(weeks[0].startDay).toBe(1)
    expect(weeks[weeks.length - 1].endDay).toBe(28)
  })

  it('mese che inizia di lunedì e finisce di domenica: solo settimane intere', () => {
    // 1 febbraio 2027 è lunedì, 28 è domenica
    expect(monthWeeks(2, 2027)).toHaveLength(4)
  })
})

describe('expenseGroup', () => {
  it('ricorrenze e rate sono uscite fisse qualunque sia la categoria', () => {
    expect(expenseGroup(expense({ category_id: 'shopping', installment_plan_id: 'p1' }), groups)).toBe('fixed')
    expect(expenseGroup(expense({ category_id: 'spesa', recurring_expense_id: 'r1' }), groups)).toBe('fixed')
    expect(expenseGroup(expense({ category_id: 'svago', is_recurring: true }), groups)).toBe('fixed')
  })

  it('altrimenti decide la categoria', () => {
    expect(expenseGroup(expense({ category_id: 'shopping' }), groups)).toBe('optional')
  })

  it('eccezionale senza gruppo va in extra, ordinaria senza gruppo resta da classificare', () => {
    expect(expenseGroup(expense({ category_id: 'altro', is_exceptional: true }), groups)).toBe('extra')
    expect(expenseGroup(expense({ category_id: 'altro' }), groups)).toBeNull()
    expect(expenseGroup(expense({ category_id: null }), groups)).toBeNull()
  })

  it('una categoria con gruppo prevale sul flag eccezionale', () => {
    expect(expenseGroup(expense({ category_id: 'spesa', is_exceptional: true }), groups)).toBe('essential')
  })
})

describe('isCashMethod', () => {
  it('riconosce i contanti per nome', () => {
    expect(isCashMethod('Contanti')).toBe(true)
    expect(isCashMethod('contante')).toBe(true)
    expect(isCashMethod('Cash')).toBe(true)
    expect(isCashMethod('Carta')).toBe(false)
    expect(isCashMethod(null)).toBe(false)
  })
})

describe('computeSpendingPlan', () => {
  const base = {
    month: 10,
    year: 2026,
    income: 2000,
    savings: 200,
    debts: 0,
    groupByCategory: groups,
    plannedFixed: [],
    today: '2026-10-11',
  }

  it('budget variabile = entrate − fisse − risparmi; il residuo scala le spese variabili', () => {
    const plan = computeSpendingPlan({
      ...base,
      expenses: [
        expense({ amount: 700, category_id: 'casa', date: '2026-10-01' }),
        expense({ amount: 100, category_id: 'spesa', date: '2026-10-03', payment_method: 'Contanti' }),
        expense({ amount: 50, category_id: 'svago', date: '2026-10-10', payment_method: 'Carta' }),
      ],
    })
    expect(plan.fixedTotal).toBe(700)
    expect(plan.variableBudget).toBe(1100)
    expect(plan.variableSpent).toBe(150)
    expect(plan.remaining).toBe(950)
    // 11 ottobre: restano 21 giorni, oggi incluso
    expect(plan.daysLeft).toBe(21)
    expect(plan.perDayLeft).toBeCloseTo(950 / 21, 2)
    expect(plan.cash).toBe(100)
    expect(plan.nonCash).toBe(750)
  })

  it('le uscite fisse non pesano sulle settimane, le variabili sì', () => {
    const plan = computeSpendingPlan({
      ...base,
      expenses: [
        expense({ amount: 700, category_id: 'casa', date: '2026-10-01' }),
        expense({ amount: 100, category_id: 'spesa', date: '2026-10-03' }),
        expense({ amount: 50, category_id: 'svago', date: '2026-10-10' }),
      ],
    })
    expect(plan.weeks.map((w) => w.spent)).toEqual([100, 50, 0, 0, 0])
    expect(plan.weeks.map((w) => w.status)).toEqual(['past', 'current', 'future', 'future', 'future'])
    // quota della settimana 2 (7 giorni su 31)
    expect(plan.weeks[1].target).toBeCloseTo(1100 * 7 / 31, 2)
  })

  it('le uscite fisse attese ma non registrate riducono il budget nel mese corrente, non in quelli passati', () => {
    const current = computeSpendingPlan({ ...base, expenses: [], plannedFixed: [{ amount: 50 }] })
    expect(current.fixedPlanned).toBe(50)
    expect(current.variableBudget).toBe(1750)

    const past = computeSpendingPlan({ ...base, today: '2026-11-02', expenses: [], plannedFixed: [{ amount: 50 }] })
    expect(past.fixedPlanned).toBe(0)
    expect(past.daysLeft).toBe(0)
    expect(past.perDayLeft).toBe(0)
    expect(past.weeks.every((w) => w.status === 'past')).toBe(true)
  })

  it('spese senza gruppo finiscono in "da classificare" ma contano come variabili', () => {
    const plan = computeSpendingPlan({ ...base, expenses: [expense({ amount: 30, category_id: 'altro' })] })
    expect(plan.unassigned).toBe(30)
    expect(plan.variableSpent).toBe(30)
  })

  it('budget negativo: nessuna quota settimanale e niente spesa giornaliera suggerita', () => {
    const plan = computeSpendingPlan({ ...base, income: 500, expenses: [expense({ amount: 700, category_id: 'casa' })] })
    expect(plan.variableBudget).toBe(-400)
    expect(plan.perDayLeft).toBe(0)
    expect(plan.weeks.every((w) => w.target === 0)).toBe(true)
  })
})
