'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface MonthlyAnnualData {
  month: number
  label: string
  // Valori reali (includono i movimenti eccezionali)
  income: number
  expenses: number
  savings: number
  balance: number
  // Valori a "condizioni normali": al netto dei movimenti eccezionali
  ordinaryIncome: number
  ordinaryExpenses: number
  ordinarySavings: number
  ordinaryBalance: number
  // Quota eccezionale, per poterla mostrare separatamente
  exceptionalIncome: number
  exceptionalExpenses: number
  exceptionalSavings: number
}

export interface AnnualTotals {
  income: number
  expenses: number
  savings: number
  balance: number
}

export interface AnnualHighlights {
  bestMonth: MonthlyAnnualData
  worstMonth: MonthlyAnnualData
  topIncome: MonthlyAnnualData
  topExpense: MonthlyAnnualData
}

const MONTH_LABELS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

// Calcola i mesi notevoli su una qualsiasi coppia di campi (reali o ordinari)
function computeHighlights(
  months: MonthlyAnnualData[],
  balanceKey: 'balance' | 'ordinaryBalance',
  incomeKey: 'income' | 'ordinaryIncome',
  expenseKey: 'expenses' | 'ordinaryExpenses'
): AnnualHighlights {
  return {
    bestMonth:  [...months].sort((a, b) => b[balanceKey] - a[balanceKey])[0],
    worstMonth: [...months].sort((a, b) => a[balanceKey] - b[balanceKey])[0],
    topIncome:  [...months].sort((a, b) => b[incomeKey]  - a[incomeKey])[0],
    topExpense: [...months].sort((a, b) => b[expenseKey] - a[expenseKey])[0],
  }
}

export function useAnnualData(year: number) {
  return useQuery({
    queryKey: ['annual_data', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount, date, is_exceptional')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)

      if (error) throw error

      const months: MonthlyAnnualData[] = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        label: MONTH_LABELS[i],
        income: 0,
        expenses: 0,
        savings: 0,
        balance: 0,
        ordinaryIncome: 0,
        ordinaryExpenses: 0,
        ordinarySavings: 0,
        ordinaryBalance: 0,
        exceptionalIncome: 0,
        exceptionalExpenses: 0,
        exceptionalSavings: 0,
      }))

      data?.forEach((t) => {
        const mi = parseInt(t.date.split('-')[1]) - 1
        const amt = Number(t.amount)
        const exceptional = !!t.is_exceptional
        switch (t.type) {
          case 'income':
            months[mi].income += amt
            if (exceptional) months[mi].exceptionalIncome += amt
            else months[mi].ordinaryIncome += amt
            break
          case 'expense':
            months[mi].expenses += amt
            if (exceptional) months[mi].exceptionalExpenses += amt
            else months[mi].ordinaryExpenses += amt
            break
          case 'saving':
            months[mi].savings += amt
            if (exceptional) months[mi].exceptionalSavings += amt
            else months[mi].ordinarySavings += amt
            break
        }
      })

      months.forEach((m) => {
        m.balance = m.income - m.expenses - m.savings
        m.ordinaryBalance = m.ordinaryIncome - m.ordinaryExpenses - m.ordinarySavings
      })

      const sum = (
        incomeKey: 'income' | 'ordinaryIncome',
        expenseKey: 'expenses' | 'ordinaryExpenses',
        savingKey: 'savings' | 'ordinarySavings',
        balanceKey: 'balance' | 'ordinaryBalance'
      ): AnnualTotals =>
        months.reduce(
          (acc, m) => ({
            income:   acc.income   + m[incomeKey],
            expenses: acc.expenses + m[expenseKey],
            savings:  acc.savings  + m[savingKey],
            balance:  acc.balance  + m[balanceKey],
          }),
          { income: 0, expenses: 0, savings: 0, balance: 0 }
        )

      const totals = sum('income', 'expenses', 'savings', 'balance')
      const ordinaryTotals = sum('ordinaryIncome', 'ordinaryExpenses', 'ordinarySavings', 'ordinaryBalance')
      const exceptionalTotals = {
        income:   totals.income   - ordinaryTotals.income,
        expenses: totals.expenses - ordinaryTotals.expenses,
        savings:  totals.savings  - ordinaryTotals.savings,
      }
      const hasExceptional =
        exceptionalTotals.income > 0 || exceptionalTotals.expenses > 0 || exceptionalTotals.savings > 0

      const highlights = computeHighlights(months, 'balance', 'income', 'expenses')
      const ordinaryHighlights = computeHighlights(months, 'ordinaryBalance', 'ordinaryIncome', 'ordinaryExpenses')

      return {
        months,
        totals,
        ordinaryTotals,
        exceptionalTotals,
        hasExceptional,
        highlights,
        ordinaryHighlights,
        // Alias retro-compatibili sui valori reali
        bestMonth: highlights.bestMonth,
        worstMonth: highlights.worstMonth,
        topIncome: highlights.topIncome,
        topExpense: highlights.topExpense,
      }
    },
  })
}
