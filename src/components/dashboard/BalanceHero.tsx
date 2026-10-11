'use client'

import { Line } from '@/components/charts/LazyCharts'
import { Landmark } from 'lucide-react'
import { Card, Skeleton } from '@/components/ui'
import { formatCurrency, classNames } from '@/lib/utils'

interface BalanceHeroProps {
  loading: boolean
  openingBalance: number
  closingBalance: number
  /** Saldo a fine giornata, già troncato a oggi nel mese corrente */
  balanceValues: number[]
  isCurrentMonth: boolean
  currency: string
  className?: string
}

// Saldo disponibile (stock: denaro realmente sul conto) in primo piano, con
// la curva giorno per giorno del mese. Mai basato su stime: vedi
// "Saldo netto vs saldo disponibile" in CLAUDE.md.
export function BalanceHero({ loading, openingBalance, closingBalance, balanceValues, isCurrentMonth, currency, className }: BalanceHeroProps) {
  const fmt = (n: number) => formatCurrency(n, currency)
  const delta = Math.round((closingBalance - openingBalance) * 100) / 100
  const lastDay = balanceValues.length

  return (
    <Card className={classNames('p-4 sm:p-6 flex flex-col', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Landmark size={15} className="text-emerald-600" />
            Saldo disponibile{isCurrentMonth ? ' oggi' : ' a fine mese'}
          </p>
          {loading ? (
            <Skeleton className="h-9 w-44 mt-1" />
          ) : (
            <p className={classNames(
              'text-3xl sm:text-4xl font-bold tracking-tight mt-0.5',
              closingBalance >= 0 ? 'text-zinc-900 dark:text-white' : 'text-red-600',
            )}>
              {fmt(closingBalance)}
            </p>
          )}
          {!loading && (
            <p className="text-sm mt-0.5">
              <span className={delta >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
                {delta >= 0 ? '+' : '−'}{fmt(Math.abs(delta))}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400"> nel mese · a inizio mese {fmt(openingBalance)}</span>
            </p>
          )}
        </div>
      </div>

      {!loading && lastDay > 1 && (
        <div className="h-24 sm:h-36 lg:flex-1 lg:min-h-36 mt-3 -mx-1" data-no-swipe>
          <Line
            aria-label={`Andamento del saldo giorno per giorno${isCurrentMonth ? ', fino a oggi' : ''}`}
            data={{
              labels: balanceValues.map((_, i) => String(i + 1)),
              datasets: [{
                data: balanceValues,
                borderColor: '#10b981',
                borderWidth: 2,
                pointRadius: balanceValues.map((_, i) => (i === lastDay - 1 ? 3.5 : 0)),
                pointBackgroundColor: '#10b981',
                pointHoverRadius: 4,
                tension: 0.3,
                // Evidenzia l'attraversamento dello zero: è il punto
                // informativo del grafico.
                fill: {
                  target: 'origin',
                  above: 'rgba(16, 185, 129, 0.12)',
                  below: 'rgba(239, 68, 68, 0.18)',
                },
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    title: (items) => `Giorno ${items[0].label}`,
                    label: (item) => fmt(item.parsed.y ?? 0),
                  },
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { maxTicksLimit: 6, color: '#a1a1aa', font: { size: 11 } },
                },
                y: {
                  grid: { color: 'rgba(161, 161, 170, 0.15)' },
                  border: { display: false },
                  ticks: {
                    maxTicksLimit: 4,
                    color: '#a1a1aa',
                    font: { size: 11 },
                    callback: (value) => fmt(Number(value)).replace(/,00/, ''),
                  },
                },
              },
            }}
          />
        </div>
      )}
    </Card>
  )
}
