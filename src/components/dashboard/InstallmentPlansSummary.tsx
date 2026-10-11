'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Section } from '@/components/ui'
import { useToast } from '@/components/Toast'
import { useSettleInstallmentPlanEarly, useCancelRemainingInstallments } from '@/hooks/useInstallments'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { InstallmentPlan } from '@/types'

const INSTALLMENT_STATUS_LABEL: Record<InstallmentPlan['status'], string> = {
  programmato: 'Programmato',
  in_corso: 'In corso',
  completato: 'Completato',
}

const INSTALLMENT_STATUS_CLASS: Record<InstallmentPlan['status'], string> = {
  programmato: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  in_corso: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completato: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

// Sommario delle spese PayPal a rate che toccano il mese selezionato, con lo
// stato di avanzamento di ciascun piano (quante rate sono già state
// addebitate e quante restano) e le azioni sulle rate residue.
export function InstallmentPlansSummary({ plans, currency }: { plans: InstallmentPlan[]; currency: string }) {
  const fmt = (n: number) => formatCurrency(n, currency)
  const totalInMonth = plans.reduce((sum, p) => sum + p.amountInMonth, 0)
  const openResidual = plans.reduce((sum, p) => sum + p.remainingAmount, 0)
  const { showToast } = useToast()
  const settleEarly = useSettleInstallmentPlanEarly()
  const cancelRemaining = useCancelRemainingInstallments()
  // Azione in attesa di conferma: un secondo tap la esegue
  const [pending, setPending] = useState<{ planId: string; action: 'settle' | 'cancel' } | null>(null)
  const busy = settleEarly.isPending || cancelRemaining.isPending

  const run = async (planId: string, action: 'settle' | 'cancel') => {
    if (pending?.planId !== planId || pending.action !== action) {
      setPending({ planId, action })
      return
    }
    try {
      if (action === 'settle') {
        const n = await settleEarly.mutateAsync(planId)
        showToast(`${n} rate saldate oggi in anticipo`)
      } else {
        const n = await cancelRemaining.mutateAsync(planId)
        showToast(`${n} rate non ancora addebitate annullate`, 'info')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Operazione non riuscita', 'error')
    } finally {
      setPending(null)
    }
  }

  const active = plans.filter((p) => p.status !== 'completato').length

  return (
    <Section
      storageKey="dashboard-installments"
      title="Spese PayPal a rate"
      Icon={CreditCard}
      summary={<>
        {active === 1 ? '1 piano attivo' : `${active} piani attivi`} · rate del mese {fmt(totalInMonth)}
        {openResidual > 0 && <> · da addebitare {fmt(openResidual)}</>}
      </>}
    >
      <div className="divide-y divide-zinc-50 dark:divide-zinc-700/50">
        {plans.map((plan) => (
          <div key={plan.planId} className="px-4 sm:px-5 py-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                {plan.description || 'Spesa a rate'}
              </p>
              <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${INSTALLMENT_STATUS_CLASS[plan.status]}`}>
                {INSTALLMENT_STATUS_LABEL[plan.status]}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
              <span>{plan.chargedCount}/{plan.installmentCount} rate addebitate · Totale {fmt(plan.totalAmount)}</span>
              <span>Residuo {fmt(plan.remainingAmount)}</span>
            </div>
            <div className="h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(plan.chargedCount / plan.installmentCount) * 100}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {plan.installments.map((inst) => (
                <span
                  key={inst.id}
                  title={`Rata ${inst.number}: ${fmt(inst.amount)}`}
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    inst.status === 'addebitata'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                  }`}
                >
                  {inst.number}/{plan.installmentCount} · {formatDate(inst.date)}
                </span>
              ))}
            </div>
            {plan.missingCount > 0 && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                {plan.missingCount === 1 ? '1 rata eliminata o annullata' : `${plan.missingCount} rate eliminate o annullate`}: il totale è quello delle rate rimaste.
              </p>
            )}
            {plan.nextInstallment && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>Prossima rata {formatDate(plan.nextInstallment.date)} · {fmt(plan.nextInstallment.amount)}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(plan.planId, 'settle')}
                    className="px-2 py-1 rounded border border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                  >
                    {pending?.planId === plan.planId && pending.action === 'settle' ? 'Conferma saldo' : 'Salda ora'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(plan.planId, 'cancel')}
                    className="px-2 py-1 rounded border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    {pending?.planId === plan.planId && pending.action === 'cancel' ? 'Conferma annullo' : 'Annulla residue'}
                  </button>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}

