// Logica pura del "portamonete" del mese, ispirata al metodo Kakebo:
// a inizio mese entrate − uscite fisse = denaro a disposizione per le spese
// variabili, che si consuma settimana per settimana. Le spese variabili si
// leggono per grado di necessità (prima necessità, optional, cultura e tempo
// libero, extra e imprevisti). Nessuna dipendenza da React o Supabase: testata
// in tests/kakebo.

export type SpendingGroup = 'fixed' | 'essential' | 'optional' | 'leisure' | 'extra'

export const SPENDING_GROUPS: { key: SpendingGroup; label: string; description: string; color: string }[] = [
  { key: 'fixed', label: 'Uscite fisse', description: 'Affitto, mutuo, utenze, abbonamenti, rate', color: '#64748b' },
  { key: 'essential', label: 'Prima necessità', description: 'Spesa, farmacia, trasporti, figli, animali', color: '#10b981' },
  { key: 'optional', label: 'Optional', description: 'Shopping, cosmetica, regali', color: '#f59e0b' },
  { key: 'leisure', label: 'Cultura e tempo libero', description: 'Ristoranti, bar, libri, spettacoli', color: '#8b5cf6' },
  { key: 'extra', label: 'Extra e imprevisti', description: 'Riparazioni, spese mediche, arredamento, viaggi', color: '#ef4444' },
]

export const SPENDING_GROUP_KEYS = SPENDING_GROUPS.map((g) => g.key)

export function isSpendingGroup(value: unknown): value is SpendingGroup {
  return typeof value === 'string' && (SPENDING_GROUP_KEYS as string[]).includes(value)
}

// Il metodo separa contanti e carte: i metodi di pagamento sono testo libero
// (settings.payment_methods), quindi si riconoscono per nome.
export function isCashMethod(method?: string | null): boolean {
  return !!method && /contant|cash/i.test(method)
}

export interface PlanExpense {
  amount: number
  date: string // YYYY-MM-DD
  category_id: string | null
  payment_method: string | null
  is_exceptional: boolean
  is_recurring: boolean
  recurring_expense_id: string | null
  installment_plan_id: string | null
}

// Gruppo di una spesa. Ricorrenze e rate sono impegni presi in anticipo:
// contano come uscite fisse qualunque sia la categoria. Per il resto decide la
// categoria; una spesa eccezionale in una categoria senza gruppo finisce in
// "extra e imprevisti", come prevede il metodo. null = da classificare.
export function expenseGroup(
  t: Pick<PlanExpense, 'category_id' | 'is_exceptional' | 'is_recurring' | 'recurring_expense_id' | 'installment_plan_id'>,
  groupByCategory: Record<string, SpendingGroup | null | undefined>,
): SpendingGroup | null {
  if (t.recurring_expense_id || t.is_recurring || t.installment_plan_id) return 'fixed'
  const group = t.category_id ? groupByCategory[t.category_id] : null
  if (group) return group
  return t.is_exceptional ? 'extra' : null
}

export interface MonthWeek {
  index: number // 1-based
  startDay: number
  endDay: number
}

// Settimane del mese da lunedì a domenica, tagliate ai confini del mese: la
// prima e l'ultima possono essere più corte. Il libro assegna le settimane a
// cavallo per intero a un solo mese; qui no, per restare allineati
// all'estratto conto.
export function monthWeeks(month: number, year: number): MonthWeek[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const weeks: MonthWeek[] = []
  let start = 1
  for (let day = 1; day <= daysInMonth; day++) {
    const weekday = new Date(year, month - 1, day).getDay() // 0 = domenica
    if (weekday === 0 || day === daysInMonth) {
      weeks.push({ index: weeks.length + 1, startDay: start, endDay: day })
      start = day + 1
    }
  }
  return weeks
}

export interface PlannedFixed {
  amount: number
}

export interface SpendingPlanInput {
  month: number
  year: number
  /** Entrate del mese: registrate, oppure stimate se lo stipendio non è ancora arrivato */
  income: number
  savings: number
  debts: number
  expenses: PlanExpense[]
  groupByCategory: Record<string, SpendingGroup | null | undefined>
  /** Uscite fisse attese ma non ancora registrate (modelli ricorrenti senza occorrenza) */
  plannedFixed: PlannedFixed[]
  /** Oggi, YYYY-MM-DD */
  today: string
}

