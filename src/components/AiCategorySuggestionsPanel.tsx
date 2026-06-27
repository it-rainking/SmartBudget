'use client'

import { useState } from 'react'
import { Wand2, X, RefreshCw, GitMerge, Pencil, Scissors, Plus } from 'lucide-react'
import {
  useAiCategorySimplification,
  type CategorySuggestion,
  type SuggestionType,
} from '@/hooks/useAiCategorySimplification'
import { useToast } from '@/components/Toast'

const TYPE_LABELS: Record<SuggestionType, string> = {
  merge: 'Unifica',
  rename: 'Rinomina',
  split: 'Dividi',
  create: 'Crea',
}

const TYPE_ICONS: Record<SuggestionType, React.ReactNode> = {
  merge: <GitMerge size={13} />,
  rename: <Pencil size={13} />,
  split: <Scissors size={13} />,
  create: <Plus size={13} />,
}

const TYPE_COLORS: Record<SuggestionType, string> = {
  merge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  rename: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  split: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta priorità',
  medium: 'Media',
  low: 'Bassa',
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-zinc-400 dark:text-zinc-500',
}

const CAT_TYPE_LABELS: Record<string, string> = {
  expense: 'Spese',
  income: 'Entrate',
  saving: 'Risparmi',
}

function SuggestionCard({
  suggestion,
  onDismiss,
}: {
  suggestion: CategorySuggestion
  onDismiss: () => void
}) {
  return (
    <div className="flex gap-3 p-3.5 rounded-lg border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[suggestion.type]}`}>
            {TYPE_ICONS[suggestion.type]}
            {TYPE_LABELS[suggestion.type]}
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{CAT_TYPE_LABELS[suggestion.category_type]}</span>
          <span className={`text-xs font-medium ${PRIORITY_COLORS[suggestion.priority]}`}>
            · {PRIORITY_LABELS[suggestion.priority]}
          </span>
        </div>

        <SuggestionDetail suggestion={suggestion} />

        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
          {suggestion.reason}
        </p>
      </div>

      <button
        onClick={onDismiss}
        className="flex-shrink-0 mt-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        aria-label="Ignora suggerimento"
      >
        <X size={15} />
      </button>
    </div>
  )
}

function SuggestionDetail({ suggestion }: { suggestion: CategorySuggestion }) {
  switch (suggestion.type) {
    case 'merge':
      return (
        <p className="text-sm text-zinc-700 dark:text-zinc-200">
          Unisci{' '}
          <span className="font-medium">
            {(suggestion.category_names ?? []).map((n, i) => (
              <span key={i}>
                {i > 0 && ' + '}
                &quot;{n}&quot;
              </span>
            ))}
          </span>
          {suggestion.suggested_name && (
            <> → <span className="font-medium text-blue-600 dark:text-blue-400">&quot;{suggestion.suggested_name}&quot;</span>{suggestion.suggested_icon && ` ${suggestion.suggested_icon}`}</>
          )}
        </p>
      )

    case 'rename':
      return (
        <p className="text-sm text-zinc-700 dark:text-zinc-200">
          <span className="font-medium line-through text-zinc-400">&quot;{suggestion.current_name}&quot;</span>
          {' → '}
          <span className="font-medium text-amber-600 dark:text-amber-400">&quot;{suggestion.suggested_name}&quot;</span>
          {suggestion.suggested_icon && ` ${suggestion.suggested_icon}`}
        </p>
      )

    case 'split':
      return (
        <p className="text-sm text-zinc-700 dark:text-zinc-200">
          Dividi <span className="font-medium">&quot;{suggestion.current_name}&quot;</span> in{' '}
          {(suggestion.suggested_names ?? []).map((s, i) => (
            <span key={i}>
              {i > 0 && ' + '}
              <span className="font-medium text-purple-600 dark:text-purple-400">
                &quot;{s.name}&quot;{s.icon ? ` ${s.icon}` : ''}
              </span>
            </span>
          ))}
        </p>
      )

    case 'create':
      return (
        <div>
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            Crea categoria{' '}
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              &quot;{suggestion.suggested_name}&quot;{suggestion.suggested_icon ? ` ${suggestion.suggested_icon}` : ''}
            </span>
          </p>
          {suggestion.example_descriptions?.length ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              Es: {suggestion.example_descriptions.slice(0, 3).map(d => `"${d}"`).join(', ')}
            </p>
          ) : null}
        </div>
      )
  }
}

export function AiCategorySuggestionsPanel() {
  const { showToast } = useToast()
  const mutation = useAiCategorySimplification()
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())

  async function handleAnalyze() {
    setDismissed(new Set())
    try {
      await mutation.mutateAsync()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore analisi AI', 'error')
    }
  }

  const suggestions = mutation.data?.suggestions ?? []
  const visible = suggestions.filter((_, i) => !dismissed.has(i))
  const hasResult = mutation.isSuccess

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide flex items-center gap-1.5">
            <Wand2 size={14} className="text-emerald-500" />
            Ottimizzazione Categorie AI
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Analizza le tue transazioni recenti e suggerisce come semplificare le categorie
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={mutation.isPending}
          className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
        >
          {mutation.isPending ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              Analisi...
            </>
          ) : (
            <>
              <Wand2 size={13} />
              {hasResult ? 'Rianalizza' : 'Analizza'}
            </>
          )}
        </button>
      </div>

      {mutation.isPending && (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-700 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {hasResult && !mutation.isPending && (
        <>
          {mutation.data && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">
              Analizzate {mutation.data.analyzed_transactions} transazioni su {mutation.data.analyzed_categories} categorie
            </p>
          )}

          {visible.length > 0 ? (
            <div className="space-y-2">
              {suggestions.map((s, i) =>
                dismissed.has(i) ? null : (
                  <SuggestionCard
                    key={i}
                    suggestion={s}
                    onDismiss={() => setDismissed(prev => new Set([...prev, i]))}
                  />
                )
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-zinc-400 dark:text-zinc-500">
              <Wand2 size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                {suggestions.length === 0
                  ? 'Nessun suggerimento — le tue categorie sembrano già ben organizzate!'
                  : 'Tutti i suggerimenti sono stati revisionati.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
