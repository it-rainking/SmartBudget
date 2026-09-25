'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getMonthDateRange, getLocalDateString } from '@/lib/utils'
import { buildInstallmentPlans } from '@/lib/installments'
import type { InstallmentPlan, Transaction } from '@/types'

// Ricostruisce i piani di rateizzazione (PayPal "Paga in 3 rate") che toccano
// il mese selezionato, cioè quelli con almeno una rata nel mese.
//
// Due passi: prima gli id dei piani con una rata nel mese, poi *tutte* le rate
// di quei piani, ovunque cadano. Così il piano è completo anche se una rata è
// stata spostata a mano lontano dalle altre, senza finestre di mesi fisse.
export function useInstallmentPlans(month?: number, year?: number) {
  const currentDate = new Date()
  const m = month ?? currentDate.getMonth() + 1
  const y = year ?? currentDate.getFullYear()
  const { startDate: monthStart, endDate: monthEnd } = getMonthDateRange(m, y)

  return useQuery({
    queryKey: ['installment_plans', { month: m, year: y }],
    queryFn: async (): Promise<InstallmentPlan[]> => {
      const { data: inMonth, error: monthError } = await supabase
        .from('transactions')
        .select('installment_plan_id')
        .not('installment_plan_id', 'is', null)
        .gte('date', monthStart)
        .lte('date', monthEnd)

      if (monthError) throw monthError

      const planIds = [...new Set((inMonth ?? []).map((r) => r.installment_plan_id as string))]
      if (planIds.length === 0) return []

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .in('installment_plan_id', planIds)
        .order('date', { ascending: true })

      if (error) throw error

      return buildInstallmentPlans((data ?? []) as Transaction[], monthStart, monthEnd, getLocalDateString())
    },
  })
}

function invalidateInstallmentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['transactions'] })
  queryClient.invalidateQueries({ queryKey: ['monthly_kpis'] })
  queryClient.invalidateQueries({ queryKey: ['installment_plans'] })
  queryClient.invalidateQueries({ queryKey: ['annual_data'] })
  queryClient.invalidateQueries({ queryKey: ['actual_amounts'] })
}

// Saldo anticipato: PayPal permette di pagare subito le rate residue. Le rate
// non ancora addebitate vengono spostate a oggi, così escono dai mesi futuri
// e pesano sul mese in cui il denaro è uscito davvero.
export function useSettleInstallmentPlanEarly() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (planId: string) => {
      const today = getLocalDateString()
      const { data, error } = await supabase
        .from('transactions')
        .update({ date: today })
        .eq('installment_plan_id', planId)
        .gt('date', today)
        .select('id')

      if (error) throw error
      return data?.length ?? 0
    },
    onSuccess: () => invalidateInstallmentQueries(queryClient),
  })
}

// Annulla le sole rate non ancora addebitate (reso, rimborso, acquisto
// annullato): quelle già pagate restano nello storico.
export function useCancelRemainingInstallments() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (planId: string) => {
      const today = getLocalDateString()
      const { data, error } = await supabase
        .from('transactions')
        .delete()
        .eq('installment_plan_id', planId)
        .gt('date', today)
        .select('id')

      if (error) throw error
      return data?.length ?? 0
    },
    onSuccess: () => invalidateInstallmentQueries(queryClient),
  })
}