export type WeekStatus = 'past' | 'current' | 'future'

export interface SpendingPlanWeek extends MonthWeek {
  spent: number
  /** Quota del budget variabile proporzionale ai giorni della settimana */
  target: number
  status: WeekStatus
}

export interface SpendingPlan {
  byGroup: Record<SpendingGroup, number>
  unassigned: number
  fixedRegistered: number
  fixedPlanned: number
  fixedTotal: number
  /** Entrate − uscite fisse − risparmi − debiti */
  variableBudget: number
  variableSpent: number
  remaining: number
  /** Giorni rimasti nel mese, oggi incluso (0 per i mesi passati) */
  daysLeft: number
  /** Quanto si può spendere al giorno da qui a fine mese */
  perDayLeft: number
  weeks: SpendingPlanWeek[]
  cash: number
  nonCash: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function computeSpendingPlan(input: SpendingPlanInput): SpendingPlan {
  const { month, year, today } = input
  const daysInMonth = new Date(year, month, 0).getDate()
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const todayKey = today.slice(0, 7)
  const todayDay = Number(today.slice(8, 10))

  // Posizione del mese rispetto a oggi (confronto tra stringhe YYYY-MM)
  const relation = monthKey < todayKey ? 'past' : monthKey > todayKey ? 'future' : 'current'

  const byGroup: Record<SpendingGroup, number> = { fixed: 0, essential: 0, optional: 0, leisure: 0, extra: 0 }
  let unassigned = 0
  let cash = 0
  let nonCash = 0
  const weeks = monthWeeks(month, year)
  const weekSpent = new Array(weeks.length).fill(0)

  for (const t of input.expenses) {
    const amount = Number(t.amount)
    const group = expenseGroup(t, input.groupByCategory)
    if (group) byGroup[group] += amount
    else unassigned += amount

    if (isCashMethod(t.payment_method)) cash += amount
    else nonCash += amount

    if (group !== 'fixed') {
      const day = Number(t.date.slice(8, 10))
      const w = weeks.findIndex((wk) => day >= wk.startDay && day <= wk.endDay)
      if (w >= 0) weekSpent[w] += amount
    }
  }

  // Le uscite fisse attese contano solo per il mese in corso e quelli futuri:
  // in un mese passato un modello senza occorrenza è una spesa che non c'è stata.
  const fixedPlanned = relation === 'past' ? 0 : input.plannedFixed.reduce((s, p) => s + Number(p.amount), 0)
  const fixedRegistered = byGroup.fixed
  const fixedTotal = fixedRegistered + fixedPlanned

  const variableBudget = input.income - fixedTotal - input.savings - input.debts
  const variableSpent = Object.entries(byGroup).reduce((s, [k, v]) => (k === 'fixed' ? s : s + v), 0) + unassigned
  const remaining = variableBudget - variableSpent

  const daysLeft = relation === 'past' ? 0 : relation === 'future' ? daysInMonth : daysInMonth - todayDay + 1
  const perDayLeft = remaining > 0 && daysLeft > 0 ? remaining / daysLeft : 0

  return {
    byGroup: Object.fromEntries(Object.entries(byGroup).map(([k, v]) => [k, round2(v)])) as Record<SpendingGroup, number>,
    unassigned: round2(unassigned),
    fixedRegistered: round2(fixedRegistered),
    fixedPlanned: round2(fixedPlanned),
    fixedTotal: round2(fixedTotal),
    variableBudget: round2(variableBudget),
    variableSpent: round2(variableSpent),
    remaining: round2(remaining),
    daysLeft,
    perDayLeft: round2(perDayLeft),
    weeks: weeks.map((wk, i) => ({
      ...wk,
      spent: round2(weekSpent[i]),
      target: round2(Math.max(0, variableBudget) * (wk.endDay - wk.startDay + 1) / daysInMonth),
      status: relation === 'past' ? 'past'
        : relation === 'future' ? 'future'
        : todayDay > wk.endDay ? 'past' : todayDay >= wk.startDay ? 'current' : 'future',
    })),
    cash: round2(cash),
    nonCash: round2(nonCash),
  }
}
