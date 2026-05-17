'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { IncomeCategory, ExpenseCategory, SavingCategory, ExpenseSubcategory } from '@/types'

// Fetch all categories
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
      return data as ExpenseCategory[]
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

// Create category mutations
export function useCreateIncomeCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<IncomeCategory>) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Non autenticato')

      const { data: category, error } = await supabase
        .from('income_categories')
        .insert({ ...data, user_id: user.user.id })
        .select()
        .single()

      if (error) throw error
      return category
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income_categories'] })
    },
  })
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<ExpenseCategory>) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Non autenticato')

      const { data: category, error } = await supabase
        .from('expense_categories')
        .insert({ ...data, user_id: user.user.id })
        .select()
        .single()

      if (error) throw error
      return category
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] })
    },
  })
}

export function useCreateExpenseSubcategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<ExpenseSubcategory> & { category_id: string }) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Non autenticato')

      const { data: subcategory, error } = await supabase
        .from('expense_subcategories')
        .insert({ ...data, user_id: user.user.id })
        .select()
        .single()

      if (error) throw error
      return subcategory
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] })
    },
  })
}

export function useCreateSavingCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<SavingCategory>) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Non autenticato')

      const { data: category, error } = await supabase
        .from('saving_categories')
        .insert({ ...data, user_id: user.user.id })
        .select()
        .single()

      if (error) throw error
      return category
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saving_categories'] })
    },
  })
}

// Delete category mutations
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
        .update({ is_active: false })
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

// Initialize default categories
export function useInitializeCategories() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Non autenticato')

      // Call the stored function to create default categories
      const { error } = await supabase.rpc('create_default_categories', {
        p_user_id: user.user.id
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
