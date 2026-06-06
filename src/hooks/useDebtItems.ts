'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DebtItem } from '@/types'

export interface DebtItemFormData {
  name: string
  description?: string | null
  total_amount: number
  remaining_amount: number
  interest_rate?: number | null
  monthly_payment?: number | null
  start_date?: string | null
  due_date?: string | null
}

export function useDebtItems() {
  return useQuery({
    queryKey: ['debt_items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_items')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as DebtItem[]
    },
  })
}

export function useCreateDebtItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: DebtItemFormData) => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Non autenticato')
      const { data, error } = await supabase
        .from('debt_items')
        .insert({ ...formData, user_id: auth.user.id })
        .select()
        .single()
      if (error) throw error
      return data as DebtItem
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['debt_items'] }),
  })
}

export function useUpdateDebtItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DebtItemFormData> }) => {
      const { data: updated, error } = await supabase
        .from('debt_items')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return updated as DebtItem
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['debt_items'] }),
  })
}

export function useDeleteDebtItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('debt_items')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['debt_items'] }),
  })
}

// ─── Calcoli strategie ────────────────────────────────────────────────────────

/** Mesi necessari per estinguere un debito con rata fissa (approx.) */
export function monthsToPayoff(remaining: number, monthlyPayment: number, annualRate: number): number {
  if (monthlyPayment <= 0) return Infinity
  const r = annualRate / 100 / 12
  if (r === 0) return Math.ceil(remaining / monthlyPayment)
  if (monthlyPayment <= remaining * r) return Infinity
  return Math.ceil(-Math.log(1 - (remaining * r) / monthlyPayment) / Math.log(1 + r))
}

/** Interesse totale pagato nel periodo */
export function totalInterest(remaining: number, monthlyPayment: number, annualRate: number): number {
  const months = monthsToPayoff(remaining, monthlyPayment, annualRate)
  if (!isFinite(months)) return Infinity
  return Math.max(0, monthlyPayment * months - remaining)
}
