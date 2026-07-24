'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, TrendingUp, PiggyBank, Wallet, CalendarDays, BarChart3, Trophy } from 'lucide-react'
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
import { useMonthlyKPIs, useTransactions } from '@/hooks/useTransactions'
import { useExpenseCategories } from '@/hooks/useCategories'
import { useSettings } from '@/hooks/useSettings'
import { useModalA11y } from '@/hooks/useModalA11y'
import { formatCurrency, formatMonth } from '@/lib/utils'
import type { ExpenseCategory } from '@/types'

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

  // Categoria selezionata per il dettaglio delle singole spese (modal)
  const [detailCategory, setDetailCategory] = useState<ExpenseCategory | null>(null)

  const isCurrentMonth = selectedMonth === currentDate.getMonth() + 1 && selectedYear === currentDate.getFullYear()

  const goToPrevMonth = useCallback(() => {
    const d = new Date(selectedYear, selectedMonth - 2, 1)
    setSelectedMonth(d.getMonth() + 1)
    setSelectedYear(d.getFullYear())
  }, [selectedMonth, selectedYear])

  const goToNextMonth = useCallback(() => {
    const d = new Date(selectedYear, selectedMonth, 1)
    setSelectedMonth(d.getMonth() + 1)
    setSelectedYear(d.getFullYear())
  }, [selectedMonth, selectedYear])

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

  // Finché il mese non ha entrate registrate, si mostra la stima storica
  // (in giallo) al posto dello zero reale; appena arriva un'entrata vera,
  // subentra il valore reale (in verde).
  const isIncomeEstimated = !!kpis?.isIncomeEstimated
  const displayIncome = isIncomeEstimated ? (kpis?.projectedIncome ?? 0) : (kpis?.totalIncome ?? 0)
  const incomeColor = isIncomeEstimated ? '#f59e0b' : '#10b981'

  // Bar chart data
  const barData = useMemo(() => ({
    labels: ['Entrate', 'Spese', 'Risparmi'],
    datasets: [{
      data: [displayIncome, kpis?.totalExpenses ?? 0, kpis?.totalSavings ?? 0],
      backgroundColor: [incomeColor + 'cc', '#ef4444cc', '#3b82f6cc'],
      borderColor: [incomeColor, '#ef4444', '#3b82f6'],
      borderWidth: 2,
      borderRadius: 6,
    }],
  }), [kpis, displayIncome, incomeColor])

  const hasData = displayIncome > 0 || (kpis?.totalExpenses ?? 0) > 0 || (kpis?.totalSavings ?? 0) > 0

  // AI Insights
  const [aiInsights, setAiInsights] = useState<string[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    setAiInsights([])
    setAiError(null)
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
              onClick={goToPrevMonth}
              aria-label="Mese precedente"
              className="p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
            >
              <ChevronLeft size={16} />
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
              {Array.from({ length: 4 }, (_, i) => currentDate.getFullYear() - 1 + i).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
              aria-label="Mese successivo"
              className="p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Primary KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Entrate */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Entrate</span>
              <TrendingUp size={16} className={isIncomeEstimated ? 'text-amber-500' : 'text-emerald-500'} />
            </div>
            {isLoading
              ? <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
              : <p className={`text-2xl font-bold ${isIncomeEstimated ? 'text-amber-500' : 'text-emerald-600'}`}>{fmt(displayIncome)}</p>
            }
            {!isLoading && isIncomeEstimated && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Stima basata sulla media storica — in attesa di nuove entrate
              </p>
            )}
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
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Mese prec. {fmt(kpis.prevMonthExpenses)}</p>
            )}
          </div>

          {/* Risparmi */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Risparmi</span>
              <PiggyBank size={16} className="text-blue-500" />
            </div>
            {isLoading
              ? <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
              : <p className="text-2xl font-bold text-blue-600">{fmt(kpis?.totalSavings ?? 0)}</p>
            }
            {!isLoading && (kpis?.savingsPercent ?? 0) > 0 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{kpis?.savingsPercent}% delle entrate</p>
            )}
          </div>

          {/* Saldo */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Saldo netto</span>
              <Wallet size={16} className="text-zinc-500 dark:text-zinc-400" />
            </div>
            {isLoading
              ? <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
              : <p className={`text-2xl font-bold ${(kpis?.balance ?? 0) >= 0 ? 'text-zinc-900 dark:text-white' : 'text-red-600'}`}>
                  {fmt(kpis?.balance ?? 0)}
                </p>
            }
            {!isLoading && kpis?.isIncomeEstimated && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Basato su entrata media stimata
              </p>
            )}
          </div>
        </div>

        {/* Secondary KPIs */}
        {!isLoading && hasData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
                <CalendarDays size={22} className="text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Media giornaliera</p>
                <p className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{fmt(kpis?.dailyAverage ?? 0)}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                <BarChart3 size={22} className="text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Tasso di risparmio</p>
                <p className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{kpis?.savingsPercent ?? 0}%</p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
                {topCategory?.icon
                  ? <span className="text-2xl">{topCategory.icon}</span>
                  : <Trophy size={22} className="text-purple-500" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Categoria top</p>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">
                  {topCategory ? topCategory.name : '—'}
                </p>
                {topCategory && kpis?.topCategoryId && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{fmt(kpis.categoryBreakdown[kpis.topCategoryId])}</p>
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
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">+{categoryBreakdown.length - 5} altre</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">Nessuna spesa registrata</p>
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
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 w-16 sm:w-20 shrink-0">{item.label}</span>
                  <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 w-10 text-right">{item.pct}%</span>
                  <span className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400 w-24 text-right">{fmt(item.value)}</span>
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
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setDetailCategory(cat)}
                    aria-label={`Mostra dettaglio spese di ${cat.name}`}
                    className="w-full px-6 py-3 flex items-center gap-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/40 transition-colors cursor-pointer"
                  >
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
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 w-8 text-right shrink-0">{pct}%</span>
                  </button>
                )
              })}
            </div>
            <p className="px-6 py-2.5 text-xs text-zinc-400 dark:text-zinc-500 border-t border-zinc-50 dark:border-zinc-700/50">
              Clicca una categoria per vedere il dettaglio delle spese
            </p>
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
              </div>
            ) : !aiError && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
                Premi &quot;Analizza con AI&quot; per ottenere 3 insight personalizzati sul mese selezionato.
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
            <Link
              href="/transazioni"
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-5 rounded-lg text-sm transition-colors"
            >
              Aggiungi transazione
            </Link>
          </div>
        )}

      </div>

      {detailCategory && (
        <CategoryExpensesModal
          category={detailCategory}
          month={selectedMonth}
          year={selectedYear}
          currency={currency}
          totalForCategory={kpis?.categoryBreakdown[detailCategory.id] ?? 0}
          onClose={() => setDetailCategory(null)}
        />
      )}
    </DashboardLayout>
  )
}

