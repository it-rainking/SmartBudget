// Parser dell'estratto conto Revolut (.csv).
//
// Intestazione (italiano o inglese):
// Tipo,Prodotto,Data di inizio,Data di completamento,Descrizione,Importo,Costo,Valuta,State,Saldo
//
// Il CSV originale usa "," come separatore e il punto decimale. Se il file è
// stato aperto e salvato da Excel con impostazioni italiane, il separatore
// diventa ";" e Excel legge il punto come separatore delle migliaia: -19.50
// diventa -1950. In quel caso gli importi interi vengono divisi per 100 e la
// catena dei saldi (saldo precedente + importo − costo = saldo) segnala le
// righe che non tornano.

import { parseAmount, parseDayFirstDate, splitCsvLine } from './parse'
import type { ParsedStatement, RawMovement } from './types'

const HEADERS = {
  type: ['tipo', 'type'],
  product: ['prodotto', 'product'],
  started: ['data di inizio', 'started date'],
  completed: ['data di completamento', 'completed date'],
  description: ['descrizione', 'description'],
  amount: ['importo', 'amount'],
  fee: ['costo', 'fee', 'commissione'],
  currency: ['valuta', 'currency'],
  state: ['state', 'stato'],
  balance: ['saldo', 'balance'],
}

function headerOf(text: string): { sep: string; cols: string[] } | null {
  const first = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? ''
  const sep = first.split(';').length > first.split(',').length ? ';' : ','
  const cols = splitCsvLine(first, sep).map(c => c.replace(/^"|"$/g, '').toLowerCase())
  return cols.length > 1 ? { sep, cols } : null
}

export function isRevolutCsv(text: string): boolean {
  const h = headerOf(text)
  if (!h) return false
  const has = (names: string[]) => names.some(n => h.cols.includes(n))
  return has(HEADERS.started) && has(HEADERS.completed) && has(HEADERS.amount) && has(HEADERS.product)
}

const INTEGER = /^[-+]?\d+$/

export function parseRevolutCsv(text: string): ParsedStatement {
  const errors: ParsedStatement['errors'] = []
  const warnings: string[] = []
  const h = headerOf(text)
  if (!h || !isRevolutCsv(text)) {
    return { source: 'revolut', movements: [], errors: [{ location: 'File', reason: 'Intestazione Revolut non riconosciuta' }], warnings }
  }
  const idx = (names: string[]) => h.cols.findIndex(c => names.includes(c))
  const c = Object.fromEntries(Object.entries(HEADERS).map(([k, v]) => [k, idx(v)])) as Record<keyof typeof HEADERS, number>

  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const rows = lines
    .map((l, i) => ({ line: i + 1, cells: splitCsvLine(l, h.sep) }))
    .slice(1)
    .filter(r => r.cells.some(x => x !== ''))

  // File salvato da Excel: separatore ";" e importi quasi tutti interi.
  const amountCells = rows.map(r => r.cells[c.amount] ?? '').filter(Boolean)
  const integerShare = amountCells.length ? amountCells.filter(a => INTEGER.test(a)).length / amountCells.length : 0
  const excelMangled = h.sep === ';' && integerShare >= 0.8
  if (excelMangled) {
    warnings.push('Il file sembra salvato da Excel: gli importi senza decimali sono stati divisi per 100. Le righe il cui saldo non torna sono da verificare. Per evitarlo, carica il CSV così come lo scarichi da Revolut.')
  }

  const num = (raw: string | undefined): number => {
    const s = (raw ?? '').trim()
    if (!s) return 0
    if (excelMangled && INTEGER.test(s)) return parseInt(s, 10) / 100
    return parseAmount(s)
  }

  const movements: RawMovement[] = []
  const lastBalance = new Map<string, number>()

  for (const { line, cells } of rows) {
    const location = `Riga ${line}`
    const started = cells[c.started] ?? ''
    const completed = c.completed !== -1 ? cells[c.completed] ?? '' : ''
    const date = parseDayFirstDate(completed) ?? parseDayFirstDate(started)
    if (!date) {
      errors.push({ location, reason: `Data non riconosciuta: "${completed || started}"` })
      continue
    }
    const amount = num(cells[c.amount])
    if (Number.isNaN(amount)) {
      errors.push({ location, reason: `Importo non numerico: "${cells[c.amount]}"` })
      continue
    }
    if (amount === 0) {
      errors.push({ location, reason: 'Importo pari a zero' })
      continue
    }
    const fee = c.fee !== -1 ? Math.abs(num(cells[c.fee]) || 0) : 0
    const balanceRaw = c.balance !== -1 ? (cells[c.balance] ?? '').trim() : ''
    const balance = balanceRaw ? num(balanceRaw) : null
    const product = c.product !== -1 ? cells[c.product] ?? '' : ''

    const m: RawMovement = {
      source: 'revolut',
      line,
      date,
      amount: Math.round(amount * 100) / 100,
      fee: Math.round(fee * 100) / 100,
      currency: (c.currency !== -1 ? cells[c.currency] : '') || 'EUR',
      description: (cells[c.description] ?? '').trim(),
      kind: (cells[c.type] ?? '').trim(),
      product,
      state: (c.state !== -1 ? cells[c.state] : '') ?? '',
      balance: balance !== null && !Number.isNaN(balance) ? balance : null,
      startedAt: started,
    }

    if (m.balance !== null && m.balance !== undefined) {
      const key = `${product}|${m.currency}`
      const prev = lastBalance.get(key)
      if (prev !== undefined && Math.abs(prev + m.amount - m.fee - m.balance) > 0.011) {
        m.warning = 'Il saldo riportato non torna con l\'importo: controlla la cifra'
      }
      lastBalance.set(key, m.balance)
    }
    movements.push(m)
  }

  return { source: 'revolut', movements, errors, warnings }
}
