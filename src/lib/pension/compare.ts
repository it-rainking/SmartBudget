// Confronto fondo pensione: logica pura (nessun accesso a DB o DOM).
// Dati COVIP e linee dei fondi aperti in ./data, aggiornati a mano: vedi
// la sezione "Confronto fondo pensione" in CLAUDE.md.

import fondiAperti from './data/fondi_aperti.json'
import covipRendimenti from './data/covip_rendimenti.json'
import covipIsc from './data/covip_isc.json'

export type PensionCategory = 'GAR' | 'OBB_PURO' | 'OBB_MISTO' | 'BIL' | 'AZN'
export type PensionForm = 'FPN' | 'FPA' | 'PIP'

export interface OpenFundLine {
  id: string
  fondo: string
  linea: string
  categoria: string
  categoria_label: string
  azioni_pct: number | null
  /** Rendimento netto medio annuo (%) sul periodo */
  rend: number
  /** Anni coperti dal rendimento medio: 3, 5 o 10 */
  periodo: number
  costo_gestione: number
  costo_apertura: number
  spese_annue: number
  fonte: string
}

export interface CovipReturn {
  forma: string
  forma_label: string
  comparto: string
  comparto_label: string
  r10: number | null
  r5: number | null
  r3: number | null
  r1: number | null
}

export interface CovipIsc {
  comparto: string
  comparto_label: string
  isc_fpn: number
  isc_fpa: number
  isc_pip: number
  isc_min: number
  isc_max: number
}

export const OPEN_FUND_LINES = fondiAperti as OpenFundLine[]
export const COVIP_RETURNS = covipRendimenti as CovipReturn[]
export const COVIP_ISC = covipIsc as CovipIsc[]

export const PENSION_CATEGORIES: { value: PensionCategory; label: string }[] = [
  { value: 'GAR', label: 'Garantito' },
  { value: 'OBB_PURO', label: 'Obbligazionario puro' },
  { value: 'OBB_MISTO', label: 'Obbligazionario misto' },
  { value: 'BIL', label: 'Bilanciato' },
  { value: 'AZN', label: 'Azionario' },
]

export const PENSION_FORMS: { value: PensionForm; label: string }[] = [
  { value: 'FPN', label: 'Fondo negoziale (di categoria)' },
  { value: 'FPA', label: 'Fondo aperto' },
  { value: 'PIP', label: 'PIP' },
]

/** Quota della retribuzione utile che matura come TFR (art. 2120 c.c.) */
export const TFR_RATE = 0.0691
/** Estremi della ricerca del rendimento di pareggio (% annuo) */
export const BREAKEVEN_MIN = -10
export const BREAKEVEN_MAX = 30
export const MAX_YEARS = 60

export interface PensionParams {
  fondo: string | null
  forma: PensionForm
  cat: PensionCategory
  r10: number | null
  r5: number | null
  isc: number | null
  montante: number | null
  ral: number | null
  pct_lav: number | null
  pct_dat: number | null
  pct_tfr: number | null
  anni: number | null
  /** id della linea di fondo aperto scelta per la simulazione; null = la migliore */
  alt: string | null
  /** Il contributo del datore segue anche nel fondo aperto */
  porta: boolean
  /** Tabella fondi aperti: tutte le categorie invece della sola scelta */
  tutte: boolean
}

export const DEFAULT_PENSION_PARAMS: PensionParams = {
  fondo: null, forma: 'FPN', cat: 'AZN', r10: null, r5: null, isc: null, montante: null,
  ral: null, pct_lav: null, pct_dat: null, pct_tfr: 100, anni: 20, alt: null, porta: true, tutte: false,
}

const CATEGORY_ORDER: string[] = PENSION_CATEGORIES.map(c => c.value)

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Converte un valore scritto a mano: accetta virgola o punto decimale,
 * separatore delle migliaia con punto, spazi, € e %.
 * Restituisce null per il campo vuoto e undefined per un testo non numerico.
 */
export function parseNumberInput(raw: string): number | null | undefined {
  const s = raw.trim()
  if (s === '') return null
  let t = s.replace(/\s|€|%/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const v = Number(t)
  return Number.isFinite(v) ? v : undefined
}

/** Unisce parametri salvati (anche parziali o di versioni precedenti) ai default */
export function normalizeParams(raw: unknown): PensionParams {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PENSION_PARAMS }
  const r = raw as Record<string, unknown>
  const num = (k: keyof PensionParams) => (isNum(r[k]) ? (r[k] as number) : r[k] === null ? null : DEFAULT_PENSION_PARAMS[k] as number | null)
  const cat = PENSION_CATEGORIES.some(c => c.value === r.cat) ? (r.cat as PensionCategory) : DEFAULT_PENSION_PARAMS.cat
  const forma = PENSION_FORMS.some(f => f.value === r.forma) ? (r.forma as PensionForm) : DEFAULT_PENSION_PARAMS.forma
  return {
    fondo: typeof r.fondo === 'string' && r.fondo.trim() ? r.fondo : null,
    forma,
    cat,
    r10: num('r10'), r5: num('r5'), isc: num('isc'), montante: num('montante'), ral: num('ral'),
    pct_lav: num('pct_lav'), pct_dat: num('pct_dat'), pct_tfr: num('pct_tfr'), anni: num('anni'),
    alt: typeof r.alt === 'string' && r.alt ? r.alt : null,
    porta: typeof r.porta === 'boolean' ? r.porta : DEFAULT_PENSION_PARAMS.porta,
    tutte: typeof r.tutte === 'boolean' ? r.tutte : DEFAULT_PENSION_PARAMS.tutte,
  }
}

