'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getLocalDateString } from '@/lib/utils'
import type { Invoice } from '@/types'

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('due_date', { ascending: true })

      if (error) throw error
      return (data as Invoice[]).map(applyDynamicStatus)
    },
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<Invoice, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Non autenticato')

      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({ ...data, user_id: auth.user.id })
        .select()
        .single()

      if (error) throw error
      return invoice as Invoice
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useMarkAsPaid() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, paidAmount }: { id: string; paidAmount?: number }) => {
      const today = getLocalDateString()
      const { data, error } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_date: today, paid_amount: paidAmount ?? null })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Invoice
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Omit<Invoice, 'id' | 'user_id'>> }) => {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return invoice as Invoice
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

function applyDynamicStatus(invoice: Invoice): Invoice {
  if (invoice.status === 'paid' || invoice.status === 'cancelled') return invoice
  const today = getLocalDateString()
  if (invoice.due_date < today) return { ...invoice, status: 'overdue' }
  return invoice
}
