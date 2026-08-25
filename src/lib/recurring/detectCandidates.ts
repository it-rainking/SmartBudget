// Logica pura di rilevamento pattern ricorrenti, separata dall'hook che
// interroga Supabase (src/hooks/useRecurringExpenses.ts) per poterla testare
// senza mockare il client DB. Vedi tests/recurring/detectCandidates.test.ts.

export interface RecurringCandidateGroup {
  key: string
  categoryId: string | null
  amount: number
  suggestedName: string
  paymentMethod: string | null
  dayOfMonth: number
  startDate: string
  transactionIds: string[]
  occurrences: number
  monthsCount: number
}

export interface RecurringCandidateInput {
  id: string
  category_id: string | null
  amount: number | string
  date: string
  description: string | null
  payment_method: string | null
  is_recurring: boolean | null
  is_exceptional: boolean | null
  installment_plan_id: string | null
}

// Il flag is_recurring va valorizzato a mano dal form transazioni: non lo
// imposta né l'import CSV/OFX né alcuna importazione bulk, quindi la stragrande
// maggioranza delle spese realmente ricorrenti (affitto, bollette, abbonamenti
// caricati da estratto conto) non lo ha mai avuto true. Il rilevamento si basa
// perciò sul pattern reale: stessa categoria e importo (con una tolleranza,
// per le bollette a consumo) ripetuto in almeno due mesi diversi. Una
// transazione con is_recurring=true esplicito è comunque inclusa anche da sola,
// per non perdere il segnale di chi lo ha già usato manualmente.
export const CANDIDATE_MIN_MONTHS = 2
const CANDIDATE_AMOUNT_TOLERANCE = 0.08

export function groupRecurringCandidates(
  transactions: RecurringCandidateInput[]
): RecurringCandidateGroup[] {
  // Una categoria è necessaria per raggruppare in modo affidabile; le rate
  // di un piano PayPal e i movimenti eccezionali non sono candidati validi.
  const candidates = transactions.filter(
    (t) => t.category_id && !t.installment_plan_id && !t.is_exceptional
  )

  const byCategory = new Map<string, typeof candidates>()
  for (const t of candidates) {
    const arr = byCategory.get(t.category_id!) ?? []
    arr.push(t)
    byCategory.set(t.category_id!, arr)
  }

  const groups: RecurringCandidateGroup[] = []

  byCategory.forEach((txs, categoryId) => {
    // Clusterizza per importo: ordina e accorpa i valori consecutivi entro
    // la tolleranza rispetto al primo importo del cluster (l'"ancora"),
    // non rispetto alla media che si sposta man mano che il cluster
    // cresce. Con una media mobile una sequenza fitta di importi non
    // correlati ma vicini fra loro (es. spese quotidiane della stessa
    // categoria) trascina il cluster per "effetto catena" ben oltre
    // l'importo originale, e può inglobare una transazione segnata
    // is_recurring=true in un gruppo con nome/importo suggerito che non
    // la rappresenta più: agli occhi dell'utente la spesa segnata come
    // ricorrente sembra "non individuata".
    const sorted = [...txs].sort((a, b) => Number(a.amount) - Number(b.amount))
    let cluster: typeof txs = []

    const flushCluster = () => {
      if (cluster.length === 0) return
      const distinctMonths = new Set(cluster.map((t) => t.date.slice(0, 7)))
      const hasExplicitFlag = cluster.some((t) => t.is_recurring)
      if (distinctMonths.size >= CANDIDATE_MIN_MONTHS || hasExplicitFlag) {
        const mostRecent = cluster[cluster.length - 1]
        const avgAmount = cluster.reduce((s, t) => s + Number(t.amount), 0) / cluster.length

        const descCounts = new Map<string, number>()
        const methodCounts = new Map<string, number>()
        cluster.forEach((t) => {
          if (t.description) descCounts.set(t.description, (descCounts.get(t.description) ?? 0) + 1)
          if (t.payment_method) methodCounts.set(t.payment_method, (methodCounts.get(t.payment_method) ?? 0) + 1)
        })
        const bestDescription = [...descCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
        const bestMethod = [...methodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

        groups.push({
          key: `${categoryId}::${cluster[0].id}`,
          categoryId,
          amount: Math.round(avgAmount * 100) / 100,
          suggestedName: bestDescription || mostRecent.description || '',
          paymentMethod: bestMethod ?? null,
          dayOfMonth: Number(mostRecent.date.slice(8, 10)),
          startDate: cluster[0].date,
          transactionIds: cluster.map((t) => t.id),
          occurrences: cluster.length,
          monthsCount: distinctMonths.size,
        })
      }
      cluster = []
    }

    for (const t of sorted) {
      if (cluster.length === 0) {
        cluster.push(t)
        continue
      }
      const anchor = Number(cluster[0].amount)
      if (Math.abs(Number(t.amount) - anchor) <= anchor * CANDIDATE_AMOUNT_TOLERANCE) {
        cluster.push(t)
      } else {
        flushCluster()
        cluster.push(t)
      }
    }
    flushCluster()
  })

  return groups.sort((a, b) => b.monthsCount - a.monthsCount || b.occurrences - a.occurrences)
}
