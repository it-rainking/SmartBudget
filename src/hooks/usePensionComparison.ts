'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DEFAULT_PENSION_PARAMS, normalizeParams, type PensionParams } from '@/lib/pension/compare'

// Dati inseriti nel confronto fondo pensione. Sorgente principale: tabella
// `pension_comparisons` (una riga per utente, sincronizzata tra dispositivi).
// Finché la migrazione non è stata eseguita si ripiega su localStorage.
// La prima versione dello strumento (HTML in iframe) salvava in
// `fp-confronto-params`: quei dati vengono ripresi una volta e poi rimossi.

const LOCAL_KEY = 'smartbudget:pension-comparison'
const LEGACY_KEY = 'fp-confronto-params'
const QUERY_KEY = ['pension_comparison']

export interface PensionComparisonState {
  params: PensionParams
  /** false = tabella assente, i dati valgono solo in questo browser */
  synced: boolean
}

function readLocal(): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY) ?? window.localStorage.getItem(LEGACY_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writeLocal(params: PensionParams | null) {
  try {
    window.localStorage.removeItem(LEGACY_KEY)
    if (params) window.localStorage.setItem(LOCAL_KEY, JSON.stringify(params))
    else window.localStorage.removeItem(LOCAL_KEY)
  } catch {}
}

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205' || error?.code === '42P01'
}

async function currentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sessione scaduta: rifai il login.')
  return user.id
}

export function usePensionComparison() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<PensionComparisonState> => {
      const { data, error } = await supabase
        .from('pension_comparisons')
        .select('params')
        .maybeSingle()
      if (isMissingTable(error)) return { params: normalizeParams(readLocal()), synced: false }
      if (error) throw new Error(error.message)
      if (data) return { params: normalizeParams(data.params), synced: true }

      // Nessuna riga: si portano nel DB i dati salvati nel browser, se ci sono
      const local = readLocal()
      if (!local) return { params: { ...DEFAULT_PENSION_PARAMS }, synced: true }
      const params = normalizeParams(local)
      const { error: insertError } = await supabase
        .from('pension_comparisons')
        .upsert({ user_id: await currentUserId(), params: { ...params } })
      if (!insertError) writeLocal(null)
      return { params, synced: true }
    },
  })
}

/** Salva i parametri (null = azzera). Aggiorna subito la cache: la pagina ricalcola senza attendere il DB. */
export function useSavePensionComparison() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ params, synced }: { params: PensionParams | null; synced: boolean }) => {
      if (!synced) {
        writeLocal(params)
        return
      }
      const userId = await currentUserId()
      const { error } = params
        ? await supabase.from('pension_comparisons').upsert({ user_id: userId, params: { ...params }, updated_at: new Date().toISOString() })
        : await supabase.from('pension_comparisons').delete().eq('user_id', userId)
      if (error) throw new Error(error.message)
    },
    onMutate: ({ params, synced }) => {
      queryClient.setQueryData<PensionComparisonState>(QUERY_KEY, { params: params ?? { ...DEFAULT_PENSION_PARAMS }, synced })
    },
    onError: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
