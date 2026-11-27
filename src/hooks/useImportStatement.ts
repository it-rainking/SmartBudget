'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { addDays } from '@/lib/utils'
import { isSelected, type CategoryKey, type ExistingTransaction, type ReviewItem, type StatementCandidate } from '@/lib/import'

const PAGE = 1000
const MARGIN_DAYS = 3
const MIGRATION_HINT = 'Esegui prima la migrazione supabase/migrate_import_source.sql nel SQL Editor di Supabase'

type TxType = 'income' | 'expense' | 'saving'
const CATEGORY_TABLE = { income: 'income_categories', expense: 'expense_categories', saving: 'saving_categories' } as const

const CATEGORY_DEFAULTS: Record<CategoryKey, { name: string; icon: string; color: string }> = {
  investimenti: { name: 'Investimenti', icon: '📈', color: '#10b981' },
  satispay: { name: 'Satispay', icon: '📱', color: '#ef4444' },
}

/**
 * Transazioni dell'utente nel periodo dell'estratto (±3 giorni), per il
 * confronto doppioni. Paginata: l'API restituisce al massimo 1000 righe.
 */
export async function fetchExistingForImport(candidates: StatementCandidate[]): Promise<ExistingTransaction[]> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Non autenticato')
  if (candidates.length === 0) return []

  const dates = candidates.map(c => c.date).sort()
  const from = addDays(dates[0], -MARGIN_DAYS)
  const to = addDays(dates[dates.length - 1], MARGIN_DAYS)

  const out: ExistingTransaction[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, date, amount, type, description, external_id, installment_plan_id')
      .eq('user_id', auth.user.id)
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) {
      if (error.code === '42703' || /external_id/.test(error.message)) throw new Error(MIGRATION_HINT)
      throw error
    }
    out.push(...(data ?? []).map(t => ({ ...t, amount: Number(t.amount) })))
    if (!data || data.length < PAGE) break
  }
  return out
}

/** Id della categoria con quel nome (case-insensitive), creata se manca. */
async function ensureCategory(userId: string, type: TxType, key: CategoryKey): Promise<string | null> {
  const table = CATEGORY_TABLE[type]
  const def = CATEGORY_DEFAULTS[key]
  const { data: found } = await supabase
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .ilike('name', def.name)
    .limit(1)
  if (found && found.length > 0) return found[0].id
  const { data: created, error } = await supabase
    .from(table)
    .insert({ user_id: userId, name: def.name, icon: def.icon, color: def.color, sort_order: 99 })
    .select('id')
    .single()
  if (error) return null
  return created.id
}

export interface ImportStatementInput {
  items: ReviewItem[]
  included: ReadonlySet<string>
}

export interface ImportStatementResult {
  inserted: number
  replaced: number
  alreadyPresent: number
}

export function useImportStatement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ items, included }: ImportStatementInput): Promise<ImportStatementResult> => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Non autenticato')
      const userId = auth.user.id

      const selected = items.filter(i => isSelected(i, included))
      const toInsert = selected.filter(i => !(i.match && i.decision === 'replace'))
      const toReplace = selected.filter(i => i.match && i.decision === 'replace')

      // Categorie concordate (Investimenti, Satispay), create al primo uso.
      const categoryIds = new Map<string, string | null>()
      for (const item of toInsert) {
        if (!item.categoryKey) continue
        const k = `${item.type}|${item.categoryKey}`
        if (!categoryIds.has(k)) categoryIds.set(k, await ensureCategory(userId, item.type, item.categoryKey))
      }

      const { data: uncat } = await supabase
        .from('expense_categories')
        .select('id')
        .eq('user_id', userId)
        .eq('name', 'Non categorizzato')
        .maybeSingle()
      const uncatId = uncat?.id ?? null

      const rows = toInsert.map(i => ({
        user_id: userId,
        date: i.date,
        type: i.type,
        amount: i.amount,
        description: i.description || null,
        payment_method: i.payment_method,
        category_id: (i.categoryKey ? categoryIds.get(`${i.type}|${i.categoryKey}`) : null)
          ?? (i.type === 'expense' ? uncatId : null),
        import_source: i.source,
        external_id: i.external_id,
        is_exceptional: false,
      }))

      let inserted = 0
      for (let k = 0; k < rows.length; k += 500) {
        const { data, error } = await supabase
          .from('transactions')
          .upsert(rows.slice(k, k + 500), { onConflict: 'user_id,external_id', ignoreDuplicates: true })
          .select('id')
        if (error) {
          if (error.code === '42703' || error.code === 'PGRST204' || error.code === '42P10') throw new Error(MIGRATION_HINT)
          throw error
        }
        inserted += data?.length ?? 0
      }

      // "Sostituisci": la riga esistente prende i dati della banca e
      // conserva categoria, note e tag scelti dall'utente.
      let replaced = 0
      for (const i of toReplace) {
        const { error } = await supabase
          .from('transactions')
          .update({
            date: i.date,
            amount: i.amount,
            description: i.description || null,
            import_source: i.source,
            external_id: i.external_id,
          })
          .eq('id', i.match!.id)
          .eq('user_id', userId)
        if (error) throw error
        replaced++
      }

      return { inserted, replaced, alreadyPresent: rows.length - inserted }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['monthly_kpis'] })
      queryClient.invalidateQueries({ queryKey: ['annual_data'] })
      queryClient.invalidateQueries({ queryKey: ['income_categories'] })
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] })
      queryClient.invalidateQueries({ queryKey: ['saving_categories'] })
    },
  })
}
