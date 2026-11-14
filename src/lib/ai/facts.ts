// Fatti finanziari calcolati in modo deterministico per l'analisi AI.
// Logica pura (testata in tests/ai/): il codice trova cosa è rilevante e
// formula ogni fatto con i numeri già calcolati; il modello li ordina, li
// spiega e propone un'azione, senza dover "scoprire" nulla da solo.

import { computeSpendingPlan, type PlanExpense, type SpendingGroup } from '@/lib/kakebo'

export interface AiTx extends PlanExpense {
  type: 'income' | 'expense' | 'saving' | 'debt'
  description: string | null
}

export interface AiCategory {
  id: string
  name: string
  spending_group: SpendingGroup | null
}

export interface AiRecurringModel {
  id: string
  name: string
  amount: number
  start_date: string
  is_active: boolean
}

export interface FactsInput {
  month: number
  year: number
  /** Oggi, YYYY-MM-DD */
  today: string
  currency: string
  /** Movimenti del mese e dei mesi precedenti (servono ~3 mesi di storico) */
  txs: AiTx[]
  categories: AiCategory[]
  recurring: AiRecurringModel[]
}

export type FactKind =
  | 'pace'
  | 'category_up'
  | 'category_down'
  | 'unmodeled_recurring'
  | 'big_expense'
  | 'budget'
  | 'savings'
  | 'installments'

export interface Fact {
  id: string
  kind: FactKind
  /** Peso per l'ordinamento, in euro di impatto approssimato */
  score: number
  /** true = notizia buona (spesa sotto media, budget rispettato) */
  positive: boolean
  /** Frase italiana con i numeri già calcolati */
  text: string
}

export interface FactsContext {
  elapsedDays: number
  daysInMonth: number
  isCurrentMonth: boolean
  /** Mesi precedenti con dati usati come termine di confronto */
  baselineMonths: number
  incomeEstimated: boolean
}

export interface FactsResult {
  facts: Fact[]
  context: FactsContext
}

const BASELINE_MONTHS = 3
const MAX_FACTS = 8

const pad = (n: number) => String(n).padStart(2, '0')
const monthKey = (y: number, m: number) => `${y}-${pad(m)}`
const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate()
const dayOf = (date: string) => Number(date.slice(8, 10))
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

const isFixed = (t: AiTx) => !!(t.recurring_expense_id || t.is_recurring || t.installment_plan_id)
const isOrdinaryExpense = (t: AiTx) => t.type === 'expense' && !t.is_exceptional

