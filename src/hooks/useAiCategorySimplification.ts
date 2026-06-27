'use client'

import { useMutation } from '@tanstack/react-query'

export type SuggestionType = 'merge' | 'rename' | 'split' | 'create'
export type CategoryType = 'expense' | 'income' | 'saving'
export type SuggestionPriority = 'high' | 'medium' | 'low'

export interface CategorySuggestion {
  type: SuggestionType
  category_type: CategoryType
  priority: SuggestionPriority
  reason: string
  // merge
  category_ids?: string[]
  category_names?: string[]
  // rename + split
  category_id?: string
  current_name?: string
  // merge + rename + create
  suggested_name?: string
  suggested_icon?: string
  // split
  suggested_names?: { name: string; icon?: string }[]
  // create
  example_descriptions?: string[]
}

export interface SimplifyCategoriesResult {
  suggestions: CategorySuggestion[]
  analyzed_transactions: number
  analyzed_categories: number
}

export function useAiCategorySimplification() {
  return useMutation({
    mutationFn: async (): Promise<SimplifyCategoriesResult> => {
      const res = await fetch('/api/ai/simplify-categories', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Errore sconosciuto')
      }
      return res.json()
    },
  })
}
