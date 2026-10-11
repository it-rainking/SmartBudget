'use client'

import './chartSetup'
import { Bar } from 'react-chartjs-2'
import { BarChart3 } from 'lucide-react'
import { Section } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'

interface IncomeSplitSectionProps {
  income: number
  /** Entrate del mese ancora stimate (stipendio non registrato) */
  isIncomeEstimated: boolean
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  expensePercent: number
  savingsPercent: number
  currency: string
  className?: string
}

// Confronto entrate / spese / risparmi (barre) e ripartizione percentuale
// delle entrate effettive del mese
export function IncomeSplitSection({
  income,
  isIncomeEstimated,
  totalIncome,
  totalExpenses,
  totalSavings,
  expensePercent,
  savingsPercent,
  currency,
  className,
}: IncomeSplitSectionProps) {
  const fmt = (n: number) => formatCurrency(n, currency)
  const incomeColor = isIncomeEstimated ? '#f59e0b' : '#10b981'
  const available = Math.max(0, totalIncome - totalExpenses - totalSavings)

  return (
    <Section
      storageKey="dashboard-income-split"
      title="Entrate, spese e risparmi"
      Icon={BarChart3}
      defaultOpen={false}
      className={className}
      summary={totalIncome > 0
        ? `Spese ${expensePercent}% · risparmi ${savingsPercent}% delle entrate`
        : 'Confronto del mese'}
    >
      <div className="p-4 sm:p-5 space-y-5">
        <div className="h-44" data-no-swipe>
          <Bar
            aria-label="Confronto tra entrate, spese e risparmi del mese"
            data={{
              labels: [isIncomeEstimated ? 'Entrate (stima)' : 'Entrate', 'Spese', 'Risparmi'],
              datasets: [{
                data: [income, totalExpenses, totalSavings],
                backgroundColor: [incomeColor + 'cc', '#ef4444cc', '#3b82f6cc'],
                borderColor: [incomeColor, '#ef4444', '#3b82f6'],
                borderWidth: 2,
                borderRadius: 6,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => ` ${fmt(ctx.parsed.y ?? 0)}` } },
              },
              scales: {
                x: { grid: { display: false }, ticks: { color: '#a1a1aa', font: { size: 11 } } },
                y: {
                  grid: { color: 'rgba(161, 161, 170, 0.15)' },
                  border: { display: false },
                  ticks: { color: '#a1a1aa', font: { size: 11 }, callback: (v) => fmt(Number(v)).replace(/\s/g, '') },
                },
              },
            }}
          />
        </div>

        {totalIncome > 0 && (
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Ripartizione delle entrate registrate</p>
            {[
              { label: 'Spese', pct: expensePercent, color: 'bg-red-500', value: totalExpenses },
              { label: 'Risparmi', pct: savingsPercent, color: 'bg-blue-500', value: totalSavings },
              { label: 'Disponibile', pct: Math.max(0, 100 - expensePercent - savingsPercent), color: 'bg-emerald-400', value: available },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 w-20 shrink-0">{item.label}</span>
                <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${Math.min(100, item.pct)}%` }} />
                </div>
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 w-10 text-right">{item.pct}%</span>
                <span className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400 w-24 text-right">{fmt(item.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
