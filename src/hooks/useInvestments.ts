'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ImportDiff, InvestmentSummary } from '@/types/investments'

// Le API route possono rispondere con HTML (500 del framework, pagina di
// login del proxy, timeout): senza questo wrapper res.json() esplode con un
// "Unexpected token <" e l'utente non vede mai l'errore reale.
async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { error: `Risposta non valida dal server (HTTP ${res.status}).` }
  }
}

function errorMessage(body: Record<string, unknown>, fallback: string): string {
  return typeof body.error === 'string' && body.error ? body.error : fallback
}

export function useInvestments() {
  return useQuery({
    queryKey: ['investments_summary'],
    queryFn: async (): Promise<InvestmentSummary> => {
      const res = await fetch('/api/investments/summary')
      const body = await readJson(res)
      if (!res.ok) throw new Error(errorMessage(body, 'Errore nel caricamento del portafoglio'))
      return body as unknown as InvestmentSummary
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useImportCsv() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File): Promise<{ diff: ImportDiff; warnings: string[] }> => {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/investments/import', { method: 'POST', body: formData })
      const body = await readJson(res)
      if (!res.ok) throw new Error(errorMessage(body, `Errore durante l'import (HTTP ${res.status}).`))
      return body as unknown as { diff: ImportDiff; warnings: string[] }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['investments_summary'] }),
  })
}

export interface ManualPriceInput {
  assetId: string
  price: number
  pricedAt: string
  note?: string | null
}

// Prezzi inseriti a mano per le posizioni senza quotazione automatica (tipico:
// titoli di stato sul MOT). Scrive direttamente via client browser come gli
// altri hook di dominio: la tabella è per-utente e protetta da RLS, non serve
// passare da una API route.
//
// L'input è un array anche quando la riga è una sola: l'aggiornamento
// periodico riguarda tutte le posizioni insieme, e un solo upsert evita che
// metà dei prezzi entri e metà no se la connessione cade a metà strada.
export function useSetManualPrices() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (inputs: ManualPriceInput[]) => {
      if (inputs.length === 0) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessione scaduta: rifai il login.')

      const now = new Date().toISOString()
      const { error } = await supabase.from('manual_prices').upsert(
        inputs.map((input) => ({
          user_id: user.id,
          asset_id: input.assetId,
          price: input.price,
          priced_at: input.pricedAt,
          note: input.note ?? null,
          updated_at: now,
        })),
        { onConflict: 'user_id,asset_id' }
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['investments_summary'] }),
  })
}

export function useDeleteManualPrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (assetId: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessione scaduta: rifai il login.')

      const { error } = await supabase
        .from('manual_prices')
        .delete()
        .eq('user_id', user.id)
        .eq('asset_id', assetId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['investments_summary'] }),
  })
}