// Modal che elenca tutte le singole spese di una categoria nel mese selezionato.
// È un componente separato così la query sulle transazioni parte solo quando
// il modal è montato (cioè quando l'utente clicca una categoria).
function CategoryExpensesModal({
  category,
  month,
  year,
  currency,
  totalForCategory,
  onClose,
}: {
  category: ExpenseCategory
  month: number
  year: number
  currency: string
  totalForCategory: number
  onClose: () => void
}) {
  const { data: transactions, isLoading } = useTransactions({
    month,
    year,
    type: 'expense',
    category_id: category.id,
  })
  const modalRef = useModalA11y<HTMLDivElement>(true, onClose)
  const fmt = (n: number) => formatCurrency(n, currency)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="category-detail-title">
      <div ref={modalRef} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: (category.color || '#6b7280') + '22' }}>
              {category.icon || '📦'}
            </div>
            <div className="min-w-0">
              <h2 id="category-detail-title" className="text-base font-bold text-zinc-900 dark:text-white truncate">{category.name}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatMonth(month, year)} · {fmt(totalForCategory)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shrink-0">✕</button>
        </div>

        <div className="overflow-y-auto p-2">
          {isLoading ? (
            <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Caricamento...</p>
          ) : !transactions || transactions.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Nessuna spesa registrata per questa categoria</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
              {transactions.map((t) => (
                <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                      {t.description || 'Senza descrizione'}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {(() => { const [y, m, d] = t.date.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('it-IT') })()}
                      {t.payment_method ? ` · ${t.payment_method}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-red-600 shrink-0">-{fmt(t.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
