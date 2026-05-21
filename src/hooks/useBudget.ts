'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getMonthDateRange } from '@/lib/utils'
import type { MonthlyBudget, MonthlyBudgetItem } from '@/types'

export function useMonthlyBudget(month: number, year: number) {
  return useQuery({
    queryKey: ['monthly_budget', { month, year }],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return null

      const { data, error } = await supabase
        .from('monthly_budgets')
        .select(`
          *,
          items:monthly_budget_items(*)
        `)
        .eq('user_id', user.user.id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle()

      if (error) throw error
      return data as (MonthlyBudget & { items: MonthlyBudgetItem[] }) | null
    },
  })
}

export function useEnsureMonthlyBudget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Non autenticato')

      const { data: existing } = await supabase
        .from('monthly_budgets')
        .select('id')
        .eq('user_id', user.user.id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle()

      if (existing) return existing

      const { data, error } = await supabase
        .from('monthly_budgets')
        .insert({ user_id: user.user.id, month, year })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['monthly_budget', { month: vars.month, year: vars.year }] })
    },
  })
}

export function useUpsertBudgetItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      budgetId,
      month,
      year,
      categoryType,
      categoryId,
      plannedAmount,
    }: {
      budgetId: string
      month: number
      year: number
      categoryType: 'income' | 'expense' | 'saving'
      categoryId: string
      plannedAmount: number
    }) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Non autenticato')

      const { data, error } = await supabase
        .from('monthly_budget_items')
        .upsert(
          {
            budget_id: budgetId,
            user_id: user.user.id,
            category_type: categoryType,
            category_id: categoryId,
            planned_amount: plannedAmount,
          },
          { onConflict: 'budget_id,category_type,category_id' }
        )
        .select()
        .single()

      if (error) throw error
      return { data, month, year }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['monthly_budget', { month: result.month, year: result.year }] })
    },
  })
}

export function useActualAmountsByCategory(month: number, year: number) {
  const { startDate, endDate } = getMonthDateRange(month, year)

  return useQuery({
    queryKey: ['actual_amounts', { month, year }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, category_id, amount')
        .gte('date', startDate)
        .lte('date', endDate)

      if (error) throw error

      const actuals: Record<string, number> = {}
      data?.forEach((t) => {
        actuals[t.category_id] = (actuals[t.category_id] || 0) + Number(t.amount)
      })
      return actuals
    },
  })
}
