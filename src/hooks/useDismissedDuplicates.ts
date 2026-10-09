'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Coppie di transazioni confermate dall'utente come "non doppioni".
// Sorgente principale: tabella `dismissed_duplicates` (sincronizzata tra
// dispositivi). Finché la migrazione non è stata eseguita si ripiega su
// localStorage, così il controllo funziona comunque nel browser corrente.

const LOCAL_KEY = 'smartbudget:dismissed-duplicates'
const QUERY_KEY = ['dismissed_duplicates']

export interface DismissedDuplicates {
  keys: Set<string>
  /** false = tabella assente, le conferme valgono solo in questo browser */
  synced: boolean
}

function readLocal(): string[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeLocal(keys: Iterable<string>) {
  try {
    const list = [...keys]
    if (list.length) window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
    else window.localStorage.removeItem(LOCAL_KEY)
  } catch {}
}

// Tabella non ancora creata: PGRST205 (schema cache PostgREST) o 42P01 (Postgres)
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205' || error?.code === '42P01'
}

function splitKey(key: string) {
  const [transaction_a, transaction_b] = key.split('|')
  return { transaction_a, transaction_b }
}

export function useDismissedDuplicates() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<DismissedDuplicates> => {
      const { data, error } = await supabase
        .from('dismissed_duplicates')
        .select('transaction_a, transaction_b')
      if (isMissingTable(error)) return { keys: new Set(readLocal()), synced: false }
      if (error) throw new Error(error.message)

      const keys = new Set((data ?? []).map(r => `${r.transaction_a}|${r.transaction_b}`))

      // Conferme salvate nel browser prima della migrazione: si portano nel DB
      // una alla volta (una transazione eliminata nel frattempo farebbe fallire
      // un insert unico per vincolo di chiave esterna).
      const pending = readLocal().filter(k => !keys.has(k))
      if (pending.length) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const results = await Promise.all(pending.map(k =>
            supabase.from('dismissed_duplicates').insert({ user_id: user.id, ...splitKey(k) })
          ))
          results.forEach((r, i) => { if (!r.error) keys.add(pending[i]) })
          writeLocal([])
        }
      }
      return { keys, synced: true }
    },
  })
}

export function useDismissDuplicates() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ keys, synced }: { keys: string[]; synced: boolean }) => {
      if (keys.length === 0) return
      if (!synced) {
        writeLocal(new Set([...readLocal(), ...keys]))
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessione scaduta: rifai il login.')
      const { error } = await supabase.from('dismissed_duplicates').upsert(
        keys.map(k => ({ user_id: user.id, ...splitKey(k) })),
        { onConflict: 'user_id,transaction_a,transaction_b', ignoreDuplicates: true }
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useRestoreDuplicates() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ keys, synced }: { keys: string[]; synced: boolean }) => {
      if (keys.length === 0) return
      if (!synced) {
        const remove = new Set(keys)
        writeLocal(readLocal().filter(k => !remove.has(k)))
        return
      }
      const results = await Promise.all(keys.map(k => {
        const { transaction_a, transaction_b } = splitKey(k)
        return supabase.from('dismissed_duplicates').delete()
          .eq('transaction_a', transaction_a)
          .eq('transaction_b', transaction_b)
      }))
      const failed = results.find(r => r.error)
      if (failed?.error) throw new Error(failed.error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
