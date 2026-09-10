'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
