'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getMonthDateRange } from '@/lib/utils'
import type { Transaction, TransactionFormData } from '@/types'

interface TransactionFilters {
  month?: number
  year?: number
  type?: 'income' | 'expense' | 'saving' | 'debt'
  category_id?: string
  payment_method?: string
}

export function useTransactions(filters?: TransactionFilters) {
  const currentDate = new Date()
  const month = filters?.month ?? currentDate.getMonth() + 1
  const year = filters?.year ?? currentDate.getFullYear()

  // Calculate date range for the month
  const { startDate, endDate } = getMonthDateRange(month, year)

  return useQuery({
    queryKey: ['transactions', { month, year, ...filters }],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

      if (filters?.type) {
        query = query.eq('type', filters.type)
      }

      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id)
      }

      if (filters?.payment_method) {
        query = query.eq('payment_method', filters.payment_method)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Transaction[]
    },
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Non autenticato')

      const { data: transaction, error } = await supabase
        .from('transactions')
        .insert({
          ...data,
          user_id: user.user.id,
        })
        .select()
        .single()

      if (error) throw error
      return transaction
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['monthly_kpis'] })
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TransactionFormData> }) => {
      const { data: transaction, error } = await supabase
        .from('transactions')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return transaction
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['monthly_kpis'] })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['monthly_kpis'] })
    },
  })
}

// Media robusta di una serie di valori, esclusi gli outlier (metodo IQR/Tukey).
// Con meno di 3 valori non ci sono abbastanza dati per distinguere un outlier
// da una variazione normale, quindi si usa la media semplice.
function trimmedAverage(values: number[]): number {
  if (values.length === 0) return 0
  if (values.length < 3) {
    return values.reduce((a, b) => a + b, 0) / values.length
  }
  const sorted = [...values].sort((a, b) => a - b)
  const quartile = (arr: number[], q: number) => {
    const pos = (arr.length - 1) * q
    const base = Math.floor(pos)
    const rest = pos - base
    return arr[base + 1] !== undefined ? arr[base] + rest * (arr[base + 1] - arr[base]) : arr[base]
  }
  const q1 = quartile(sorted, 0.25)
  const q3 = quartile(sorted, 0.75)
  const iqr = q3 - q1
  const lower = q1 - 1.5 * iqr
  const upper = q3 + 1.5 * iqr
  const filtered = values.filter((v) => v >= lower && v <= upper)
  const finalValues = filtered.length > 0 ? filtered : values
  return finalValues.reduce((a, b) => a + b, 0) / finalValues.length
}

// Monthly KPIs
export function useMonthlyKPIs(month?: number, year?: number) {
  const currentDate = new Date()
  const m = month ?? currentDate.getMonth() + 1
  const y = year ?? currentDate.getFullYear()

  const { startDate, endDate } = getMonthDateRange(m, y)

  const prevDate = new Date(y, m - 2, 1)
  const prevM = prevDate.getMonth() + 1
  const prevY = prevDate.getFullYear()
  const { startDate: prevStart, endDate: prevEnd } = getMonthDateRange(prevM, prevY)

  // Range dei 12 mesi precedenti (esclude il mese target), usato per stimare
  // un'entrata "attesa" finché lo stipendio del mese non è ancora registrato.
  const histStartDate = new Date(y, m - 13, 1)
  const histStartM = histStartDate.getMonth() + 1
  const histStartY = histStartDate.getFullYear()
  const { startDate: histStart } = getMonthDateRange(histStartM, histStartY)

  const daysInMonth = new Date(y, m, 0).getDate()

  return useQuery({
    queryKey: ['monthly_kpis', { month: m, year: y }],
    queryFn: async () => {
      const [curr, prev, hist] = await Promise.all([
        supabase
          .from('transactions')
          .select('type, category_id, amount')
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('transactions')
          .select('type, amount')
          .gte('date', prevStart)
          .lte('date', prevEnd),
        supabase
          .from('transactions')
          .select('date, amount')
          .eq('type', 'income')
          .gte('date', histStart)
          .lte('date', prevEnd),
      ])

      if (curr.error) throw curr.error
      if (hist.error) throw hist.error

      const categoryBreakdown: Record<string, number> = {}

      const kpis = {
        totalIncome: 0,
        totalExpenses: 0,
        totalSavings: 0,
        totalDebts: 0,
        balance: 0,
        incomePercent: 0,
        expensePercent: 0,
        savingsPercent: 0,
        prevMonthExpenses: 0,
        deltaExpensePercent: null as number | null,
        dailyAverage: 0,
        topCategoryId: null as string | null,
        categoryBreakdown,
        projectedIncome: 0,
        isIncomeEstimated: false,
      }

      curr.data?.forEach((t) => {
        const amt = Number(t.amount)
        switch (t.type) {
          case 'income':  kpis.totalIncome += amt; break
          case 'expense':
            kpis.totalExpenses += amt
            if (t.category_id) {
              categoryBreakdown[t.category_id] = (categoryBreakdown[t.category_id] || 0) + amt
            }
            break
          case 'saving':  kpis.totalSavings += amt; break
          case 'debt':    kpis.totalDebts += amt; break
        }
      })

      prev.data?.forEach((t) => {
        if (t.type === 'expense') kpis.prevMonthExpenses += Number(t.amount)
      })

      // Entrata mensile storica (media robusta degli ultimi 12 mesi, esclusi
      // outlier). Finché il mese corrente non ha entrate registrate (es. lo
      // stipendio arriva a fine mese), la si usa come entrata "attesa" per il
      // saldo netto, evitando un falso allarme di saldo negativo a metà mese.
      const monthlyIncomeMap: Record<string, number> = {}
      hist.data?.forEach((t) => {
        const key = t.date.slice(0, 7)
        monthlyIncomeMap[key] = (monthlyIncomeMap[key] || 0) + Number(t.amount)
      })
      kpis.projectedIncome = trimmedAverage(Object.values(monthlyIncomeMap))
      kpis.isIncomeEstimated = kpis.totalIncome === 0 && kpis.projectedIncome > 0

      const effectiveIncome = kpis.isIncomeEstimated ? kpis.projectedIncome : kpis.totalIncome
      kpis.balance = effectiveIncome - kpis.totalExpenses - kpis.totalSavings - kpis.totalDebts
      kpis.dailyAverage = kpis.totalExpenses / daysInMonth

      if (kpis.totalIncome > 0) {
        kpis.expensePercent = Math.round((kpis.totalExpenses / kpis.totalIncome) * 100)
        kpis.savingsPercent = Math.round((kpis.totalSavings / kpis.totalIncome) * 100)
        kpis.incomePercent = 100
      }

      if (kpis.prevMonthExpenses > 0) {
        const raw = ((kpis.totalExpenses - kpis.prevMonthExpenses) / kpis.prevMonthExpenses) * 100
        kpis.deltaExpensePercent = isNaN(raw) || !isFinite(raw) ? null : Math.round(raw)
      } else {
        kpis.deltaExpensePercent = null
      }

      let maxCat = 0
      Object.entries(categoryBreakdown).forEach(([id, amt]) => {
        if (amt > maxCat) { maxCat = amt; kpis.topCategoryId = id }
      })

      return kpis
    },
  })
}
