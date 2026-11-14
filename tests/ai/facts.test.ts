import { describe, expect, it } from 'vitest'
import { buildFacts, makeFormatter, normalizeDescription, type AiTx, type FactsInput } from '@/lib/ai/facts'

const fmt = makeFormatter('EUR')

function tx(date: string, amount: number, over: Partial<AiTx> = {}): AiTx {
  return {
    type: 'expense',
    amount,
    date,
    category_id: 'cat-food',
    description: null,
    payment_method: null,
    is_exceptional: false,
    is_recurring: false,
    recurring_expense_id: null,
    installment_plan_id: null,
    ...over,
  }
}

const categories = [
  { id: 'cat-food', name: 'Ristoranti', spending_group: 'leisure' as const },
  { id: 'cat-home', name: 'Casa', spending_group: 'fixed' as const },
]

function input(txs: AiTx[], over: Partial<FactsInput> = {}): FactsInput {
  return { month: 11, year: 2026, today: '2026-11-15', currency: 'EUR', txs, categories, recurring: [], ...over }
}

// Ago-ott: 100 € di ristoranti entro il giorno 15 di ogni mese
const baseline = ['2026-08', '2026-09', '2026-10'].map((m) => tx(`${m}-10`, 100))

describe('buildFacts', () => {
  it('segnala una categoria sopra la propria media allo stesso giorno', () => {
    const { facts } = buildFacts(input([...baseline, tx('2026-11-08', 300, { description: 'Cena sushi' })]))
    const up = facts.find((f) => f.kind === 'category_up')
    expect(up).toBeDefined()
    expect(up!.text).toContain('Ristoranti')
    expect(up!.text).toContain(fmt(200)) // 300 − 100 in più
    expect(up!.text).toContain('Cena sushi')
    expect(up!.positive).toBe(false)
  })

  it('non segnala una categoria in linea con la media', () => {
    const { facts } = buildFacts(input([...baseline, tx('2026-11-08', 110)]))
    expect(facts.find((f) => f.kind === 'category_up')).toBeUndefined()
  })

  it('ignora i movimenti eccezionali nel confronto', () => {
    const { facts } = buildFacts(input([...baseline, tx('2026-11-08', 500, { is_exceptional: true })]))
    expect(facts.find((f) => f.kind === 'category_up')).toBeUndefined()
  })

  it('proietta solo la parte variabile: l\'affitto del giorno 1 non gonfia il mese', () => {
    const rent = (m: string) => tx(`${m}-01`, 800, { category_id: 'cat-home', is_recurring: true })
    const hist = ['2026-08', '2026-09', '2026-10'].flatMap((m) => [rent(m), tx(`${m}-20`, 300)])
    const { facts } = buildFacts(input([...hist, rent('2026-11'), tx('2026-11-10', 150)]))
    const pace = facts.find((f) => f.kind === 'pace')!
    // 950 speso + 150 variabili nei 15 giorni restanti = 1.100, uguale alla media
    expect(pace.text).toContain(fmt(1100))
    expect(pace.positive).toBe(true)
  })

  it('non fa proiezioni nei primi giorni del mese', () => {
    const { facts } = buildFacts(input([...baseline, tx('2026-11-02', 40)], { today: '2026-11-03' }))
    expect(facts.find((f) => f.kind === 'pace')).toBeUndefined()
  })

  it('riconosce una spesa mensile non presente tra le ricorrenti', () => {
    const netflix = ['2026-08', '2026-09', '2026-10', '2026-11'].map((m) =>
      tx(`${m}-05`, 12.99, { category_id: null, description: 'NETFLIX.COM 4412' }),
    )
    const found = buildFacts(input(netflix)).facts.find((f) => f.kind === 'unmodeled_recurring')
    expect(found).toBeDefined()
    expect(found!.text).toContain('NETFLIX.COM 4412')

    const modeled = buildFacts(
      input(netflix, { recurring: [{ id: 'r1', name: 'Netflix', amount: 12.99, start_date: '2026-01-01', is_active: true }] }),
    )
    expect(modeled.facts.find((f) => f.kind === 'unmodeled_recurring')).toBeUndefined()
  })

  it('segnala il budget variabile sforato', () => {
    const txs = [
      ...baseline,
      { ...tx('2026-11-01', 2000), type: 'income' as const, category_id: null },
      tx('2026-11-05', 900, { category_id: 'cat-home', is_recurring: true }),
      tx('2026-11-09', 1300),
    ]
    const budget = buildFacts(input(txs)).facts.find((f) => f.kind === 'budget')!
    expect(budget.positive).toBe(false)
    expect(budget.text).toContain('sforato')
  })

  it('senza storico non confronta nulla', () => {
    const { facts, context } = buildFacts(input([tx('2026-11-08', 300)]))
    expect(context.baselineMonths).toBe(0)
    expect(facts.find((f) => f.kind === 'category_up')).toBeUndefined()
    expect(facts.find((f) => f.kind === 'pace')).toBeUndefined()
  })

  it('un mese futuro non produce fatti', () => {
    const { facts } = buildFacts(input([tx('2026-12-05', 50)], { month: 12 }))
    expect(facts).toEqual([])
  })

  it('assegna ID progressivi ordinati per importanza', () => {
    const { facts } = buildFacts(input([...baseline, tx('2026-11-08', 400)]))
    expect(facts.map((f) => f.id)).toEqual(facts.map((_, i) => `F${i + 1}`))
    for (let i = 1; i < facts.length; i++) expect(facts[i - 1].score).toBeGreaterThanOrEqual(facts[i].score)
  })
})

describe('normalizeDescription', () => {
  it('toglie cifre e punteggiatura', () => {
    expect(normalizeDescription('NETFLIX.COM 4412 / 05-11')).toBe('netflix com')
    expect(normalizeDescription(null)).toBe('')
  })
})
