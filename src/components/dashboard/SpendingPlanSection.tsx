'use client'

import Link from 'next/link'
import { Wallet } from 'lucide-react'
import { Section } from '@/components/ui'
import { SPENDING_GROUPS, type SpendingPlan } from '@/lib/kakebo'
import { classNames, formatCurrency } from '@/lib/utils'

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

interface SpendingPlanSectionProps {
  plan: SpendingPlan
  month: number
  income: number
  isIncomeEstimated: boolean
  savings: number
  debts: number
  isCurrentMonth: boolean
  currency: string
  className?: string
}

// Portamonete del mese (metodo Kakebo): entrate − uscite fisse − risparmi =
// denaro per le spese variabili. Mostra quanto ne resta, il ritmo settimanale,
// la ripartizione per grado di necessità e contanti contro carte.
export function SpendingPlanSection({
  plan,
  month,
  income,
  isIncomeEstimated,
  savings,
  debts,
  isCurrentMonth,
  currency,
  className,
}: SpendingPlanSectionProps) {
  const fmt = (n: number) => formatCurrency(n, currency)
  const hasBudget = plan.variableBudget > 0
  const usedPct = hasBudget ? Math.min(100, Math.round((plan.variableSpent / plan.variableBudget) * 100)) : 100
  const over = plan.remaining < 0
  const monthLabel = MONTHS_SHORT[month - 1]

  const summary = !hasBudget
    ? 'Uscite fisse e risparmi superano le entrate'
    : over
      ? `Sforato di ${fmt(-plan.remaining)}`
      : isCurrentMonth && plan.daysLeft > 0
        ? `Restano ${fmt(plan.remaining)} · ${fmt(plan.perDayLeft)} al giorno`
        : `Avanzati ${fmt(plan.remaining)} su ${fmt(plan.variableBudget)}`

  const totalExpenses = plan.fixedRegistered + plan.variableSpent
  const groupRows = [
    ...SPENDING_GROUPS.map((g) => ({ key: g.key, label: g.label, color: g.color, value: plan.byGroup[g.key] })),
    { key: 'unassigned', label: 'Da classificare', color: '#a1a1aa', value: plan.unassigned },
  ].filter((r) => r.value > 0)

  const maxWeek = Math.max(1, ...plan.weeks.map((w) => Math.max(w.spent, w.target)))

  return (
    <Section
      storageKey="dashboard-spending-plan"
      title="Portamonete del mese"
      Icon={Wallet}
      className={className}
      summary={summary}
    >
      <div className="p-4 sm:p-5 space-y-6">
        {/* Disponibile per le spese variabili */}
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {over ? 'Spese variabili oltre il disponibile' : isCurrentMonth ? 'Ancora disponibile per le spese variabili' : 'Avanzato sulle spese variabili'}
              </p>
              <p className={classNames('text-2xl font-bold', over || !hasBudget ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                {fmt(over ? -plan.remaining : Math.max(0, plan.remaining))}
              </p>
            </div>
            {isCurrentMonth && hasBudget && !over && plan.daysLeft > 0 && (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                circa <span className="font-semibold">{fmt(plan.perDayLeft)}</span> al giorno
                <span className="text-zinc-400 dark:text-zinc-500"> per {plan.daysLeft} {plan.daysLeft === 1 ? 'giorno' : 'giorni'}</span>
              </p>
            )}
          </div>
          <div
            className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden"
            role="progressbar"
            aria-label="Quota del disponibile già spesa"
            aria-valuenow={usedPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={classNames('h-full rounded-full', usedPct >= 100 ? 'bg-red-500' : usedPct >= 85 ? 'bg-amber-500' : 'bg-emerald-500')}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {isIncomeEstimated ? 'Entrate stimate' : 'Entrate'} {fmt(income)}
            {' − uscite fisse '}{fmt(plan.fixedTotal)}
            {plan.fixedPlanned > 0 && <> (di cui {fmt(plan.fixedPlanned)} ancora da registrare)</>}
            {savings > 0 && <>{' − risparmi '}{fmt(savings)}</>}
            {debts > 0 && <>{' − debiti '}{fmt(debts)}</>}
            {' = '}<span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(plan.variableBudget)}</span> per le spese variabili, di cui spesi {fmt(plan.variableSpent)}.
          </p>
          {!hasBudget && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Le uscite fisse e i risparmi del mese superano le entrate: ogni spesa variabile pesa sul saldo.
            </p>
          )}
        </div>

        {/* Settimane */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Spese variabili per settimana</p>
          {plan.weeks.map((w) => {
            const overWeek = w.target > 0 && w.spent > w.target
            return (
              <div key={w.index} className={classNames('flex items-center gap-3', w.status === 'future' && 'opacity-50')}>
                <span className={classNames('text-xs w-20 shrink-0', w.status === 'current' ? 'font-semibold text-zinc-800 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400')}>
                  {w.startDay === w.endDay ? `${w.startDay}` : `${w.startDay}-${w.endDay}`} {monthLabel}
                </span>
                <div className="relative flex-1 h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={classNames('h-full rounded-full', overWeek ? 'bg-red-500' : 'bg-emerald-500')}
                    style={{ width: `${Math.min(100, (w.spent / maxWeek) * 100)}%` }}
                  />
                  {w.target > 0 && (
                    <div
                      className="absolute top-0 h-full w-0.5 bg-zinc-500 dark:bg-zinc-300"
                      style={{ left: `calc(${Math.min(100, (w.target / maxWeek) * 100)}% - 1px)` }}
                      title={`Quota della settimana: ${fmt(w.target)}`}
                    />
                  )}
                </div>
                <span className={classNames('text-xs font-semibold w-20 text-right', overWeek ? 'text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-300')}>
                  {fmt(w.spent)}
                </span>
                <span className="hidden sm:block text-xs text-zinc-400 dark:text-zinc-500 w-24 text-right">
                  {w.target > 0 ? `quota ${fmt(w.target)}` : ''}
                </span>
              </div>
            )
          })}
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            La tacca è la quota della settimana: il disponibile diviso in proporzione ai giorni.
          </p>
        </div>

        {/* Gruppi di spesa */}
        {totalExpenses > 0 && (
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Spese per grado di necessità</p>
            <div className="flex h-3 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-700" aria-hidden="true">
              {groupRows.map((r) => (
                <div key={r.key} style={{ width: `${(r.value / totalExpenses) * 100}%`, backgroundColor: r.color }} />
              ))}
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {groupRows.map((r) => (
                <li key={r.key} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <span className="flex-1 text-zinc-600 dark:text-zinc-300 truncate">{r.label}</span>
                  <span className="text-zinc-400 dark:text-zinc-500">{Math.round((r.value / totalExpenses) * 100)}%</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 w-20 text-right">{fmt(r.value)}</span>
                </li>
              ))}
            </ul>
            {plan.unassigned > 0 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Alcune categorie non hanno un gruppo.{' '}
                <Link href="/settings#gruppi-spesa" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
                  Assegnalo in Impostazioni
                </Link>
              </p>
            )}
          </div>
        )}

        {/* Contanti e carte */}
        {totalExpenses > 0 && (
          <div className="grid grid-cols-2 gap-3 text-xs border-t border-zinc-100 dark:border-zinc-700 pt-3">
            <p className="text-zinc-500 dark:text-zinc-400">
              In contanti <span className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">{fmt(plan.cash)}</span>
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 text-right">
              Carte e altri metodi <span className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">{fmt(plan.nonCash)}</span>
            </p>
          </div>
        )}
      </div>
    </Section>
  )
}
