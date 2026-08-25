'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { clampDayInMonth, getMonthDateRange } from '@/lib/utils'
import type { RecurringExpense, RecurringExpenseFormData } from '@/types'

export function useRecurringExpenses() {
  return useQuery({
    queryKey: ['recurring_expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*, category:expense_categories(*), subcategory:expense_subcategories(*)')
        .order('name')

      if (error) throw error
      return data as unknown as RecurringExpense[]
    },
  })
}

export function useCreateRecurringExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: RecurringExpenseFormData) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Non autenticato')

      const { data: created, error } = await supabase
        .from('recurring_expenses')
        .insert({ ...data, user_id: user.user.id })
        .select()
        .single()

      if (error) throw error
      return created as RecurringExpense
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] })
    },
  })
}

export function useUpdateRecurringExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RecurringExpenseFormData> }) => {
      const { data: updated, error } = await supabase
        .from('recurring_expenses')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return updated as RecurringExpense
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] })
    },
  })
}

export function useDeleteRecurringExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] })
      // Le transazioni già generate restano (recurring_expense_id → NULL via
      // ON DELETE SET NULL), ma il badge/collegamento va aggiornato in UI.
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

// Genera, per uno specifico mese/anno, le occorrenze mancanti di tutti i
// modelli attivi già iniziati (start_date <= fine del mese): una transazione
// di tipo 'expense' per ciascun modello che non ha già un'occorrenza in quel
// mese. Ritorna il numero di transazioni create.
async function generateOccurrencesForMonth(userId: string, month: number, year: number): Promise<number> {
  const { startDate, endDate } = getMonthDateRange(month, year)

  const { data: templates, error: templatesError } = await supabase
    .from('recurring_expenses')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .lte('start_date', endDate)

  if (templatesError) throw templatesError
  if (!templates || templates.length === 0) return 0

  const { data: existing, error: existingError } = await supabase
    .from('transactions')
    .select('recurring_expense_id')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .not('recurring_expense_id', 'is', null)

  if (existingError) throw existingError
  const existingIds = new Set((existing ?? []).map((t) => t.recurring_expense_id))

  const toInsert = templates
    .filter((t) => !existingIds.has(t.id))
    .map((t) => ({
      user_id: userId,
      type: 'expense' as const,
      category_id: t.category_id,
      subcategory_id: t.subcategory_id,
      amount: t.amount,
      date: clampDayInMonth(t.day_of_month, month, year),
      description: t.name,
      payment_method: t.payment_method,
      notes: t.notes,
      is_recurring: true,
      recurring_expense_id: t.id,
    }))

  if (toInsert.length === 0) return 0

  const { error: insertError } = await supabase.from('transactions').insert(toInsert)
  if (insertError) throw insertError
  return toInsert.length
}

// Genera le occorrenze del mese corrente per tutti i modelli attivi. Pensata
// per essere chiamata ad ogni apertura dell'app (vedi DashboardLayout): così
// le spese ricorrenti "si propagano in avanti" senza bisogno di un cron.
export function useEnsureCurrentMonthRecurring() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return 0

      const now = new Date()
      return generateOccurrencesForMonth(user.user.id, now.getMonth() + 1, now.getFullYear())
    },
    onSuccess: (createdCount) => {
      if (createdCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        queryClient.invalidateQueries({ queryKey: ['monthly_kpis'] })
        queryClient.invalidateQueries({ queryKey: ['installment_plans'] })
      }
    },
  })
}

// Genera arretrati: crea le occorrenze mancanti per ciascuno degli ultimi
// `monthsBack` mesi (mese corrente escluso). Ritorna il totale creato.
export function useGenerateRecurringBackfill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (monthsBack: number) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Non autenticato')

      const now = new Date()
      let total = 0
      for (let i = 1; i <= monthsBack; i++) {
        const target = new Date(now.getFullYear(), now.getMonth() - i, 1)
        total += await generateOccurrencesForMonth(user.user.id, target.getMonth() + 1, target.getFullYear())
      }
      return total
    },
    onSuccess: (createdCount) => {
      if (createdCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        queryClient.invalidateQueries({ queryKey: ['monthly_kpis'] })
        queryClient.invalidateQueries({ queryKey: ['installment_plans'] })
      }
    },
  })
}
