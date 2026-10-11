// Rilevamento di possibili doppioni tra le transazioni di un elenco (logica
// pura, testata in tests/duplicates/duplicates.test.ts).
//
// Due criteri, dal più affidabile al più debole:
// 1. importo: stesso tipo, stesso importo al centesimo (o scarto entro
//    AMOUNT_TOLERANCE), date a distanza massima di AMOUNT_MAX_DAY_GAP giorni;
// 2. descrizione: stesso tipo, descrizioni simili (vedi descriptionSimilarity),
//    importi entro DESCRIPTION_AMOUNT_TOLERANCE, date entro
//    DESCRIPTION_MAX_DAY_GAP giorni.
// Una coppia che soddisfa entrambi è "importo + descrizione", la più probabile.

export const AMOUNT_TOLERANCE = 0.01 // 1%
export const AMOUNT_MAX_DAY_GAP = 1
export const DESCRIPTION_SIMILARITY_MIN = 0.6
export const DESCRIPTION_AMOUNT_TOLERANCE = 0.1 // 10%
export const DESCRIPTION_MAX_DAY_GAP = 3

export interface DuplicateCandidate {
  id: string
  type: string
  amount: number
  date: string // YYYY-MM-DD
  description?: string | null
  installment_plan_id?: string | null
}

export type DuplicateReason = 'amount' | 'description' | 'both'

export interface DuplicatePair<T extends DuplicateCandidate = DuplicateCandidate> {
  key: string
  a: T
  b: T
  reason: DuplicateReason
  dayGap: number
  similarity: number
}

/** Chiave stabile della coppia, indipendente dall'ordine. */
export function duplicatePairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

function relativeGap(x: number, y: number): number {
  const max = Math.max(Math.abs(x), Math.abs(y))
  return max === 0 ? 0 : Math.abs(x - y) / max
}

// Parole tipiche degli estratti conto che non distinguono un movimento
// dall'altro ("PAGAMENTO POS 12/03 CARTA ****1234").
const STOPWORDS = new Set([
  'pagamento', 'pag', 'pos', 'carta', 'addebito', 'bonifico', 'sdd', 'del', 'della',
  'di', 'da', 'a', 'il', 'la', 'lo', 'e', 'per', 'presso', 'op', 'operazione', 'n',
])

export function normalizeDescription(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 1 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
}

/** Similarità 0..1 tra due descrizioni (Jaccard sulle parole significative). */
export function descriptionSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const wa = new Set(normalizeDescription(a))
  const wb = new Set(normalizeDescription(b))
  if (wa.size === 0 || wb.size === 0) return 0
  let common = 0
  for (const w of wa) if (wb.has(w)) common++
  return common / (wa.size + wb.size - common)
}

export function findPossibleDuplicates<T extends DuplicateCandidate>(
  transactions: T[],
  dismissed: ReadonlySet<string> = new Set(),
): DuplicatePair<T>[] {
  const items = transactions
    .map((t) => ({ t, day: dayNumber(t.date) }))
    .sort((x, y) => x.day - y.day)
  const maxGap = Math.max(AMOUNT_MAX_DAY_GAP, DESCRIPTION_MAX_DAY_GAP)
  const pairs: DuplicatePair<T>[] = []

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const dayGap = items[j].day - items[i].day
      if (dayGap > maxGap) break
      const a = items[i].t
      const b = items[j].t
      if (a.type !== b.type) continue
      // Rate dello stesso piano: importi uguali per costruzione, non doppioni
      if (a.installment_plan_id && a.installment_plan_id === b.installment_plan_id) continue
      const key = duplicatePairKey(a.id, b.id)
      if (dismissed.has(key)) continue

      const amountGap = relativeGap(a.amount, b.amount)
      const similarity = descriptionSimilarity(a.description, b.description)
      const byAmount = dayGap <= AMOUNT_MAX_DAY_GAP &&
        (Math.abs(a.amount - b.amount) < 0.005 || amountGap <= AMOUNT_TOLERANCE)
      const byDescription = dayGap <= DESCRIPTION_MAX_DAY_GAP &&
        similarity >= DESCRIPTION_SIMILARITY_MIN &&
        amountGap <= DESCRIPTION_AMOUNT_TOLERANCE
      if (!byAmount && !byDescription) continue

      pairs.push({
        key,
        a,
        b,
        reason: byAmount && byDescription ? 'both' : byAmount ? 'amount' : 'description',
        dayGap,
        similarity,
      })
    }
  }

  const rank: Record<DuplicateReason, number> = { both: 0, amount: 1, description: 2 }
  return pairs.sort((x, y) => rank[x.reason] - rank[y.reason] || x.dayGap - y.dayGap)
}

/**
 * Indice di colore (0/1) per riga: cambia a ogni cambio di data tra righe
 * consecutive dell'elenco, non a ogni giorno di calendario. Due giorni con
 * transazioni separati da un giorno vuoto hanno quindi colori diversi.
 */
export function dayBandIndexes(dates: string[]): number[] {
  const bands: number[] = []
  let band = 0
  dates.forEach((date, i) => {
    if (i > 0 && date !== dates[i - 1]) band = 1 - band
    bands.push(band)
  })
  return bands
}