/** Anni del rendimento usato: 10 se c'è il dato a 10 anni, altrimenti 5 */
export function comparisonPeriod(p: PensionParams): 10 | 5 {
  if (isNum(p.r10)) return 10
  if (isNum(p.r5)) return 5
  return 10
}

/** Rendimento medio annuo del comparto dell'utente (10 anni, altrimenti 5) */
export function userReturn(p: PensionParams): number | null {
  if (isNum(p.r10)) return p.r10
  if (isNum(p.r5)) return p.r5
  return null
}

/** I due comparti obbligazionari hanno un solo ISC medio COVIP */
export function iscCategory(cat: string): string {
  return cat === 'OBB_PURO' || cat === 'OBB_MISTO' ? 'OBB' : cat
}

/** Linee aperte della categoria, dalla più redditizia; period null = qualsiasi periodo */
export function linesFor(cat: string, period: number | null, lines = OPEN_FUND_LINES): OpenFundLine[] {
  return lines
    .filter(x => x.categoria === cat && (period == null || x.periodo === period))
    .sort((a, b) => b.rend - a.rend)
}

export function covipReturn(forma: string, comparto: string, rows = COVIP_RETURNS): CovipReturn | null {
  return rows.find(x => x.forma === forma && x.comparto === comparto) ?? null
}

/** Rendimento medio COVIP sul periodo indicato (r10 / r5) */
export function covipValue(row: CovipReturn | null, period: 10 | 5): number | null {
  if (!row) return null
  const v = period === 10 ? row.r10 : row.r5
  return isNum(v) ? v : null
}

export function covipIscFor(cat: string, rows = COVIP_ISC): CovipIsc | null {
  return rows.find(x => x.comparto === iscCategory(cat)) ?? null
}

/**
 * Linea aperta da simulare: quella scelta se appartiene alla categoria,
 * altrimenti la migliore con 10 anni di storia, altrimenti la migliore in assoluto.
 */
export function alternativeLine(p: PensionParams, lines = OPEN_FUND_LINES): OpenFundLine | null {
  const pick = p.alt ? lines.find(x => x.id === p.alt && x.categoria === p.cat) : undefined
  if (pick) return pick
  const l10 = linesFor(p.cat, 10, lines)
  if (l10.length) return l10[0]
  return linesFor(p.cat, null, lines)[0] ?? null
}

/** Capitale a fine di ogni anno: m(i) = m(i-1) × (1 + r) + C, versamento a fine anno */
export function project(start: number, yearlyContribution: number, ratePct: number, years: number): number[] {
  const out = [start]
  let m = start
  for (let i = 1; i <= years; i++) {
    m = m * (1 + ratePct / 100) + yearlyContribution
    out.push(m)
  }
  return out
}

export interface PensionSimulation {
  years: number
  start: number
  /** Contributo annuo restando nel fondo attuale */
  contributionStay: number
  /** Contributo annuo nel fondo aperto (senza datore se non segue) */
  contributionSwitch: number
  stay: number[]
  switched: number[]
  alt: OpenFundLine
  /** Rendimento annuo che serve al fondo aperto per eguagliare il capitale restando */
  breakeven: number
  /** false = neppure il 30% annuo basta a pareggiare */
  breakevenReached: boolean
}

export function simulate(p: PensionParams, lines = OPEN_FUND_LINES): PensionSimulation | null {
  const ral = p.ral
  const years = Math.round(p.anni ?? 0)
  const r = userReturn(p)
  const alt = alternativeLine(p, lines)
  if (!isNum(ral) || ral <= 0 || years < 1 || years > MAX_YEARS || r == null || !alt) return null

  const employee = ral * (p.pct_lav ?? 0) / 100
  const employer = ral * (p.pct_dat ?? 0) / 100
  const tfr = ral * TFR_RATE * (p.pct_tfr ?? 0) / 100
  const start = p.montante ?? 0

  const contributionStay = employee + employer + tfr
  const contributionSwitch = employee + tfr + (p.porta ? employer : 0)
  const stay = project(start, contributionStay, r, years)
  const switched = project(start, contributionSwitch, alt.rend, years)
  const target = stay[years]

  // Bisezione: il capitale finale cresce con il rendimento
  let lo = BREAKEVEN_MIN
  let hi = BREAKEVEN_MAX
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (project(start, contributionSwitch, mid, years)[years] < target) lo = mid
    else hi = mid
  }

  return {
    years, start, contributionStay, contributionSwitch, stay, switched, alt,
    breakeven: (lo + hi) / 2,
    breakevenReached: project(start, contributionSwitch, BREAKEVEN_MAX, years)[years] >= target,
  }
}

/** Righe della tabella fondi aperti: per categoria nell'ordine del menu, poi per rendimento */
export function openFundTableRows(p: PensionParams, lines = OPEN_FUND_LINES): OpenFundLine[] {
  return lines
    .filter(x => p.tutte || x.categoria === p.cat)
    .sort((a, b) => a.categoria === b.categoria
      ? b.rend - a.rend
      : CATEGORY_ORDER.indexOf(a.categoria) - CATEGORY_ORDER.indexOf(b.categoria))
}
