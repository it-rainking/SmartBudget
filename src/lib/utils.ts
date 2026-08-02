export function formatCurrency(amount: number, currency = 'EUR', locale = 'it-IT'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(dateStr: string, locale = 'it-IT'): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatMonth(month: number, year: number, locale = 'it-IT'): string {
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })
}

export function getMonthDateRange(month: number, year: number): { startDate: string; endDate: string } {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  // Use getDate() (local calendar), not toISOString() (UTC) — otherwise the
  // last day of the month shifts back a day in any positive UTC offset zone.
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { startDate, endDate }
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

// Elenco predefinito dei metodi di pagamento. Usato come fallback quando
// l'utente non ha ancora personalizzato la propria lista in `settings`.
export const DEFAULT_PAYMENT_METHODS = ['Contanti', 'Carta', 'Bonifico', 'PayPal', 'Altro']

// Restituisce l'elenco effettivo dei metodi di pagamento: la lista salvata
// nelle impostazioni utente se presente e non vuota, altrimenti i default.
export function getPaymentMethods(methods?: string[] | null): string[] {
  return methods && methods.length > 0 ? methods : DEFAULT_PAYMENT_METHODS
}

// Today's date as YYYY-MM-DD in the *local* calendar. Do not use
// `new Date().toISOString().split('T')[0]` for this — it returns the UTC
// calendar date, which is a day behind local time for part of every day in
// any positive UTC offset timezone (e.g. Europe/Rome).
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Parses a 'YYYY-MM-DD' string as local midnight, not `new Date(str)`'s
// UTC-midnight interpretation — needed when diffing two such dates in days.
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Whole calendar days between two 'YYYY-MM-DD' strings (b - a), independent
// of time-of-day/timezone.
export function daysBetween(aStr: string, bStr: string): number {
  return Math.round((parseLocalDate(bStr).getTime() - parseLocalDate(aStr).getTime()) / 86400000)
}

// ── Spese a rate (PayPal "Paga in 3 rate") ──────────────────────────────────

// Numero di rate del piano PayPal: prima rata all'acquisto + 2 mensili.
export const PAYPAL_INSTALLMENT_COUNT = 3

// Riconosce PayPal fra i metodi di pagamento, che l'utente può rinominare
// dalle impostazioni (es. "PayPal Business"): confronto case-insensitive.
export function isPaypalMethod(method?: string | null): boolean {
  return !!method && method.toLowerCase().includes('paypal')
}

// Somma `months` mesi a una data 'YYYY-MM-DD' mantenendo lo stesso giorno del
// mese. Se il mese di destinazione è più corto (31/01 + 1 mese) si usa il suo
// ultimo giorno, come fanno gli addebiti ricorrenti PayPal.
export function addMonthsClamped(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const absoluteMonth = (m - 1) + months
  const targetYear = y + Math.floor(absoluteMonth / 12)
  const targetMonth = ((absoluteMonth % 12) + 12) % 12
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
  const day = Math.min(d, lastDay)
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Ripartisce un totale in `count` rate arrotondate al centesimo. Il resto
// della divisione finisce sulla prima rata (100 € → 33,34 + 33,33 + 33,33),
// così la somma delle rate è sempre esattamente il totale.
export function splitInstallments(total: number, count: number = PAYPAL_INSTALLMENT_COUNT): number[] {
  const totalCents = Math.round(total * 100)
  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base) / 100)
}

// Date delle rate a partire dalla data della prima: stesso giorno nei mesi
// successivi.
export function installmentDates(startDate: string, count: number = PAYPAL_INSTALLMENT_COUNT): string[] {
  return Array.from({ length: count }, (_, i) => addMonthsClamped(startDate, i))
}
