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

// Riga scartata durante il parsing, con motivo leggibile per l'utente.
export interface ParseRowError {
  location: string // es. "Riga 5" (CSV) o "Transazione #3" (OFX)
  reason: string
  raw?: string
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  errors: ParseRowError[]
}

// ─── CSV Parser ────────────────────────────────────────────────────────────────

// Parses a locale-formatted amount string, handling both European
// (1.234,56 — dot=thousands, comma=decimal) and US (1,234.56 —
// comma=thousands, dot=decimal) conventions. A naive `.replace(',', '.')`
// mangles either format's thousands separator into a bogus decimal point
// (e.g. "1.234,56" -> 1.234 instead of 1234.56).
function parseLocaleAmount(raw: string): number {
  const s = raw.trim()
  if (!s) return NaN
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(s)) {
    return parseFloat(s.replace(/,/g, ''))
  }
  if (/^-?\d{1,3}(,\d{3})+$/.test(s)) {
    return parseFloat(s.replace(/,/g, ''))
  }
  if (/^-?\d+,\d{1,2}$/.test(s)) {
    return parseFloat(s.replace(',', '.'))
  }
  return parseFloat(s.replace(',', '.'))
}

function splitCSVLine(line: string, sep: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export function parseCSV(text: string): ParseResult {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) {
    return {
      transactions: [],
      errors: [{ location: 'File', reason: 'Il file è vuoto o contiene solo l\'intestazione' }],
    }
  }

  const separator = lines[0].includes(';') ? ';' : ','
  const header = splitCSVLine(lines[0], separator).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

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

  if (dateCol === -1 || amountCol === -1) {
    const missing = [dateCol === -1 && 'data/date', amountCol === -1 && 'importo/amount']
      .filter(Boolean)
      .join(', ')
    return {
      transactions: [],
      errors: [{
        location: 'Intestazione',
        reason: `Colonna obbligatoria mancante: ${missing}`,
        raw: lines[0],
      }],
    }
  }

  const TYPE_MAP: Record<string, 'income' | 'expense' | 'saving'> = {
    income: 'income', entrata: 'income', entrate: 'income', reddito: 'income',
    expense: 'expense', spesa: 'expense', spese: 'expense', uscita: 'expense',
    saving: 'saving', risparmio: 'saving', risparmi: 'saving',
  }

  const results: ParsedTransaction[] = []
  const errors: ParseRowError[] = []

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1 // 1-based, coerente con l'editor/foglio di calcolo (riga 1 = intestazione)
    const rawLine = lines[i]
    const location = `Riga ${lineNumber}`
    const cols = splitCSVLine(rawLine, separator).map(c => c.trim().replace(/^["']|["']$/g, ''))
    const raw = {
      date: cols[dateCol] ?? '',
      type: cols[typeCol]?.toLowerCase() ?? 'expense',
      amount: parseLocaleAmount(cols[amountCol] ?? '0'),
      description: descCol !== -1 ? (cols[descCol] ?? '') : '',
      method: methodCol !== -1 ? (cols[methodCol] ?? null) : null,
    }

    if (!raw.date) {
      errors.push({ location, reason: 'Data mancante', raw: rawLine })
      continue
    }
    if (isNaN(raw.amount)) {
      errors.push({ location, reason: `Importo non numerico: "${cols[amountCol] ?? ''}"`, raw: rawLine })
      continue
    }
    if (raw.amount === 0) {
      errors.push({ location, reason: 'Importo pari a zero', raw: rawLine })
      continue
    }
    // Bank exports commonly encode expenses as negative amounts — take the
    // magnitude instead of silently discarding the row.
    raw.amount = Math.abs(raw.amount)

    // Normalize date: try YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
    let date = raw.date
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(date)) {
      const [d, m, y] = date.split(/[\/\-]/)
      date = `${y}-${m}-${d}`
    }

    // Validate resulting date is a real calendar date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push({ location, reason: `Formato data non riconosciuto: "${raw.date}"`, raw: rawLine })
      continue
    }
    const [y, m, d] = date.split('-').map(Number)
    const parsed = new Date(y, m - 1, d)
    if (parsed.getFullYear() !== y || parsed.getMonth() + 1 !== m || parsed.getDate() !== d) {
      errors.push({ location, reason: `Data non valida: "${raw.date}"`, raw: rawLine })
      continue
    }

    results.push({
      date,
      type: TYPE_MAP[raw.type] ?? 'expense',
      amount: raw.amount,
      description: raw.description,
      payment_method: raw.method,
    })
  }

  return { transactions: results, errors }
}

