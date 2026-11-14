// Formati del confronto fondo pensione. Gli importi sono in euro per
// costruzione (fondi pensione italiani), indipendenti da settings.currency.

const nf = (digits: number) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const has = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

export function formatPct(v: number | null | undefined, digits = 2): string {
  return has(v) ? `${nf(digits).format(v)}%` : 'n.d.'
}

/** Differenza in punti percentuali con segno esplicito */
export function formatPoints(v: number | null | undefined): string {
  if (!has(v)) return 'n.d.'
  const sign = v > 0.0049 ? '+' : v < -0.0049 ? '−' : ''
  return sign + nf(2).format(Math.abs(v))
}

export function formatEur(v: number | null | undefined): string {
  return has(v) ? eur.format(v) : 'n.d.'
}

export function formatSignedEur(v: number): string {
  return (v > 0 ? '+' : v < 0 ? '−' : '') + eur.format(Math.abs(v))
}

/** Classe colore per una differenza: verde se a favore, rosso se contro */
export function toneClass(v: number | null | undefined): string {
  if (!has(v)) return 'text-zinc-500 dark:text-zinc-400'
  if (v > 0.0049) return 'text-emerald-600 dark:text-emerald-400'
  if (v < -0.0049) return 'text-red-600 dark:text-red-400'
  return 'text-zinc-500 dark:text-zinc-400'
}
