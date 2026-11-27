'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { addDays } from '@/lib/utils'
import { findImportedInstallmentDuplicates, INSTALLMENT_IMPORT_TOLERANCE_DAYS } from '@/lib/installments'
import type { ParsedTransaction } from '@/lib/importParsers'
import { fetchAllRows } from '@/lib/supabaseFetchAll'

// ─── Import Mutation ───────────────────────────────────────────────────────────

export function useImportTransactions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (rows: ParsedTransaction[]): Promise<{ inserted: number; skipped: number }> => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Non autenticato')

      // Recupera la categoria "Non categorizzato" per le spese senza categoria
      const { data: uncatCategory } = await supabase
        .from('expense_categories')
        .select('id')
        .eq('user_id', auth.user.id)
        .eq('name', 'Non categorizzato')
        .maybeSingle()
      const uncatId = uncatCategory?.id ?? null

      // Rilevamento duplicati: query transazioni esistenti nell'intervallo di date delle righe
      const dates = rows.map(r => r.date)
      const minDate = dates.reduce((a, b) => (a < b ? a : b))
      const maxDate = dates.reduce((a, b) => (a > b ? a : b))

      const userId = auth.user.id
      const existing = await fetchAllRows((from, to) =>
        supabase
          .from('transactions')
          .select('date, amount, description')
          .eq('user_id', userId)
          .gte('date', minDate)
          .lte('date', maxDate)
          .order('id')
          .range(from, to)
      )

      const existingKeys = new Set(
        existing.map(t =>
          `${t.date}|${t.amount}|${(t.description ?? '').toLowerCase().trim()}`
        )
      )

      // Le rate PayPal registrate dal form ricompaiono nell'estratto conto con
      // un'altra descrizione e qualche giorno di scarto: vanno riconosciute a
      // parte, altrimenti la stessa rata verrebbe contata due volte.
      const existingInstallments = await fetchAllRows((from, to) =>
        supabase
          .from('transactions')
          .select('id, date, amount, type')
          .eq('user_id', userId)
          .not('installment_plan_id', 'is', null)
          .gte('date', addDays(minDate, -INSTALLMENT_IMPORT_TOLERANCE_DAYS))
          .lte('date', addDays(maxDate, INSTALLMENT_IMPORT_TOLERANCE_DAYS))
          .order('id')
          .range(from, to)
      )

      const exactUnique = rows.filter(r => {
        const key = `${r.date}|${r.amount}|${r.description.toLowerCase().trim()}`
        return !existingKeys.has(key)
      })
      const installmentDuplicates = findImportedInstallmentDuplicates(
        exactUnique,
        existingInstallments.map(t => ({ ...t, amount: Number(t.amount) }))
      )
      const unique = exactUnique.filter((_, i) => !installmentDuplicates.has(i))

      if (unique.length === 0) return { inserted: 0, skipped: rows.length }

      const inserts = unique.map(r => ({
        user_id: auth.user!.id,
        date: r.date,
        type: r.type,
        amount: r.amount,
        description: r.description || null,
        payment_method: r.payment_method || null,
        // Usa category_id se fornita dal CSV/AI, altrimenti fallback alla categoria default
        category_id: r.category_id !== undefined
          ? r.category_id
          : (r.type === 'expense' ? uncatId : null),
        subcategory_id: r.subcategory_id ?? null,
        tags: r.tags ?? null,
        notes: r.notes ?? null,
        is_exceptional: r.is_exceptional ?? false,
      }))

      const { error } = await supabase.from('transactions').insert(inserts)
      if (error) throw error

      return { inserted: unique.length, skipped: rows.length - unique.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['monthly_kpis'] })
      queryClient.invalidateQueries({ queryKey: ['annual_data'] })
    },
  })
}
