'use client'

import { useMemo } from 'react'
import { useInvoices } from '@/hooks/useInvoices'
import { useGoals } from '@/hooks/useGoals'
import { useMonthlyKPIs } from '@/hooks/useTransactions'
import { useMonthlyBudget } from '@/hooks/useBudget'

export interface AppNotification {
  id: string
  type: 'warning' | 'info' | 'success'
  icon: string
  title: string
  body: string
}

export function useNotifications() {
  const today = new Date()
  const month = today.getMonth() + 1
  const year = today.getFullYear()

  const { data: invoices } = useInvoices()
  const { data: goals } = useGoals()
  const { data: kpis } = useMonthlyKPIs(month, year)
  const { data: budget } = useMonthlyBudget(month, year)

  const notifications = useMemo<AppNotification[]>(() => {
    const items: AppNotification[] = []
    const todayStr = today.toISOString().split('T')[0]

    // Fatture in scadenza nei prossimi 7 giorni
    invoices?.forEach(inv => {
      if (inv.status === 'paid' || inv.status === 'cancelled') return
      const diff = Math.ceil((new Date(inv.due_date).getTime() - today.getTime()) / 86400000)
      if (diff >= 0 && diff <= 7) {
        items.push({
          id: `inv-due-${inv.id}`,
          type: diff <= 2 ? 'warning' : 'info',
          icon: diff <= 2 ? '⚠️' : '📅',
          title: diff === 0 ? 'Fattura in scadenza oggi' : `Fattura in scadenza tra ${diff} giorni`,
          body: `${inv.name} — €${inv.amount.toFixed(2)}`,
        })
      }
    })

    // Fatture scadute
    const overdue = invoices?.filter(inv => inv.status === 'overdue') ?? []
    if (overdue.length > 0) {
      items.push({
        id: 'invoices-overdue',
        type: 'warning',
        icon: '🔴',
        title: `${overdue.length} fattura${overdue.length > 1 ? 'e' : ''} scaduta${overdue.length > 1 ? '' : ''}`,
        body: overdue.map(i => i.name).join(', '),
      })
    }

    // Obiettivi quasi completati (>= 90%)
    goals?.filter(g => !g.is_completed).forEach(g => {
      const pct = g.current_amount / g.target_amount
      if (pct >= 0.9) {
        items.push({
          id: `goal-near-${g.id}`,
          type: 'success',
          icon: '🏆',
          title: 'Obiettivo quasi raggiunto!',
          body: `${g.name} — ${Math.round(pct * 100)}% completato`,
        })
      }
    })

    // Budget mensile sforato
    if (kpis && budget) {
      const budgetedExpenses = (budget.items ?? [])
        .filter(i => i.category_type === 'expense')
        .reduce((s, i) => s + i.planned_amount, 0)
      if (budgetedExpenses > 0 && kpis.totalExpenses > budgetedExpenses * 1.1) {
        items.push({
          id: 'budget-overrun',
          type: 'warning',
          icon: '📊',
          title: 'Budget spese superato',
          body: `Spese attuali superiori del ${Math.round(((kpis.totalExpenses / budgetedExpenses) - 1) * 100)}% al budget`,
        })
      }
    }

    // Saldo negativo questo mese
    if (kpis && kpis.balance < 0) {
      items.push({
        id: 'negative-balance',
        type: 'warning',
        icon: '📉',
        title: 'Saldo mensile negativo',
        body: `Le spese superano le entrate questo mese`,
      })
    }

    void todayStr
    return items
  }, [invoices, goals, kpis, budget])

  return notifications
}
