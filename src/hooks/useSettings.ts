'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Settings } from '@/types'

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return null

      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', user.user.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }
      return data as Settings
    },
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: Partial<Omit<Settings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Non autenticato')

      const { data, error } = await supabase
        .from('settings')
        .update(updates)
        .eq('user_id', user.user.id)
        .select()
        .single()

      if (error) throw error
      return data as Settings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ initialBalance, currency }: { initialBalance: number; currency: string }) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Non autenticato')

      await supabase.rpc('create_default_categories', { p_user_id: user.user.id })

      const { data, error } = await supabase
        .from('settings')
        .update({
          initial_balance: initialBalance,
          currency,
          onboarding_completed: true,
        })
        .eq('user_id', user.user.id)
        .select()
        .single()

      if (error) throw error
      return data as Settings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['income_categories'] })
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] })
      queryClient.invalidateQueries({ queryKey: ['saving_categories'] })
    },
  })
}