// Chiave di confronto tra descrizioni: minuscole, senza cifre né punteggiatura
export function normalizeDescription(desc: string | null | undefined): string {
  return (desc ?? '')
    .toLowerCase()
    .replace(/[0-9]+/g, ' ')
    .replace(/[^a-zà-ú\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function makeFormatter(currency: string) {
  const f0 = new Intl.NumberFormat('it-IT', { style: 'currency', currency, maximumFractionDigits: 0 })
  const f2 = new Intl.NumberFormat('it-IT', { style: 'currency', currency })
  return (n: number) => (Math.abs(n) >= 100 ? f0.format(n) : f2.format(n))
}

const pctText = (p: number) => `${p > 0 ? '+' : ''}${Math.round(p * 100)}%`

export function buildFacts(input: FactsInput): FactsResult {
  const { month, year, today, categories, recurring } = input
  const fmt = makeFormatter(input.currency)
  const dim = daysIn(year, month)
  const curKey = monthKey(year, month)
  const todayKey = today.slice(0, 7)
  const relation = curKey < todayKey ? 'past' : curKey > todayKey ? 'future' : 'current'
  const elapsed = relation === 'past' ? dim : relation === 'current' ? dayOf(today) : 0
  const daysLeft = dim - elapsed

  const byMonth: Record<string, AiTx[]> = {}
  for (const t of input.txs) (byMonth[t.date.slice(0, 7)] ??= []).push(t)

  const cur = byMonth[curKey] ?? []
  const baselineKeys: string[] = []
  for (let i = 1; i <= BASELINE_MONTHS; i++) {
    const s = shiftMonth(year, month, -i)
    const key = monthKey(s.year, s.month)
    if ((byMonth[key] ?? []).length > 0) baselineKeys.push(key)
  }

  const context: FactsContext = {
    elapsedDays: elapsed,
    daysInMonth: dim,
    isCurrentMonth: relation === 'current',
    baselineMonths: baselineKeys.length,
    incomeEstimated: false,
  }
  if (relation === 'future' || cur.length === 0) return { facts: [], context }

  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const facts: Omit<Fact, 'id'>[] = []

  // Spese ordinarie del mese fino a oggi
  const curToDate = cur.filter((t) => isOrdinaryExpense(t) && dayOf(t.date) <= elapsed)
  const curSpent = sum(curToDate.map((t) => Number(t.amount)))

  // Uscite fisse attese ma non ancora registrate nel mese
  const monthEnd = `${curKey}-${pad(dim)}`
  const modelsWithOccurrence = new Set(cur.map((t) => t.recurring_expense_id).filter(Boolean))
  const pendingModels = recurring.filter(
    (m) => m.is_active && m.start_date <= monthEnd && !modelsWithOccurrence.has(m.id),
  )
  const pendingFixed = relation === 'past' ? 0 : sum(pendingModels.map((m) => Number(m.amount)))

  // --- Ritmo di spesa e proiezione a fine mese -----------------------------
  const baseFull = mean(
    baselineKeys.map((k) => sum((byMonth[k] ?? []).filter(isOrdinaryExpense).map((t) => Number(t.amount)))),
  )
  if (baseFull > 0 && (relation === 'past' || elapsed >= 5)) {
    // Le uscite fisse arrivano a scatti (affitto il 1°): si proietta solo la parte variabile
    const variableSoFar = sum(curToDate.filter((t) => !isFixed(t)).map((t) => Number(t.amount)))
    const projected = relation === 'past'
      ? curSpent
      : curSpent + pendingFixed + variableSoFar * (daysLeft / elapsed)
    const delta = projected - baseFull
    const pct = delta / baseFull
    facts.push({
      kind: 'pace',
      score: Math.max(1, Math.abs(delta)),
      positive: delta <= 0,
      text: relation === 'past'
        ? `Il mese si è chiuso con ${fmt(curSpent)} di spese ordinarie, contro una media di ${fmt(baseFull)} nei ${baselineKeys.length} mesi precedenti (${pctText(pct)}).`
        : `Al giorno ${elapsed} di ${dim} hai speso ${fmt(curSpent)} di spese ordinarie. Con questo ritmo il mese chiuderebbe a circa ${fmt(projected)}, contro una media di ${fmt(baseFull)} nei ${baselineKeys.length} mesi precedenti (${pctText(pct)}).`,
    })
  }

  // --- Categorie sopra/sotto la propria media allo stesso giorno del mese ---
  if (baselineKeys.length > 0) {
    const toDateByCat = (txs: AiTx[], upto: number) => {
      const out: Record<string, number> = {}
      for (const t of txs) {
        if (!isOrdinaryExpense(t) || !t.category_id || dayOf(t.date) > upto) continue
        out[t.category_id] = (out[t.category_id] ?? 0) + Number(t.amount)
      }
      return out
    }
    const curByCat = toDateByCat(cur, elapsed)
    const baseByCat = baselineKeys.map((k) => toDateByCat(byMonth[k] ?? [], elapsed))
    const catIds = new Set([...Object.keys(curByCat), ...baseByCat.flatMap((b) => Object.keys(b))])

    for (const id of catIds) {
      const name = catName.get(id)
      if (!name) continue
      const s = curByCat[id] ?? 0
      const b = mean(baseByCat.map((m) => m[id] ?? 0))
      const diff = s - b

      if (diff >= 30 && (b === 0 ? s >= 50 : s >= b * 1.3)) {
        const top = curToDate
          .filter((t) => t.category_id === id)
          .sort((a, c) => Number(c.amount) - Number(a.amount))[0]
        const driver = top?.description ? ` La voce più alta: "${top.description}" (${fmt(Number(top.amount))}).` : ''
        facts.push({
          kind: 'category_up',
          score: diff,
          positive: false,
          text: b === 0
            ? `"${name}": ${fmt(s)} nel mese, categoria senza spese allo stesso giorno nei mesi precedenti.${driver}`
            : `"${name}": ${fmt(s)} finora contro una media di ${fmt(b)} allo stesso giorno (${pctText(diff / b)}, ${fmt(diff)} in più).${driver}`,
        })
      } else if ((relation === 'past' || elapsed >= 15) && b - s >= 50 && s <= b * 0.6) {
        facts.push({
          kind: 'category_down',
          score: (b - s) * 0.7,
          positive: true,
          text: `"${name}": solo ${fmt(s)} finora contro una media di ${fmt(b)} allo stesso giorno (${fmt(b - s)} in meno).`,
        })
      }
    }
  }

  // --- Spese che si ripetono ogni mese ma non sono nel pannello ricorrenti --
  {
    const modelKeys = recurring.map((m) => normalizeDescription(m.name)).filter((k) => k.length >= 3)
    const perKey: Record<string, { label: string; months: Record<string, number> }> = {}
    for (const key of [curKey, ...baselineKeys]) {
      for (const t of byMonth[key] ?? []) {
        if (t.type !== 'expense' || isFixed(t) || t.is_exceptional) continue
        const k = normalizeDescription(t.description)
        if (k.length < 3) continue
        const entry = (perKey[k] ??= { label: t.description!.trim(), months: {} })
        entry.months[key] = (entry.months[key] ?? 0) + Number(t.amount)
      }
    }
    const found: Omit<Fact, 'id'>[] = []
    for (const [k, e] of Object.entries(perKey)) {
      const amounts = Object.values(e.months)
      if (amounts.length < 3) continue
      const avg = mean(amounts)
      const spread = (Math.max(...amounts) - Math.min(...amounts)) / avg
      if (avg < 3 || spread > 0.1) continue
      if (modelKeys.some((mk) => k.includes(mk) || mk.includes(k))) continue
      found.push({
        kind: 'unmodeled_recurring',
        score: avg * 3,
        positive: false,
        text: `"${e.label}" compare ogni mese (${amounts.length} degli ultimi ${baselineKeys.length + 1}) per circa ${fmt(avg)}, ${fmt(avg * 12)} l'anno, ma non è tra le spese ricorrenti.`,
      })
    }
    facts.push(...found.sort((a, b) => b.score - a.score).slice(0, 2))
  }

  // --- Spesa singola molto pesante ------------------------------------------
  {
    const top = curToDate
      .filter((t) => !isFixed(t))
      .sort((a, b) => Number(b.amount) - Number(a.amount))[0]
    if (top && Number(top.amount) >= 100 && Number(top.amount) >= curSpent * 0.2) {
      const label = top.description || (top.category_id ? catName.get(top.category_id) : null) || 'senza descrizione'
      facts.push({
        kind: 'big_expense',
        score: Number(top.amount) * 0.5,
        positive: false,
        text: `La spesa singola più alta del mese è "${label}": ${fmt(Number(top.amount))}, il ${dayOf(top.date)}, pari al ${Math.round((Number(top.amount) / curSpent) * 100)}% delle spese ordinarie.`,
      })
    }
  }

  // --- Budget variabile (portamonete Kakebo) --------------------------------
  {
    const curIncome = sum(cur.filter((t) => t.type === 'income' && !t.is_exceptional).map((t) => Number(t.amount)))
    const baseIncome = mean(
      baselineKeys.map((k) => sum((byMonth[k] ?? []).filter((t) => t.type === 'income' && !t.is_exceptional).map((t) => Number(t.amount)))),
    )
    const income = curIncome > 0 ? curIncome : baseIncome
    context.incomeEstimated = curIncome === 0 && baseIncome > 0
    if (income > 0 && relation === 'current') {
      const groupByCategory: Record<string, SpendingGroup | null> = {}
      for (const c of categories) groupByCategory[c.id] = c.spending_group
      const plan = computeSpendingPlan({
        month,
        year,
        income,
        savings: sum(cur.filter((t) => t.type === 'saving').map((t) => Number(t.amount))),
        debts: sum(cur.filter((t) => t.type === 'debt').map((t) => Number(t.amount))),
        expenses: cur.filter((t) => t.type === 'expense'),
        groupByCategory,
        plannedFixed: pendingModels.map((m) => ({ amount: Number(m.amount) })),
        today,
      })
      const negative = plan.remaining < 0
      facts.push({
        kind: 'budget',
        score: negative ? 300 + Math.abs(plan.remaining) : 40,
        positive: !negative,
        text:
          `Budget per le spese variabili del mese (entrate${context.incomeEstimated ? ' stimate sulla media' : ''} − uscite fisse − risparmi): ${fmt(plan.variableBudget)}. ` +
          `Speso finora ${fmt(plan.variableSpent)}, ${negative ? `sforato di ${fmt(-plan.remaining)}` : `residuo ${fmt(plan.remaining)}`}` +
          (plan.daysLeft > 0 && !negative ? `, cioè ${fmt(plan.perDayLeft)} al giorno per i ${plan.daysLeft} giorni rimasti.` : '.'),
      })
    }
  }

  // --- Risparmio rispetto al solito -----------------------------------------
  {
    const savedIn = (txs: AiTx[]) => sum(txs.filter((t) => t.type === 'saving').map((t) => Number(t.amount)))
    const base = mean(baselineKeys.map((k) => savedIn(byMonth[k] ?? [])))
    const now = savedIn(cur)
    if (base > 0 && (relation === 'past' || elapsed >= 20)) {
      if (now < base * 0.5) {
        facts.push({
          kind: 'savings',
          score: (base - now) * 0.6,
          positive: false,
          text: `Finora hai messo da parte ${fmt(now)}, contro una media di ${fmt(base)} al mese nei mesi precedenti.`,
        })
      } else if (now >= base * 1.3) {
        facts.push({
          kind: 'savings',
          score: (now - base) * 0.4,
          positive: true,
          text: `Hai messo da parte ${fmt(now)}, sopra la tua media di ${fmt(base)} al mese.`,
        })
      }
    }
  }

  // --- Rate già programmate nei prossimi 60 giorni --------------------------
  {
    const limit = new Date(`${today}T00:00:00Z`)
    limit.setUTCDate(limit.getUTCDate() + 60)
    const limitKey = limit.toISOString().slice(0, 10)
    const upcoming = input.txs
      .filter((t) => t.type === 'expense' && t.installment_plan_id && t.date > today && t.date <= limitKey)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (upcoming.length > 0) {
      const total = sum(upcoming.map((t) => Number(t.amount)))
      const next = upcoming[0].date
      facts.push({
        kind: 'installments',
        score: total * 0.3,
        positive: false,
        text: `Hai ${upcoming.length} rate già programmate nei prossimi 60 giorni per ${fmt(total)} (la prossima il ${next.slice(8, 10)}/${next.slice(5, 7)}).`,
      })
    }
  }

  const ranked = facts
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_FACTS)
    .map((f, i) => ({ ...f, id: `F${i + 1}` }))
  return { facts: ranked, context }
}
