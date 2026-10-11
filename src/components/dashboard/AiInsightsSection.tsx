'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Section } from '@/components/ui'
import type { useMonthlyKPIs } from '@/hooks/useTransactions'
import type { ExpenseCategory } from '@/types'

type Kpis = NonNullable<ReturnType<typeof useMonthlyKPIs>['data']>

interface AiInsightsSectionProps {
  month: number
  year: number
  kpis: Kpis
  expenseCategories: ExpenseCategory[] | undefined
  currency: string
  className?: string
}

// Tre insight sul mese generati da /api/ai/insights, su richiesta
export function AiInsightsSection({ month, year, kpis, expenseCategories, currency, className }: AiInsightsSectionProps) {
  const [insights, setInsights] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setInsights([])
    setError(null)
  }, [month, year])

  async function analyze() {
    setLoading(true)
    setError(null)
    try {
      const categoryNames: Record<string, string> = {}
      expenseCategories?.forEach((c) => { categoryNames[c.id] = c.name })
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          year,
          kpis: {
            totalIncome: kpis.totalIncome,
            totalExpenses: kpis.totalExpenses,
            totalSavings: kpis.totalSavings,
            balance: kpis.balance,
            savingsPercent: kpis.savingsPercent,
            dailyAverage: kpis.dailyAverage,
            deltaExpensePercent: kpis.deltaExpensePercent ?? null,
            prevMonthExpenses: kpis.prevMonthExpenses ?? 0,
            // Valori a condizioni normali: l'analisi deve ragionare su questi
            ordinaryIncome: kpis.ordinaryIncome,
            ordinaryExpenses: kpis.ordinaryExpenses,
            ordinaryBalance: kpis.ordinaryBalance,
            exceptionalIncome: kpis.exceptionalIncome,
            exceptionalExpenses: kpis.exceptionalExpenses,
          },
          categoryBreakdown: kpis.categoryBreakdown,
          categoryNames,
          currency,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setInsights(data.insights ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section
      storageKey="dashboard-ai"
      title="Analisi AI"
      Icon={Sparkles}
      defaultOpen={false}
      className={className}
      summary={insights.length > 0 ? `${insights.length} osservazioni sul mese` : '3 osservazioni sul mese selezionato'}
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
        {insights.length > 0 ? (
          <ol className="space-y-3">
            {insights.map((insight, i) => (
              <li key={i} className="flex gap-3 p-3 bg-violet-50 dark:bg-violet-900/10 rounded-lg border border-violet-100 dark:border-violet-900/20">
                <span className="text-violet-500 font-bold text-xs mt-0.5 shrink-0">{i + 1}</span>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{insight}</p>
              </li>
            ))}
          </ol>
        ) : !error && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-2">
            Premi &quot;Analizza&quot; per ottenere 3 osservazioni personalizzate sul mese selezionato.
          </p>
        )}
      </div>
    </Section>
  )
}
