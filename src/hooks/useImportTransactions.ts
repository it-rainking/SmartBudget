'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ParsedTransaction {
  date: string
  type: 'income' | 'expense' | 'saving'
  amount: number
  description: string
  payment_method: string | null
}

export function parseCSV(text: string): ParsedTransaction[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const header = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

  const colIndex = (names: string[]) => {
    for (const name of names) {
      const i = header.indexOf(name)
      if (i !== -1) return i
    }
    return -1
  }

  const dateCol   = colIndex(['data', 'date'])
  const typeCol   = colIndex(['tipo', 'type', 'categoria', 'category'])
  const amountCol = colIndex(['importo', 'amount', 'valore', 'value'])
  const descCol   = colIndex(['descrizione', 'description', 'nota', 'note', 'notes'])
  const methodCol = colIndex(['metodo', 'method', 'payment_method', 'pagamento'])

  if (dateCol === -1 || amountCol === -1) return []

  const TYPE_MAP: Record<string, 'income' | 'expense' | 'saving'> = {
    income: 'income', entrata: 'income', entrate: 'income', reddito: 'income',
    expense: 'expense', spesa: 'expense', spese: 'expense', uscita: 'expense',
    saving: 'saving', risparmio: 'saving', risparmi: 'saving',
  }

  const results: ParsedTransaction[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;]/).map(c => c.trim().replace(/^["']|["']$/g, ''))
    const raw = {
      date: cols[dateCol] ?? '',
      type: cols[typeCol]?.toLowerCase() ?? 'expense',
      amount: parseFloat(cols[amountCol]?.replace(',', '.') ?? '0'),
      description: descCol !== -1 ? (cols[descCol] ?? '') : '',
      method: methodCol !== -1 ? (cols[methodCol] ?? null) : null,
    }

    if (!raw.date || isNaN(raw.amount) || raw.amount <= 0) continue

    // Normalize date: try YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
    let date = raw.date
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(date)) {
      const [d, m, y] = date.split(/[\/\-]/)
      date = `${y}-${m}-${d}`
    }

    results.push({
      date,
      type: TYPE_MAP[raw.type] ?? 'expense',
      amount: raw.amount,
      description: raw.description,
      payment_method: raw.method,
    })
  }

  return results
}

export function useImportTransactions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (rows: ParsedTransaction[]) => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Non autenticato')

      // Cerca la categoria "Non categorizzato" tra le spese dell'utente
      const { data: uncatCategory } = await supabase
        .from('expense_categories')
        .select('id')
        .eq('user_id', auth.user.id)
        .eq('name', 'Non categorizzato')
        .maybeSingle()
      const uncatId = uncatCategory?.id ?? null

      const inserts = rows.map(r => ({
        user_id: auth.user!.id,
        date: r.date,
        type: r.type,
        amount: r.amount,
        description: r.description || null,
        payment_method: r.payment_method || null,
        category_id: r.type === 'expense' ? uncatId : null,
      }))

      const { error } = await supabase.from('transactions').insert(inserts)
      if (error) throw error
      return inserts.length
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['monthly_kpis'] })
      queryClient.invalidateQueries({ queryKey: ['annual_data'] })
    },
  })
}
