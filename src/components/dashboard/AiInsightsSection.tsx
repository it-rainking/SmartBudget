'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Section } from '@/components/ui'
import { classNames } from '@/lib/utils'

interface AiInsight {
  title: string
  text: string
  action: string | null
  tone: 'alert' | 'warning' | 'info' | 'positive'
}

interface AiInsightsSectionProps {
  month: number
  year: number
  className?: string
}

const TONE_STYLE: Record<AiInsight['tone'], { dot: string; box: string }> = {
  alert: { dot: 'bg-red-500', box: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20' },
  warning: { dot: 'bg-amber-500', box: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20' },
  info: { dot: 'bg-violet-500', box: 'bg-violet-50 dark:bg-violet-900/10 border-violet-100 dark:border-violet-900/20' },
  positive: { dot: 'bg-emerald-500', box: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20' },
}

// Analisi del mese generata da /api/ai/insights, su richiesta. Il server legge i
// dati da sé (storico incluso): qui si invia solo il mese selezionato.
export function AiInsightsSection({ month, year, className }: AiInsightsSectionProps) {
  const [insights, setInsights] = useState<AiInsight[] | null>(null)
  const [baselineMonths, setBaselineMonths] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setInsights(null)
    setError(null)
  }, [month, year])

  async function analyze() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Errore AI')
      setInsights(data.insights ?? [])
      setBaselineMonths(data.baselineMonths ?? 0)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  const summary =
    insights === null
      ? 'Cosa merita attenzione questo mese'
      : insights.length > 0
        ? `${insights.length} ${insights.length === 1 ? 'osservazione' : 'osservazioni'} sul mese`
        : 'Nessuna anomalia rilevante'

  return (
    <Section
      storageKey="dashboard-ai"
      title="Analisi AI"
      Icon={Sparkles}
      defaultOpen={false}
      className={className}
      summary={summary}
      actions={
        <button
          onClick={analyze}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analisi...
            </>
          ) : 'Analizza'}
        </button>
      }
    >
      <div className="p-4 sm:p-5">
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        {insights && insights.length > 0 ? (
          <ol className="space-y-3">
            {insights.map((insight, i) => {
              const style = TONE_STYLE[insight.tone] ?? TONE_STYLE.info
              return (
                <li key={i} className={classNames('p-3 rounded-lg border', style.box)}>
                  <div className="flex items-center gap-2">
                    <span className={classNames('w-2 h-2 rounded-full shrink-0', style.dot)} />
                    <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{insight.title}</h4>
                  </div>
                  <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">{insight.text}</p>
                  {insight.action && (
                    <p className="mt-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">→ {insight.action}</p>
                  )}
                </li>
              )
            })}
          </ol>
        ) : insights ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-2">
            {baselineMonths > 0
              ? `Nessuna anomalia: il mese è in linea con la media dei ${baselineMonths} mesi precedenti.`
              : 'Servono almeno un paio di mesi di movimenti per individuare scostamenti significativi.'}
          </p>
        ) : !error && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-2">
            Premi &quot;Analizza&quot; per vedere cosa si discosta dal tuo andamento abituale.
          </p>
        )}
      </div>
    </Section>
  )
}