// ─── OFX Parser ────────────────────────────────────────────────────────────────

const CREDIT_TYPES = new Set(['CREDIT', 'DEP', 'DIRECTDEP', 'INT', 'DIV', 'XFER'])

export function parseOFX(text: string): ParseResult {
  const results: ParsedTransaction[] = []
  const errors: ParseRowError[] = []

  // Split on <STMTTRN> to get individual transaction blocks (SGML format, no closing tags)
  const blocks = text.split(/<STMTTRN>/i).slice(1)

  if (blocks.length === 0) {
    return {
      transactions: [],
      errors: [{ location: 'File', reason: 'Nessun blocco <STMTTRN> trovato — il file non sembra un estratto conto OFX/QFX valido' }],
    }
  }

  blocks.forEach((block, idx) => {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\n\r]+)`, 'i'))
      return m ? m[1].trim() : ''
    }

    const location = `Transazione #${idx + 1}`
    const trnType  = get('TRNTYPE').toUpperCase()
    const dtRaw    = get('DTPOSTED') || get('DTAVAIL')
    const amtRaw   = get('TRNAMT')
    const memo     = get('MEMO') || get('NAME') || ''

    if (!dtRaw) {
      errors.push({ location, reason: 'Data mancante (DTPOSTED/DTAVAIL)', raw: memo || undefined })
      return
    }
    if (!amtRaw) {
      errors.push({ location, reason: 'Importo mancante (TRNAMT)', raw: memo || undefined })
      return
    }

    const amt = parseFloat(amtRaw.replace(',', '.'))
    if (isNaN(amt)) {
      errors.push({ location, reason: `Importo non numerico: "${amtRaw}"`, raw: memo || undefined })
      return
    }
    if (amt === 0) {
      errors.push({ location, reason: 'Importo pari a zero', raw: memo || undefined })
      return
    }

    // Date: YYYYMMDD[HHmmss[.xxx][TZ]]
    const dateStr = dtRaw.replace(/[^\d]/g, '').substring(0, 8)
    if (dateStr.length < 8) {
      errors.push({ location, reason: `Data non valida: "${dtRaw}"`, raw: memo || undefined })
      return
    }
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
  })

  return { transactions: results, errors }
}

// ─── Rilevamento importi simili ────────────────────────────────────────────────

// Soglia di similarità: differenza percentuale rispetto all'importo maggiore.
const SIMILAR_AMOUNT_THRESHOLD = 0.05

export interface SimilarMatch {
  index: number
  date: string
  amount: number
  description: string
  diffPercent: number
}

// Segnala, per ogni riga, le altre righe dello stesso tipo che cadono nello
// stesso giorno del mese (giorno + mese, indipendentemente dall'anno) con un
// importo uguale o molto simile (<5%) — probabile doppione non rilevato dal
// controllo esatto su data+importo+descrizione fatto in fase di insert.
export function findSimilarTransactions(rows: ParsedTransaction[]): Map<number, SimilarMatch[]> {
  const matches = new Map<number, SimilarMatch[]>()

  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]
    const [, aMonth, aDay] = a.date.split('-')

    for (let j = i + 1; j < rows.length; j++) {
      const b = rows[j]
      if (a.type !== b.type) continue

      const [, bMonth, bDay] = b.date.split('-')
      if (aMonth !== bMonth || aDay !== bDay) continue

      const maxAmount = Math.max(a.amount, b.amount)
      if (maxAmount === 0) continue
      const diffPercent = Math.abs(a.amount - b.amount) / maxAmount
      if (diffPercent >= SIMILAR_AMOUNT_THRESHOLD) continue

      if (!matches.has(i)) matches.set(i, [])
      if (!matches.has(j)) matches.set(j, [])
      matches.get(i)!.push({ index: j, date: b.date, amount: b.amount, description: b.description, diffPercent })
      matches.get(j)!.push({ index: i, date: a.date, amount: a.amount, description: a.description, diffPercent })
    }
  }

  return matches
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
