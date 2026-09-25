// Logica pura delle spese a rate (PayPal "Paga in 3 rate"), separata dagli
// hook per poterla testare senza Supabase.

import { daysBetween } from '@/lib/utils'
import type { InstallmentEntry, InstallmentPlan, Transaction } from '@/types'

// Limiti d'importo con cui PayPal propone di norma "Paga in 3 rate" in Italia.
// Sono condizioni commerciali che PayPal può cambiare: nel form generano solo
// un avviso, mai un blocco.
export const PAYPAL_INSTALLMENT_MIN = 30
export const PAYPAL_INSTALLMENT_MAX = 2000

// Tolleranza, in giorni, fra la data di una rata registrata e la data con cui
// lo stesso addebito compare nell'estratto conto importato (valuta/contabile).
export const INSTALLMENT_IMPORT_TOLERANCE_DAYS = 3

// Raggruppa le rate per piano e ne calcola stato e avanzamento. `rows` deve
// contenere tutte le rate dei piani (non solo quelle del mese); `monthStart` /
// `monthEnd` delimitano il mese analizzato, `today` decide cosa è addebitato.
export function buildInstallmentPlans(
  rows: Transaction[],
  monthStart: string,
  monthEnd: string,
  today: string
): InstallmentPlan[] {
  const byPlan = new Map<string, Transaction[]>()
  rows.forEach((t) => {
    if (!t.installment_plan_id) return
    const list = byPlan.get(t.installment_plan_id)
    if (list) list.push(t)
    else byPlan.set(t.installment_plan_id, [t])
  })

  const plans: InstallmentPlan[] = []

  byPlan.forEach((planRows, planId) => {
    const rowsInMonth = planRows.filter((t) => t.date >= monthStart && t.date <= monthEnd)
    if (rowsInMonth.length === 0) return

    const sorted = [...planRows].sort(
      (a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0) || a.date.localeCompare(b.date)
    )

    const installments: InstallmentEntry[] = sorted.map((t) => ({
      id: t.id,
      number: t.installment_number ?? 0,
      amount: Number(t.amount),
      date: t.date,
      // Addebitata quando la data è arrivata: le rate future sono già
      // registrate ma devono ancora essere prelevate.
      status: t.date <= today ? 'addebitata' : 'programmata',
    }))

    // Il numero di rate previsto viene dal piano, non dalle righe presenti:
    // una rata eliminata singolarmente non deve far sembrare il piano chiuso.
    const expectedCount = Math.max(installments.length, ...sorted.map((t) => t.installment_count ?? 0))
    const charged = installments.filter((i) => i.status === 'addebitata')
    const totalAmount = roundCents(installments.reduce((sum, i) => sum + i.amount, 0))
    const chargedAmount = roundCents(charged.reduce((sum, i) => sum + i.amount, 0))
    const first = sorted[0]

    plans.push({
      planId,
      description: first.description,
      categoryId: first.category_id,
      paymentMethod: first.payment_method,
      totalAmount,
      installments,
      installmentCount: expectedCount,
      missingCount: expectedCount - installments.length,
      chargedCount: charged.length,
      chargedAmount,
      remainingAmount: roundCents(totalAmount - chargedAmount),
      nextInstallment: installments.find((i) => i.status === 'programmata') ?? null,
      status:
        charged.length === 0
          ? 'programmato'
          : charged.length === installments.length
          ? 'completato'
          : 'in_corso',
      amountInMonth: roundCents(rowsInMonth.reduce((sum, t) => sum + Number(t.amount), 0)),
    })
  })

  // Piani aperti in cima, poi per data della prima rata
  return plans.sort((a, b) => {
    if (a.status === 'completato' && b.status !== 'completato') return 1
    if (b.status === 'completato' && a.status !== 'completato') return -1
    return a.installments[0].date.localeCompare(b.installments[0].date)
  })
}

export interface ImportCandidate {
  date: string
  amount: number
  type: string
}

export interface ExistingInstallmentRow {
  id: string
  date: string
  amount: number
  type: string
}

// Una rata registrata dal form ricompare nell'estratto conto con una
// descrizione diversa (es. "PAYPAL *NEGOZIO") e spesso con qualche giorno di
// scarto, quindi il controllo esatto data+importo+descrizione non la riconosce.
// Restituisce gli indici delle righe importate che corrispondono a una rata
// già registrata: stesso tipo, stesso importo al centesimo, data entro la
// tolleranza. Ogni rata esistente assorbe al massimo una riga importata.
export function findImportedInstallmentDuplicates(
  rows: ImportCandidate[],
  installments: ExistingInstallmentRow[],
  toleranceDays: number = INSTALLMENT_IMPORT_TOLERANCE_DAYS
): Set<number> {
  const used = new Set<string>()
  const duplicates = new Set<number>()

  rows.forEach((row, index) => {
    const cents = Math.round(row.amount * 100)
    let best: ExistingInstallmentRow | null = null
    let bestDistance = Infinity

    for (const inst of installments) {
      if (used.has(inst.id) || inst.type !== row.type) continue
      if (Math.round(Number(inst.amount) * 100) !== cents) continue
      const distance = Math.abs(daysBetween(inst.date, row.date))
      if (distance <= toleranceDays && distance < bestDistance) {
        best = inst
        bestDistance = distance
      }
    }

    if (best) {
      used.add(best.id)
      duplicates.add(index)
    }
  })

  return duplicates
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}
