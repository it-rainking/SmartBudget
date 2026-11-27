// Confronto dei movimenti importati con le transazioni già salvate.
// - doppione certo (stesso external_id, o stessa data + importo + descrizione):
//   scartato e segnalato;
// - rata PayPal già registrata: scartata; PayPal senza rata resta da verificare;
// - possibile doppione (stessi criteri del controllo doppioni di
//   /transazioni, src/lib/duplicates.ts): l'utente sceglie cosa fare.

import {
  AMOUNT_MAX_DAY_GAP,
  AMOUNT_TOLERANCE,
  DESCRIPTION_AMOUNT_TOLERANCE,
  DESCRIPTION_MAX_DAY_GAP,
  DESCRIPTION_SIMILARITY_MIN,
  descriptionSimilarity,
} from '@/lib/duplicates'
import { findImportedInstallmentDuplicates } from '@/lib/installments'
import { daysBetween } from '@/lib/utils'
import type { StatementCandidate } from './types'

export interface ExistingTransaction {
  id: string
  date: string
  amount: number
  type: string
  description: string | null
  external_id?: string | null
  installment_plan_id?: string | null
}

export type DuplicateDecision = 'skip' | 'import' | 'replace'

export interface ReviewItem extends StatementCandidate {
  /** Transazione esistente simile: la riga è un possibile doppione. */
  match?: ExistingTransaction
  decision?: DuplicateDecision
}

const relGap = (a: number, b: number) => {
  const max = Math.max(Math.abs(a), Math.abs(b))
  return max === 0 ? 0 : Math.abs(a - b) / max
}
const descKey = (s: string | null | undefined) => (s ?? '').toLowerCase().trim()

export function classifyAgainstExisting(candidates: StatementCandidate[], existing: ExistingTransaction[]): ReviewItem[] {
  const byExternal = new Set(existing.map(t => t.external_id).filter(Boolean) as string[])
  const exactKeys = new Set(existing.map(t => `${t.date}|${Math.round(Number(t.amount) * 100)}|${descKey(t.description)}`))
  const installments = existing
    .filter(t => t.installment_plan_id)
    .map(t => ({ id: t.id, date: t.date, amount: Number(t.amount), type: t.type }))

  const items: ReviewItem[] = candidates.map(c => ({ ...c }))
  const active = (i: ReviewItem) => i.status !== 'skip'

  for (const item of items) {
    if (!active(item)) continue
    if (byExternal.has(item.external_id)) {
      Object.assign(item, { status: 'skip', reason: 'Già importato da un estratto precedente' })
    } else if (exactKeys.has(`${item.date}|${Math.round(item.amount * 100)}|${descKey(item.description)}`)) {
      Object.assign(item, { status: 'skip', reason: 'Già presente (stessa data, importo e descrizione)' })
    }
  }

  // Rate PayPal registrate dal form: riconosciute per importo e data ±3 giorni.
  const pending = items.filter(active)
  const instDup = findImportedInstallmentDuplicates(pending, installments)
  pending.forEach((item, i) => {
    if (instDup.has(i)) Object.assign(item, { status: 'skip', reason: 'Rata già registrata' })
  })

  // Possibili doppioni: ogni transazione esistente viene abbinata al più a
  // una riga, la più vicina.
  const used = new Set<string>()
  const candidatesForMatch = existing.filter(t => !t.installment_plan_id)
  for (const item of items) {
    if (!active(item)) continue
    let best: ExistingTransaction | undefined
    let bestScore = Infinity
    for (const t of candidatesForMatch) {
      if (used.has(t.id) || t.type !== item.type) continue
      const gap = Math.abs(daysBetween(t.date, item.date))
      if (gap > DESCRIPTION_MAX_DAY_GAP) continue
      const amountGap = relGap(Number(t.amount), item.amount)
      const byAmount = gap <= AMOUNT_MAX_DAY_GAP && amountGap <= AMOUNT_TOLERANCE
      const byDescription = amountGap <= DESCRIPTION_AMOUNT_TOLERANCE &&
        descriptionSimilarity(t.description, item.description) >= DESCRIPTION_SIMILARITY_MIN
      if (!byAmount && !byDescription) continue
      const score = gap + amountGap * 10
      if (score < bestScore) { best = t; bestScore = score }
    }
    if (best) {
      used.add(best.id)
      item.match = best
      item.decision = 'skip'
    }
  }

  return items
}

/** true se la riga entra nell'import con le scelte correnti. */
export function isSelected(item: ReviewItem, included: ReadonlySet<string>): boolean {
  if (item.match) return item.decision === 'import' || item.decision === 'replace'
  return included.has(item.external_id)
}

/** Selezione iniziale: tutto tranne scartati e possibili doppioni. */
export function defaultIncluded(items: ReviewItem[]): Set<string> {
  return new Set(items.filter(i => i.status !== 'skip' && !i.match).map(i => i.external_id))
}
