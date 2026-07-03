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
