'use client'

import { useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useAnnualData } from '@/hooks/useAnnualData'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency } from '@/lib/utils'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

export default function DashboardAnnualePage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { data, isLoading } = useAnnualData(year)
  const { data: prevData } = useAnnualData(year - 1)
  const { data: settings } = useSettings()

  const currency = settings?.currency || 'EUR'
  const fmt = (n: number) => formatCurrency(n, currency)
  const labels = data?.months.map(m => m.label) ?? []

  // Line chart: Entrate, Spese, Risparmi trend
  const lineData = {
    labels,
    datasets: [
      {
        label: 'Entrate',
        data: data?.months.map(m => m.income) ?? [],
        borderColor: '#10b981',
        backgroundColor: '#10b98120',
        tension: 0.4,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
      {
        label: 'Spese',
        data: data?.months.map(m => m.expenses) ?? [],
        borderColor: '#ef4444',
        backgroundColor: '#ef444420',
        tension: 0.4,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
      {
        label: 'Risparmi',
        data: data?.months.map(m => m.savings) ?? [],
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f620',
        tension: 0.4,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
    ],
  }

  // Bar chart: Saldo netto mensile
  const balanceData = {
    labels,
    datasets: [{
      label: 'Saldo netto',
      data: data?.months.map(m => m.balance) ?? [],
      backgroundColor: data?.months.map(m =>
        m.balance >= 0 ? '#10b98166' : '#ef444466'
      ) ?? [],
      borderColor: data?.months.map(m =>
        m.balance >= 0 ? '#10b981' : '#ef4444'
      ) ?? [],
      borderWidth: 2,
      borderRadius: 6,
    }],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { boxWidth: 12, padding: 16, font: { size: 12 } } },
      tooltip: { callbacks: { label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y ?? 0)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: { font: { size: 10 }, callback: (v: string | number) => fmt(Number(v)).replace(/\s/g, '') },
      },
    },
  }

  const hasData = (data?.totals.income ?? 0) > 0 || (data?.totals.expenses ?? 0) > 0

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard Annuale</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Panoramica dell&apos;anno {year}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setYear(y => y - 1)} aria-label="Anno precedente" className="px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-emerald-500 hover:text-emerald-600 transition-colors">‹</button>
            <span className="px-4 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-semibold text-zinc-800 dark:text-zinc-200 min-w-[70px] text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} disabled={year >= currentYear} aria-label="Anno successivo" className="px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">›</button>
          </div>
        </div>

        {/* Annual KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Entrate totali',  value: data?.totals.income   ?? 0, color: 'text-emerald-600', icon: '📈' },
            { label: 'Spese totali',    value: data?.totals.expenses ?? 0, color: 'text-red-600',     icon: '📉' },
            { label: 'Risparmi totali', value: data?.totals.savings  ?? 0, color: 'text-blue-600',    icon: '🏦' },
            { label: 'Saldo netto',     value: data?.totals.balance  ?? 0, color: (data?.totals.balance ?? 0) >= 0 ? 'text-zinc-900 dark:text-white' : 'text-red-600', icon: '💰' },
          ].map(card => (
            <div key={card.label} className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide leading-tight">{card.label}</span>
                <span className="text-lg">{card.icon}</span>
              </div>
              {isLoading
                ? <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
                : <p className={`text-xl font-bold ${card.color}`}>{fmt(card.value)}</p>
              }
            </div>
          ))}
        </div>

        {/* Highlights */}
        {!isLoading && hasData && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Mese migliore',    value: data?.bestMonth,  color: 'text-emerald-600', icon: '🏆', field: 'balance' as const },
              { label: 'Mese peggiore',    value: data?.worstMonth, color: 'text-red-600',     icon: '⚠️', field: 'balance' as const },
              { label: 'Picco entrate',    value: data?.topIncome,  color: 'text-emerald-600', icon: '💚', field: 'income'  as const },
              { label: 'Picco spese',      value: data?.topExpense, color: 'text-red-600',     icon: '🔴', field: 'expenses' as const },
            ].map(item => (
              <div key={item.label} className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-sm border border-zinc-100 dark:border-zinc-700">
                <div className="flex items-center gap-2 mb-2">
                  <span>{item.icon}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{item.label}</span>
                </div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{item.value?.label}</p>
                <p className={`text-base font-bold ${item.color}`}>{fmt(item.value?.[item.field] ?? 0)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Line chart */}
        {!isLoading && hasData && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Trend Entrate / Spese / Risparmi</h3>
            <div className="h-64">
              <Line data={lineData} options={chartOptions} />
            </div>
          </div>
        )}

        {/* Balance bar chart */}
        {!isLoading && hasData && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Saldo netto mensile</h3>
            <div className="h-48">
              <Bar data={balanceData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
            </div>
          </div>
        )}

        {/* Monthly table */}
        {!isLoading && hasData && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-700">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Dettaglio mensile</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-700">
                    {['Mese','Entrate','Spese','Risparmi','Saldo'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-700/50">
                  {data?.months.map(m => {
                    const hasActivity = m.income > 0 || m.expenses > 0 || m.savings > 0
                    return (
                      <tr key={m.month} className={`hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors ${!hasActivity ? 'opacity-40' : ''}`}>
                        <td className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">{m.label}</td>
                        <td className="px-4 py-3 text-emerald-600 font-medium">{m.income > 0 ? fmt(m.income) : '—'}</td>
                        <td className="px-4 py-3 text-red-600 font-medium">{m.expenses > 0 ? fmt(m.expenses) : '—'}</td>
                        <td className="px-4 py-3 text-blue-600 font-medium">{m.savings > 0 ? fmt(m.savings) : '—'}</td>
                        <td className={`px-4 py-3 font-bold ${m.balance >= 0 ? 'text-zinc-800 dark:text-zinc-200' : 'text-red-600'}`}>
                          {hasActivity ? fmt(m.balance) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700/30">
                    <td className="px-4 py-3 font-bold text-zinc-700 dark:text-zinc-300">Totale</td>
                    <td className="px-4 py-3 font-bold text-emerald-600">{fmt(data?.totals.income ?? 0)}</td>
                    <td className="px-4 py-3 font-bold text-red-600">{fmt(data?.totals.expenses ?? 0)}</td>
                    <td className="px-4 py-3 font-bold text-blue-600">{fmt(data?.totals.savings ?? 0)}</td>
                    <td className={`px-4 py-3 font-bold ${(data?.totals.balance ?? 0) >= 0 ? 'text-zinc-800 dark:text-zinc-200' : 'text-red-600'}`}>
                      {fmt(data?.totals.balance ?? 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Anno precedente: confronto delta */}
        {!isLoading && hasData && prevData && (prevData.totals.income > 0 || prevData.totals.expenses > 0) && (() => {
          const delta = (curr: number, prev: number) =>
            prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null

          const items = [
            { label: 'Entrate',  curr: data?.totals.income   ?? 0, prev: prevData.totals.income,   color: 'text-emerald-600' },
            { label: 'Spese',    curr: data?.totals.expenses ?? 0, prev: prevData.totals.expenses, color: 'text-red-600' },
            { label: 'Risparmi', curr: data?.totals.savings  ?? 0, prev: prevData.totals.savings,  color: 'text-blue-600' },
            { label: 'Saldo',    curr: data?.totals.balance  ?? 0, prev: prevData.totals.balance,  color: 'text-zinc-700 dark:text-zinc-300' },
          ]

          return (
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Confronto con {year - 1}
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-zinc-100 dark:divide-zinc-700">
                {items.map(item => {
                  const d = delta(item.curr, item.prev)
                  return (
                    <div key={item.label} className="px-5 py-4">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{item.label}</p>
                      <p className={`text-sm font-bold ${item.color}`}>{fmt(item.curr)}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">vs {fmt(item.prev)}</p>
                      {d !== null && (
                        <span className={`inline-block mt-1 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                          d > 0
                            ? item.label === 'Spese' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : item.label === 'Spese' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {d > 0 ? '▲' : '▼'} {Math.abs(d)}%
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Empty state */}
        {!isLoading && !hasData && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-12 shadow-sm border border-zinc-100 dark:border-zinc-700 text-center">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Nessun dato per il {year}</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">Aggiungi transazioni per vedere le statistiche annuali</p>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
