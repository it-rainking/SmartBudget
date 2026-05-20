'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { InsertTables } from '@/types/database'
import type { IncomeCategory, ExpenseCategory, SavingCategory, ExpenseSubcategory } from '@/types'

export function useIncomeCategories() {
  return useQuery({
    queryKey: ['income_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('income_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      if (error) throw error
      return data as IncomeCategory[]
    },
  })
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select(`
          *,
          subcategories:expense_subcategories(*)
        `)
        .eq('is_active', true)
        .order('sort_order')

      if (error) throw error
      return data as unknown as ExpenseCategory[]
    },
  })
}

export function useSavingCategories() {
  return useQuery({
    queryKey: ['saving_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saving_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      if (error) throw error
      return data as SavingCategory[]
    },
  })
}

export function useCreateIncomeCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<InsertTables<'income_categories'>, 'user_id'>) => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Non autenticato')

      const { data: category, error } = await supabase
        .from('income_categories')
        .insert({ ...data, user_id: auth.user.id })
        .select()
        .single()

      if (error) throw error
      return category as IncomeCategory
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income_categories'] })
    },
  })
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<InsertTables<'expense_categories'>, 'user_id'>) => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Non autenticato')

      const { data: category, error } = await supabase
        .from('expense_categories')
        .insert({ ...data, user_id: auth.user.id })
        .select()
        .single()

      if (error) throw error
      return category as ExpenseCategory
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] })
    },
  })
}

export function useCreateExpenseSubcategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<InsertTables<'expense_subcategories'>, 'user_id'>) => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Non autenticato')

      const { data: subcategory, error } = await supabase
        .from('expense_subcategories')
        .insert({ ...data, user_id: auth.user.id })
        .select()
        .single()

      if (error) throw error
      return subcategory as ExpenseSubcategory
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] })
    },
  })
}

export function useCreateSavingCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<InsertTables<'saving_categories'>, 'user_id'>) => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Non autenticato')

      const { data: category, error } = await supabase
        .from('saving_categories')
        .insert({ ...data, user_id: auth.user.id })
        .select()
        .single()

      if (error) throw error
      return category as SavingCategory
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saving_categories'] })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ type, id }: { type: 'income' | 'expense' | 'saving' | 'subcategory'; id: string }) => {
      const table = type === 'income' ? 'income_categories'
        : type === 'expense' ? 'expense_categories'
        : type === 'saving' ? 'saving_categories'
        : 'expense_subcategories'

      const { error } = await supabase
        .from(table)
        .update({ is_active: false } as never)
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income_categories'] })
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] })
      queryClient.invalidateQueries({ queryKey: ['saving_categories'] })
    },
  })
}

export function useInitializeCategories() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Non autenticato')

      const { error } = await supabase.rpc('create_default_categories', {
        p_user_id: auth.user.id,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income_categories'] })
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] })
      queryClient.invalidateQueries({ queryKey: ['saving_categories'] })
    },
  })
}
