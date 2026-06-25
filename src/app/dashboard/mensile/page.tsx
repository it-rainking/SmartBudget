'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useMonthlyKPIs } from '@/hooks/useTransactions'
import { useExpenseCategories } from '@/hooks/useCategories'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, formatMonth } from '@/lib/utils'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export default function DashboardMensilePage() {
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

  const { data: kpis, isLoading } = useMonthlyKPIs(selectedMonth, selectedYear)
  const { data: expenseCategories } = useExpenseCategories()
  const { data: settings } = useSettings()

  const currency = settings?.currency || 'EUR'
  const fmt = (n: number) => formatCurrency(n, currency)

  // Build expense breakdown by category (sorted by amount desc)
  const categoryBreakdown = useMemo(() => {
    if (!expenseCategories || !kpis?.categoryBreakdown) return []
    return expenseCategories
      .filter((cat) => (kpis.categoryBreakdown[cat.id] || 0) > 0)
      .map((cat) => ({ ...cat, total: kpis.categoryBreakdown[cat.id] || 0 }))
      .sort((a, b) => b.total - a.total)
  }, [expenseCategories, kpis])

  const topCategory = useMemo(() => {
    if (!expenseCategories || !kpis?.topCategoryId) return null
    return expenseCategories.find((c) => c.id === kpis.topCategoryId) ?? null
  }, [expenseCategories, kpis])

  // Donut chart data
  const donutData = useMemo(() => ({
    labels: categoryBreakdown.map((c) => `${c.icon || '📦'} ${c.name}`),
    datasets: [{
      data: categoryBreakdown.map((c) => c.total),
      backgroundColor: categoryBreakdown.map((c) => (c.color || '#6b7280') + 'cc'),
      borderColor: categoryBreakdown.map((c) => c.color || '#6b7280'),
      borderWidth: 2,
    }],
  }), [categoryBreakdown])

  // Bar chart data
  const barData = useMemo(() => ({
    labels: ['Entrate', 'Spese', 'Risparmi'],
    datasets: [{
      data: [kpis?.totalIncome ?? 0, kpis?.totalExpenses ?? 0, kpis?.totalSavings ?? 0],
      backgroundColor: ['#10b981cc', '#ef4444cc', '#3b82f6cc'],
      borderColor: ['#10b981', '#ef4444', '#3b82f6'],
      borderWidth: 2,
      borderRadius: 6,
    }],
  }), [kpis])

  const hasData = (kpis?.totalIncome ?? 0) > 0 || (kpis?.totalExpenses ?? 0) > 0 || (kpis?.totalSavings ?? 0) > 0

  // AI Insights
  const [aiInsights, setAiInsights] = useState<string[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiCostUsd, setAiCostUsd] = useState<number | null>(null)

  useEffect(() => {
    setAiInsights([])
    setAiError(null)
    setAiCostUsd(null)
  }, [selectedMonth, selectedYear])

  async function handleAIInsights() {
    if (!kpis || !hasData) return
    setIsLoadingAI(true)
    setAiError(null)
    try {
      const categoryNamesMap: Record<string, string> = {}
      expenseCategories?.forEach((c) => { categoryNamesMap[c.id] = c.name })
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          kpis: {
            totalIncome: kpis.totalIncome,
            totalExpenses: kpis.totalExpenses,
            totalSavings: kpis.totalSavings,
            balance: kpis.balance,
            savingsPercent: kpis.savingsPercent,
            dailyAverage: kpis.dailyAverage,
            deltaExpensePercent: kpis.deltaExpensePercent ?? null,
            prevMonthExpenses: kpis.prevMonthExpenses ?? 0,
          },
          categoryBreakdown: kpis.categoryBreakdown,
          categoryNames: categoryNamesMap,
          currency,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiInsights(data.insights ?? [])
      if (data.usage) {
        // claude-haiku-4-5: $0.80/MTok input, $4.00/MTok output
        const cost = (data.usage.input_tokens / 1_000_000) * 0.80 + (data.usage.output_tokens / 1_000_000) * 4.00
        setAiCostUsd(cost)
      }
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Errore sconosciuto')
    } finally {
      setIsLoadingAI(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard Mensile</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Riepilogo di {formatMonth(selectedMonth, selectedYear)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const d = new Date(selectedYear, selectedMonth - 2, 1)
                setSelectedMonth(d.getMonth() + 1)
                setSelectedYear(d.getFullYear())
              }}
              className="px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-emerald-500 hover:text-emerald-600 transition-colors text-sm"
            >
              ‹
            </button>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
            >
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
            >
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={() => {
                const d = new Date(selectedYear, selectedMonth, 1)
                setSelectedMonth(d.getMonth() + 1)
                setSelectedYear(d.getFullYear())
              }}
              className="px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-emerald-500 hover:text-emerald-600 transition-colors text-sm"
            >
              ›
            </button>
          </div>
        </div>

        {/* Primary KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Entrate */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Entrate</span>
              <span className="text-lg">📈</span>
            </div>
            {isLoading
              ? <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
              : <p className="text-2xl font-bold text-emerald-600">{fmt(kpis?.totalIncome ?? 0)}</p>
            }
          </div>

          {/* Spese + delta */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Spese</span>
              {!isLoading && kpis?.deltaExpensePercent !== null && kpis?.deltaExpensePercent !== undefined && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  kpis.deltaExpensePercent > 0
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                }`}>
                  {kpis.deltaExpensePercent > 0 ? '▲' : '▼'} {Math.abs(kpis.deltaExpensePercent)}%
                </span>
              )}
            </div>
            {isLoading
              ? <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
              : <p className="text-2xl font-bold text-red-600">{fmt(kpis?.totalExpenses ?? 0)}</p>
            }
            {!isLoading && kpis?.prevMonthExpenses !== undefined && kpis.prevMonthExpenses > 0 && (
              <p className="text-xs text-zinc-400 mt-1">Mese prec. {fmt(kpis.prevMonthExpenses)}</p>
            )}
          </div>

          {/* Risparmi */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Risparmi</span>
              <span className="text-lg">🏦</span>
            </div>
            {isLoading
              ? <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
              : <p className="text-2xl font-bold text-blue-600">{fmt(kpis?.totalSavings ?? 0)}</p>
            }
            {!isLoading && (kpis?.savingsPercent ?? 0) > 0 && (
              <p className="text-xs text-zinc-400 mt-1">{kpis?.savingsPercent}% delle entrate</p>
            )}
          </div>

          {/* Saldo */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Saldo netto</span>
              <span className="text-lg">💰</span>
            </div>
            {isLoading
              ? <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
              : <p className={`text-2xl font-bold ${(kpis?.balance ?? 0) >= 0 ? 'text-zinc-900 dark:text-white' : 'text-red-600'}`}>
                  {fmt(kpis?.balance ?? 0)}
                </p>
            }
          </div>
        </div>

        {/* Secondary KPIs */}
        {!isLoading && hasData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-2xl shrink-0">
                📅
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Media giornaliera</p>
                <p className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{fmt(kpis?.dailyAverage ?? 0)}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-2xl shrink-0">
                📊
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Tasso di risparmio</p>
                <p className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{kpis?.savingsPercent ?? 0}%</p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center text-2xl shrink-0">
                {topCategory?.icon || '🏆'}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Categoria top</p>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">
                  {topCategory ? topCategory.name : '—'}
                </p>
                {topCategory && kpis?.topCategoryId && (
                  <p className="text-xs text-zinc-400">{fmt(kpis.categoryBreakdown[kpis.topCategoryId])}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Charts row */}
        {!isLoading && hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Donut chart - expense categories */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">
                Spese per categoria
              </h3>
              {categoryBreakdown.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="w-40 h-40 shrink-0">
                    <Doughnut
                      data={donutData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        cutout: '65%',
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (ctx) => {
                                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0)
                                const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0
                                return ` ${ctx.label}: ${fmt(ctx.parsed)} (${pct}%)`
                              },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-2 overflow-hidden">
                    {categoryBreakdown.slice(0, 5).map((cat) => {
                      const pct = kpis?.totalExpenses
                        ? Math.round((cat.total / kpis.totalExpenses) * 100)
                        : 0
                      return (
                        <div key={cat.id} className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color || '#6b7280' }}
                          />
                          <span className="text-xs text-zinc-600 dark:text-zinc-400 flex-1 truncate">
                            {cat.icon} {cat.name}
                          </span>
                          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
                            {pct}%
                          </span>
                        </div>
                      )
                    })}
                    {categoryBreakdown.length > 5 && (
                      <p className="text-xs text-zinc-400">+{categoryBreakdown.length - 5} altre</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-400 text-center py-8">Nessuna spesa registrata</p>
              )}
            </div>

            {/* Bar chart - income vs expenses vs savings */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">
                Confronto Entrate / Spese / Risparmi
              </h3>
              <div className="h-48">
                <Bar
                  data={barData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => ` ${fmt(ctx.parsed.y ?? 0)}`,
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } },
                      },
                      y: {
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: {
                          font: { size: 10 },
                          callback: (v) => fmt(Number(v)).replace(/\s/g, ''),
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Breakdown ripartizione % */}
        {!isLoading && (kpis?.totalIncome ?? 0) > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">
              Ripartizione delle entrate
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Spese', pct: kpis?.expensePercent ?? 0, color: 'bg-red-500', value: kpis?.totalExpenses ?? 0 },
                { label: 'Risparmi', pct: kpis?.savingsPercent ?? 0, color: 'bg-blue-500', value: kpis?.totalSavings ?? 0 },
                {
                  label: 'Disponibile',
                  pct: Math.max(0, 100 - (kpis?.expensePercent ?? 0) - (kpis?.savingsPercent ?? 0)),
                  color: 'bg-emerald-400',
                  value: Math.max(0, (kpis?.totalIncome ?? 0) - (kpis?.totalExpenses ?? 0) - (kpis?.totalSavings ?? 0)),
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 w-20 shrink-0">{item.label}</span>
                  <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 w-10 text-right">{item.pct}%</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 w-24 text-right">{fmt(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category breakdown detail */}
        {!isLoading && categoryBreakdown.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-700">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Dettaglio spese per categoria</h3>
            </div>
            <div className="divide-y divide-zinc-50 dark:divide-zinc-700/50">
              {categoryBreakdown.map((cat) => {
                const pct = kpis?.totalExpenses
                  ? Math.round((cat.total / kpis.totalExpenses) * 100)
                  : 0
                return (
                  <div key={cat.id} className="px-6 py-3 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: (cat.color || '#6b7280') + '22' }}>
                      {cat.icon || '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{cat.name}</span>
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 ml-4 shrink-0">
                          {fmt(cat.total)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: cat.color || '#6b7280' }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-zinc-400 w-8 text-right shrink-0">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* AI Insights */}
        {!isLoading && hasData && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">💡</span>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Analisi AI</h3>
              </div>
              <button
                onClick={handleAIInsights}
                disabled={isLoadingAI}
                className="px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5"
              >
                {isLoadingAI ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analisi...
                  </>
                ) : '✨ Analizza con AI'}
              </button>
            </div>

            {aiError && (
              <p className="text-sm text-red-500 dark:text-red-400">{aiError}</p>
            )}

            {aiInsights.length > 0 ? (
              <div className="space-y-3">
                {aiInsights.map((insight, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-violet-50 dark:bg-violet-900/10 rounded-lg border border-violet-100 dark:border-violet-900/20">
                    <span className="text-violet-500 font-bold text-xs mt-0.5 shrink-0">0{i + 1}</span>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{insight}</p>
                  </div>
                ))}
                {aiCostUsd !== null && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 text-right pt-1">
                    Costo analisi: ~${aiCostUsd < 0.00001 ? '<0.00001' : aiCostUsd.toFixed(5)} USD
                  </p>
                )}
              </div>
            ) : !aiError && (
              <p className="text-sm text-zinc-400 text-center py-4">
                Premi "Analizza con AI" per ottenere 3 insight personalizzati sul mese selezionato.
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !hasData && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-12 shadow-sm border border-zinc-100 dark:border-zinc-700 text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Nessun dato per questo mese
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
              Aggiungi le tue prime transazioni per visualizzare le statistiche
            </p>
            <a
              href="/transazioni"
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-5 rounded-lg text-sm transition-colors"
            >
              Aggiungi transazione
            </a>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
