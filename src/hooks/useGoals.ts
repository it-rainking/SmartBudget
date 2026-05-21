'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Goal } from '@/types'
import type { InsertTables } from '@/types/database'

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Goal[]
    },
  })
}

export function useCreateGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<InsertTables<'goals'>, 'user_id'>) => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Non autenticato')

      const { data: goal, error } = await supabase
        .from('goals')
        .insert({ ...data, user_id: auth.user.id })
        .select()
        .single()

      if (error) throw error
      return goal as Goal
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useAddGoalProgress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, amount, currentAmount }: { id: string; amount: number; currentAmount: number }) => {
      const newAmount = currentAmount + amount
      const { data, error } = await supabase
        .from('goals')
        .update({ current_amount: newAmount })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Goal
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useCompleteGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, targetAmount }: { id: string; targetAmount: number }) => {
      const { data, error } = await supabase
        .from('goals')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          current_amount: targetAmount,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Goal
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useDeleteGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  })
}
