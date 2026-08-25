import { describe, expect, it } from 'vitest'
import { groupRecurringCandidates, type RecurringCandidateInput } from '@/lib/recurring/detectCandidates'

// Costruisce una transazione con i default meno interessanti per il test, così
// ogni caso specifica solo i campi che gli interessano davvero.
function tx(overrides: Partial<RecurringCandidateInput> & { id: string }): RecurringCandidateInput {
  return {
    category_id: 'cat-1',
    amount: 20,
    date: '2026-01-01',
    description: null,
    payment_method: null,
    is_recurring: false,
    is_exceptional: false,
    installment_plan_id: null,
    ...overrides,
  }
}

describe('groupRecurringCandidates', () => {
  it('nessuna transazione → nessun candidato', () => {
    expect(groupRecurringCandidates([])).toEqual([])
  })

  it('una singola transazione segnata is_recurring=true viene individuata da sola', () => {
    const groups = groupRecurringCandidates([
      tx({ id: 't1', is_recurring: true, amount: 50, date: '2026-08-15', category_id: 'netflix-cat' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].transactionIds).toEqual(['t1'])
    expect(groups[0].amount).toBe(50)
  })

  it('una singola transazione NON flaggata comparsa in un solo mese non è un candidato', () => {
    const groups = groupRecurringCandidates([tx({ id: 't1', amount: 50 })])
    expect(groups).toEqual([])
  })

  it('stesso importo/categoria ripetuto in 2 mesi diversi viene individuato anche senza flag', () => {
    const groups = groupRecurringCandidates([
      tx({ id: 't1', amount: 30, date: '2026-06-10' }),
      tx({ id: 't2', amount: 30, date: '2026-07-10' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].transactionIds.sort()).toEqual(['t1', 't2'])
    expect(groups[0].monthsCount).toBe(2)
  })

  it('esclude le transazioni senza categoria anche se flaggate is_recurring', () => {
    const groups = groupRecurringCandidates([
      tx({ id: 't1', is_recurring: true, category_id: null }),
    ])
    expect(groups).toEqual([])
  })

  it('esclude le rate di un piano PayPal anche se flaggate is_recurring', () => {
    const groups = groupRecurringCandidates([
      tx({ id: 't1', is_recurring: true, installment_plan_id: 'plan-1' }),
    ])
    expect(groups).toEqual([])
  })

  it('esclude i movimenti eccezionali anche se flaggati is_recurring', () => {
    const groups = groupRecurringCandidates([
      tx({ id: 't1', is_recurring: true, is_exceptional: true }),
    ])
    expect(groups).toEqual([])
  })

  it('non mescola mai categorie diverse anche con lo stesso importo', () => {
    const groups = groupRecurringCandidates([
      tx({ id: 't1', category_id: 'cat-a', amount: 30, date: '2026-01-01', is_recurring: true }),
      tx({ id: 't2', category_id: 'cat-b', amount: 30, date: '2026-01-01', is_recurring: true }),
    ])
    expect(groups).toHaveLength(2)
  })

  // Regressione: prima del fix, il confronto usava la media mobile del
  // cluster invece di un'ancora fissa. In una categoria con più spese non
  // correlate ma di importo vicino (qui: spese quotidiane fra 40€ e 48€), la
  // media si spostava progressivamente e poteva inglobare la transazione
  // flaggata is_recurring=true in un cluster dominato da spese estranee — il
  // gruppo risultante aveva nome/importo suggeriti sbagliati, quindi la spesa
  // segnata come ricorrente sembrava "non individuata" all'utente.
  it('non diluisce una transazione flaggata in una catena di spese non correlate della stessa categoria', () => {
    const groups = groupRecurringCandidates([
      tx({ id: 'a', amount: 40, date: '2026-01-05', description: 'Spesa 1' }),
      tx({ id: 'b', amount: 42, date: '2026-02-05', description: 'Spesa 2' }),
      tx({ id: 'c', amount: 44, date: '2026-03-05', description: 'Netflix', is_recurring: true }),
      tx({ id: 'd', amount: 46, date: '2026-04-05', description: 'Spesa 3' }),
      tx({ id: 'e', amount: 48, date: '2026-05-05', description: 'Spesa 4' }),
    ])

    const netflixGroup = groups.find((g) => g.transactionIds.includes('c'))
    expect(netflixGroup).toBeDefined()
    // L'importo suggerito deve restare vicino ai 44€ della transazione
    // flaggata, non trascinato verso il basso da spese da 40€/42€ estranee.
    expect(netflixGroup!.amount).toBeGreaterThanOrEqual(43)
    expect(netflixGroup!.amount).toBeLessThanOrEqual(45)
  })

  it('tollera lievi variazioni di importo (es. bollette a consumo) mantenendo un unico cluster', () => {
    const groups = groupRecurringCandidates([
      tx({ id: 'w1', amount: 60, date: '2026-01-10' }),
      tx({ id: 'w2', amount: 62, date: '2026-02-10' }),
      tx({ id: 'w3', amount: 58, date: '2026-03-10' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].transactionIds).toHaveLength(3)
    expect(groups[0].monthsCount).toBe(3)
  })

  it('funziona anche quando amount arriva come stringa (colonna numeric di Supabase)', () => {
    const groups = groupRecurringCandidates([
      tx({ id: 't1', amount: '19.99' as unknown as number, is_recurring: true }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].amount).toBe(19.99)
  })

  it('sceglie come nome suggerito la descrizione più frequente nel cluster', () => {
    const groups = groupRecurringCandidates([
      tx({ id: 't1', amount: 15, date: '2026-01-01', description: 'Spotify' }),
      tx({ id: 't2', amount: 15, date: '2026-02-01', description: 'Spotify' }),
      tx({ id: 't3', amount: 15, date: '2026-03-01', description: 'Spotify Premium' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].suggestedName).toBe('Spotify')
  })
})
