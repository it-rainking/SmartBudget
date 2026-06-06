'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ParsedTransaction {
  date: string
  type: 'income' | 'expense' | 'saving'
  amount: number
  description: string
  payment_method: string | null
  category_id?: string | null
  category_name?: string
}

// ─── CSV Parser ────────────────────────────────────────────────────────────────

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

// ─── OFX Parser ────────────────────────────────────────────────────────────────

const CREDIT_TYPES = new Set(['CREDIT', 'DEP', 'DIRECTDEP', 'INT', 'DIV', 'XFER'])

export function parseOFX(text: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = []

  // Split on <STMTTRN> to get individual transaction blocks (SGML format, no closing tags)
  const blocks = text.split(/<STMTTRN>/i).slice(1)

  for (const block of blocks) {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\n\r]+)`, 'i'))
      return m ? m[1].trim() : ''
    }

    const trnType  = get('TRNTYPE').toUpperCase()
    const dtRaw    = get('DTPOSTED') || get('DTAVAIL')
    const amtRaw   = get('TRNAMT')
    const memo     = get('MEMO') || get('NAME') || ''

    if (!dtRaw || !amtRaw) continue

    const amt = parseFloat(amtRaw.replace(',', '.'))
    if (isNaN(amt) || amt === 0) continue

    // Date: YYYYMMDD[HHmmss[.xxx][TZ]]
    const dateStr = dtRaw.replace(/[^\d]/g, '').substring(0, 8)
    if (dateStr.length < 8) continue
    const date = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`

    const isCredit = amt > 0 || CREDIT_TYPES.has(trnType)
    const type: 'income' | 'expense' = isCredit ? 'income' : 'expense'

    results.push({
      date,
      type,
      amount: Math.abs(amt),
      description: memo,
      payment_method: null,
    })
  }

  return results
}

// ─── Import Mutation ───────────────────────────────────────────────────────────

export function useImportTransactions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (rows: ParsedTransaction[]): Promise<{ inserted: number; skipped: number }> => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Non autenticato')

      // Recupera la categoria "Non categorizzato" per le spese senza categoria
      const { data: uncatCategory } = await supabase
        .from('expense_categories')
        .select('id')
        .eq('user_id', auth.user.id)
        .eq('name', 'Non categorizzato')
        .maybeSingle()
      const uncatId = uncatCategory?.id ?? null

      // Rilevamento duplicati: query transazioni esistenti nell'intervallo di date delle righe
      const dates = rows.map(r => r.date)
      const minDate = dates.reduce((a, b) => (a < b ? a : b))
      const maxDate = dates.reduce((a, b) => (a > b ? a : b))

      const { data: existing } = await supabase
        .from('transactions')
        .select('date, amount, description')
        .eq('user_id', auth.user.id)
        .gte('date', minDate)
        .lte('date', maxDate)

      const existingKeys = new Set(
        (existing ?? []).map(t =>
          `${t.date}|${t.amount}|${(t.description ?? '').toLowerCase().trim()}`
        )
      )

      const unique = rows.filter(r => {
        const key = `${r.date}|${r.amount}|${r.description.toLowerCase().trim()}`
        return !existingKeys.has(key)
      })

      if (unique.length === 0) return { inserted: 0, skipped: rows.length }

      const inserts = unique.map(r => ({
        user_id: auth.user!.id,
        date: r.date,
        type: r.type,
        amount: r.amount,
        description: r.description || null,
        payment_method: r.payment_method || null,
        // Usa category_id se fornita dall'AI, altrimenti fallback alla categoria default
        category_id: r.category_id !== undefined
          ? r.category_id
          : (r.type === 'expense' ? uncatId : null),
      }))

      const { error } = await supabase.from('transactions').insert(inserts)
      if (error) throw error

      return { inserted: unique.length, skipped: rows.length - unique.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['monthly_kpis'] })
      queryClient.invalidateQueries({ queryKey: ['annual_data'] })
    },
  })
}
