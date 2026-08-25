'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { clampDayInMonth, getMonthDateRange } from '@/lib/utils'
import { groupRecurringCandidates, CANDIDATE_MIN_MONTHS } from '@/lib/recurring/detectCandidates'
import type { RecurringCandidateGroup } from '@/lib/recurring/detectCandidates'
import type { RecurringExpense, RecurringExpenseFormData } from '@/types'

export { CANDIDATE_MIN_MONTHS }
export type { RecurringCandidateGroup }

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

// ── Import una tantum da transazioni esistenti ──────────────────────────────
// Strumento pensato per popolare il pannello a partire dallo storico: cerca le
// transazioni già segnate "ricorrente" dal semplice toggle del form (prima che
// esistesse questo pannello) ma non ancora collegate a un modello, le
// raggruppa per candidati plausibili e permette di crearne i modelli. Non è
// pensato per restare in uso continuativo: può essere nascosto togliendo
// SHOW_IMPORT_TOOL in spese-ricorrenti/page.tsx una volta usato.

// Cerca fra le transazioni di tipo 'expense' non ancora collegate a nessun
// modello (recurring_expense_id NULL) quelle che sembrano ricorrenti, e le
// raggruppa per candidati plausibili. Non scrive nulla: la creazione avviene
// solo dopo conferma dell'utente tramite useImportRecurringCandidate.
export function useDetectRecurringCandidates() {
  return useMutation({
    mutationFn: async (): Promise<RecurringCandidateGroup[]> => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return []

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('id, category_id, amount, date, description, payment_method, is_recurring, is_exceptional, installment_plan_id')
        .eq('user_id', user.user.id)
        .eq('type', 'expense')
        .is('recurring_expense_id', null)
        .order('date', { ascending: true })

      if (error) throw error
      if (!transactions || transactions.length === 0) return []

      return groupRecurringCandidates(transactions)
    },
  })
}

// Crea il modello per un candidato rilevato e ci collega retroattivamente le
// transazioni del gruppo (così non vengono ri-proposte a un futuro rilancio
// dello strumento, e smettono di generare falsi "simili" nel form transazioni).
export function useImportRecurringCandidate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      name,
      categoryId,
      amount,
      dayOfMonth,
      startDate,
      paymentMethod,
      transactionIds,
    }: {
      name: string
      categoryId: string | null
      amount: number
      dayOfMonth: number
      startDate: string
      paymentMethod: string | null
      transactionIds: string[]
    }) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Non autenticato')

      const { data: created, error: createError } = await supabase
        .from('recurring_expenses')
        .insert({
          user_id: user.user.id,
          name,
          category_id: categoryId ?? undefined,
          amount,
          day_of_month: dayOfMonth,
          payment_method: paymentMethod ?? undefined,
          start_date: startDate,
        })
        .select()
        .single()

      if (createError) throw createError

      const { error: linkError } = await supabase
        .from('transactions')
        .update({ recurring_expense_id: created.id })
        .in('id', transactionIds)

      if (linkError) throw linkError
      return created as RecurringExpense
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
