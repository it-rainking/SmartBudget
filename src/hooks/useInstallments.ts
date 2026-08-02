'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getMonthDateRange, getLocalDateString } from '@/lib/utils'
import type { InstallmentEntry, InstallmentPlan, Transaction } from '@/types'

// Ricostruisce i piani di rateizzazione (PayPal "Paga in 3 rate") che toccano
// il mese selezionato, cioè quelli con almeno una rata nel mese.
//
// Le rate di un piano si distribuiscono su mesi consecutivi, quindi per avere
// *tutte* le rate di un piano che tocca il mese M basta leggere la finestra
// [M - (n-1), M + (n-1)]. Con n = 3 rate servono ±2 mesi; si usa ±5 per
// coprire anche eventuali piani più lunghi creati a mano.
const WINDOW_MONTHS = 5

export function useInstallmentPlans(month?: number, year?: number) {
  const currentDate = new Date()
  const m = month ?? currentDate.getMonth() + 1
  const y = year ?? currentDate.getFullYear()

  const { startDate: monthStart, endDate: monthEnd } = getMonthDateRange(m, y)

  const windowStartDate = new Date(y, m - 1 - WINDOW_MONTHS, 1)
  const { startDate: windowStart } = getMonthDateRange(
    windowStartDate.getMonth() + 1,
    windowStartDate.getFullYear()
  )
  const windowEndDate = new Date(y, m - 1 + WINDOW_MONTHS, 1)
  const { endDate: windowEnd } = getMonthDateRange(
    windowEndDate.getMonth() + 1,
    windowEndDate.getFullYear()
  )

  return useQuery({
    queryKey: ['installment_plans', { month: m, year: y }],
    queryFn: async (): Promise<InstallmentPlan[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .not('installment_plan_id', 'is', null)
        .gte('date', windowStart)
        .lte('date', windowEnd)
        .order('date', { ascending: true })

      if (error) throw error

      const today = getLocalDateString()
      const byPlan = new Map<string, Transaction[]>()

      ;(data as Transaction[] ?? []).forEach((t) => {
        if (!t.installment_plan_id) return
        const rows = byPlan.get(t.installment_plan_id)
        if (rows) rows.push(t)
        else byPlan.set(t.installment_plan_id, [t])
      })

      const plans: InstallmentPlan[] = []

      byPlan.forEach((rows, planId) => {
        // Solo i piani con almeno una rata nel mese analizzato
        const rowsInMonth = rows.filter((t) => t.date >= monthStart && t.date <= monthEnd)
        if (rowsInMonth.length === 0) return

        const sorted = [...rows].sort(
          (a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0)
        )

        const installments: InstallmentEntry[] = sorted.map((t) => ({
          id: t.id,
          number: t.installment_number ?? 0,
          amount: Number(t.amount),
          date: t.date,
          // Una rata è "addebitata" quando la sua data è arrivata: le rate
          // future sono già registrate ma devono ancora essere prelevate.
          status: t.date <= today ? 'addebitata' : 'programmata',
        }))

        const charged = installments.filter((i) => i.status === 'addebitata')
        const totalAmount = installments.reduce((sum, i) => sum + i.amount, 0)
        const chargedAmount = charged.reduce((sum, i) => sum + i.amount, 0)
        const first = sorted[0]

        plans.push({
          planId,
          description: first.description,
          categoryId: first.category_id,
          paymentMethod: first.payment_method,
          totalAmount,
          installments,
          chargedCount: charged.length,
          chargedAmount,
          remainingAmount: totalAmount - chargedAmount,
          status:
            charged.length === 0
              ? 'programmato'
              : charged.length === installments.length
              ? 'completato'
              : 'in_corso',
          amountInMonth: rowsInMonth.reduce((sum, t) => sum + Number(t.amount), 0),
        })
      })

      // Piani ancora aperti in cima, poi per data della prima rata
      return plans.sort((a, b) => {
        if (a.status === 'completato' && b.status !== 'completato') return 1
        if (b.status === 'completato' && a.status !== 'completato') return -1
        return a.installments[0].date.localeCompare(b.installments[0].date)
      })
    },
  })
}
