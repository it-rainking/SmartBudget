'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface MonthlyAnnualData {
  month: number
  label: string
  income: number
  expenses: number
  savings: number
  balance: number
}

const MONTH_LABELS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

export function useAnnualData(year: number) {
  return useQuery({
    queryKey: ['annual_data', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount, date')
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
      }))

      data?.forEach((t) => {
        const mi = parseInt(t.date.split('-')[1]) - 1
        const amt = Number(t.amount)
        switch (t.type) {
          case 'income':  months[mi].income   += amt; break
          case 'expense': months[mi].expenses += amt; break
          case 'saving':  months[mi].savings  += amt; break
        }
      })

      months.forEach((m) => { m.balance = m.income - m.expenses - m.savings })

      const totals = months.reduce(
        (acc, m) => ({
          income:   acc.income   + m.income,
          expenses: acc.expenses + m.expenses,
          savings:  acc.savings  + m.savings,
          balance:  acc.balance  + m.balance,
        }),
        { income: 0, expenses: 0, savings: 0, balance: 0 }
      )

      const bestMonth  = [...months].sort((a, b) => b.balance  - a.balance)[0]
      const worstMonth = [...months].sort((a, b) => a.balance  - b.balance)[0]
      const topIncome  = [...months].sort((a, b) => b.income   - a.income)[0]
      const topExpense = [...months].sort((a, b) => b.expenses - a.expenses)[0]

      return { months, totals, bestMonth, worstMonth, topIncome, topExpense }
    },
  })
}
