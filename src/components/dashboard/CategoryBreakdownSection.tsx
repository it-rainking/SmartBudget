'use client'

import { Doughnut } from '@/components/charts/LazyCharts'
import { PieChart, Tag, Zap } from 'lucide-react'
import { Section } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import type { ExpenseCategory } from '@/types'

export type CategoryTotal = ExpenseCategory & { total: number }

interface CategoryBreakdownSectionProps {
  categories: CategoryTotal[]
  totalExpenses: number
  exceptionalByCategory: Record<string, number>
  currency: string
  onSelect: (category: ExpenseCategory) => void
  className?: string
}

// Spese del mese per categoria: ciambella (da sm in su) + elenco completo con
// barre. Un tocco su una categoria apre il dettaglio delle singole spese.
export function CategoryBreakdownSection({
  categories,
  totalExpenses,
  exceptionalByCategory,
  currency,
  onSelect,
  className,
}: CategoryBreakdownSectionProps) {
  const fmt = (n: number) => formatCurrency(n, currency)
  const pctOf = (n: number) => (totalExpenses ? Math.round((n / totalExpenses) * 100) : 0)
  const top = categories[0]

  return (
    <Section
      storageKey="dashboard-categories"
      title="Spese per categoria"
      Icon={PieChart}
      className={className}
      summary={top ? `${categories.length} categorie · prima ${top.name} (${pctOf(top.total)}%)` : 'Nessuna spesa registrata'}
    >
      {categories.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nessuna spesa registrata</p>
      ) : (
        <div className="sm:flex sm:items-start">
          <div className="hidden sm:block w-44 h-44 shrink-0 m-5 mr-0" data-no-swipe>
            <Doughnut
              aria-label="Ripartizione delle spese per categoria"
              data={{
                labels: categories.map((c) => c.name),
                datasets: [{
                  data: categories.map((c) => c.total),
                  backgroundColor: categories.map((c) => (c.color || '#6b7280') + 'cc'),
                  borderColor: categories.map((c) => c.color || '#6b7280'),
                  borderWidth: 2,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                cutout: '65%',
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => ` ${ctx.label}: ${fmt(ctx.parsed)} (${pctOf(ctx.parsed)}%)`,
                    },
                  },
                },
              }}
            />
          </div>
          <div className="flex-1 min-w-0 divide-y divide-zinc-50 dark:divide-zinc-700/50 sm:py-2">
            {categories.map((cat) => {
              const pct = pctOf(cat.total)
              const exceptional = exceptionalByCategory[cat.id] ?? 0
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelect(cat)}
                  aria-label={`Mostra dettaglio spese di ${cat.name}`}
                  className="w-full px-4 sm:px-5 py-2.5 flex items-center gap-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/40 transition-colors"
                >
                  <span
                    aria-hidden="true"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: (cat.color || '#6b7280') + '22' }}
                  >
                    {cat.icon || <Tag size={15} className="text-zinc-400" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                        {cat.name}
                        {exceptional > 0 && (
                          <span
                            title={`Include ${fmt(exceptional)} di movimenti eccezionali, esclusi dai trend`}
                            className="ml-2 inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400"
                          >
                            <Zap size={11} /> {fmt(exceptional)}
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 shrink-0">{fmt(cat.total)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: cat.color || '#6b7280' }}
                        />
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 w-8 text-right shrink-0">{pct}%</span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </Section>
  )
}
