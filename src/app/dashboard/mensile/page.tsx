'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useMonthlyKPIs } from '@/hooks/useTransactions'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, formatMonth } from '@/lib/utils'

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export default function DashboardMensilePage() {
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

  const { data: kpis, isLoading } = useMonthlyKPIs(selectedMonth, selectedYear)
  const { data: settings } = useSettings()

  const currency = settings?.currency || 'EUR'
  const fmt = (n: number) => formatCurrency(n, currency)

  const kpiCards = [
    {
      label: 'Entrate',
      value: kpis?.totalIncome ?? 0,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-900/10',
      icon: '📈',
    },
    {
      label: 'Spese',
      value: kpis?.totalExpenses ?? 0,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-900/10',
      icon: '📉',
    },
    {
      label: 'Risparmi',
      value: kpis?.totalSavings ?? 0,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-900/10',
      icon: '🏦',
    },
    {
      label: 'Saldo',
      value: kpis?.balance ?? 0,
      color: (kpis?.balance ?? 0) >= 0 ? 'text-zinc-900 dark:text-white' : 'text-red-600',
      bg: 'bg-white dark:bg-zinc-800',
      icon: '💰',
    },
  ]

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
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
            >
              {[2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card) => (
            <div key={card.label} className={`${card.bg} rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{card.label}</span>
                <span className="text-xl">{card.icon}</span>
              </div>
              {isLoading ? (
                <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
              ) : (
                <p className={`text-2xl font-bold ${card.color}`}>{fmt(card.value)}</p>
              )}
            </div>
          ))}
        </div>

        {/* % Breakdown */}
        {!isLoading && (kpis?.totalIncome ?? 0) > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">
              Ripartizione delle entrate
            </h2>
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
                    <div
                      className={`h-full ${item.color} rounded-full transition-all`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 w-12 text-right">
                    {item.pct}%
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 w-24 text-right">
                    {fmt(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (kpis?.totalIncome ?? 0) === 0 && (kpis?.totalExpenses ?? 0) === 0 && (
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

        {/* Quick Stats */}
        {!isLoading && ((kpis?.totalIncome ?? 0) > 0 || (kpis?.totalExpenses ?? 0) > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700 text-center">
              <p className="text-3xl font-bold text-emerald-600">{kpis?.expensePercent ?? 0}%</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Spese su entrate</p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700 text-center">
              <p className="text-3xl font-bold text-blue-600">{kpis?.savingsPercent ?? 0}%</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Tasso di risparmio</p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700 text-center">
              <p className={`text-3xl font-bold ${(kpis?.balance ?? 0) >= 0 ? 'text-zinc-800 dark:text-zinc-100' : 'text-red-600'}`}>
                {fmt(kpis?.balance ?? 0)}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Saldo netto</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
