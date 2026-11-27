// Parser dell'export movimenti del conto Fineco (.xlsx).
// Struttura del file: una dozzina di righe di intestazione (conto,
// intestatario, periodo, note), poi la riga
// Data_Operazione | Data_Valuta | Entrate | Uscite | Descrizione | Descrizione_Completa | Stato
// e i movimenti, una sola tra Entrate e Uscite valorizzata.

import { excelSerialToDate, type XlsxCell } from './xlsx'
import { parseAmount, parseDayFirstDate } from './parse'
import type { ParsedStatement, RawMovement } from './types'

const norm = (v: XlsxCell) => String(v ?? '').trim().toLowerCase()

/** true se le righe contengono l'intestazione dei movimenti Fineco. */
export function isFinecoSheet(rows: XlsxCell[][]): boolean {
  return findHeader(rows) !== -1
}

function findHeader(rows: XlsxCell[][]): number {
  return rows.findIndex(r => r.some(c => norm(c) === 'data_operazione') && r.some(c => norm(c) === 'descrizione_completa'))
}

function toDate(v: XlsxCell): string | null {
  if (typeof v === 'number' && v > 20000 && v < 80000) return excelSerialToDate(v)
  if (typeof v === 'string') return parseDayFirstDate(v.trim())
  return null
}

function toAmount(v: XlsxCell): number | null {
  if (v === null || v === '') return null
  if (typeof v === 'number') return v
  const n = parseAmount(String(v))
  return Number.isNaN(n) ? null : n
}

export function parseFinecoRows(rows: XlsxCell[][]): ParsedStatement {
  const errors: ParsedStatement['errors'] = []
  const headerIdx = findHeader(rows)
  if (headerIdx === -1) {
    return { source: 'fineco', movements: [], errors: [{ location: 'File', reason: 'Intestazione dei movimenti Fineco non trovata' }], warnings: [] }
  }

  let holder: string | undefined
  for (const r of rows.slice(0, headerIdx)) {
    const m = String(r[0] ?? '').match(/^Intestazione Conto Corrente:\s*(.+)$/i)
    if (m) holder = m[1].trim()
  }

  const header = rows[headerIdx].map(norm)
  const col = (name: string) => header.indexOf(name)
  const cOp = col('data_operazione')
  const cVal = col('data_valuta')
  const cIn = col('entrate')
  const cOut = col('uscite')
  const cKind = col('descrizione')
  const cDesc = col('descrizione_completa')
  const cState = col('stato')

  const movements: RawMovement[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? []
    if (!r.some(c => c !== null && c !== '')) continue
    const line = i + 1
    const location = `Riga ${line}`

    // Data valuta: per le carte di debito la data operazione è il giorno di
    // contabilizzazione, la valuta è quello del pagamento.
    const date = toDate(r[cVal]) ?? toDate(r[cOp])
    if (!date) {
      errors.push({ location, reason: 'Data mancante o non riconosciuta' })
      continue
    }
    const inAmt = cIn !== -1 ? toAmount(r[cIn]) : null
    const outAmt = cOut !== -1 ? toAmount(r[cOut]) : null
    const amount = inAmt ? Math.abs(inAmt) : outAmt ? -Math.abs(outAmt) : 0
    if (amount === 0) {
      errors.push({ location, reason: 'Importo mancante o pari a zero' })
      continue
    }

    const kind = String(r[cKind] ?? '').trim()
    const full = String(r[cDesc] ?? '').trim()
    movements.push({
      source: 'fineco',
      line,
      date,
      amount: Math.round(amount * 100) / 100,
      fee: 0,
      currency: 'EUR',
      description: full || kind,
      kind,
      state: String(r[cState] ?? '').trim(),
    })
  }

  return { source: 'fineco', movements, errors, warnings: [], holder }
}
