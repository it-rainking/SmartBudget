'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ImportDiff } from '@/types/investments'

export function useImportCsv() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File): Promise<{ diff: ImportDiff; warnings: string[] }> => {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/investments/import', { method: 'POST', body: formData })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Errore durante l\'import')
      return body
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['investments_summary'] }),
  })
}
