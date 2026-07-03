'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useDebtItems, useCreateDebtItem, useUpdateDebtItem, useDeleteDebtItem, monthsToPayoff, totalInterest, type DebtItemFormData } from '@/hooks/useDebtItems'
import { useSettings } from '@/hooks/useSettings'
import { useToast } from '@/components/Toast'
import { useModalA11y } from '@/hooks/useModalA11y'
import { formatCurrency } from '@/lib/utils'
import type { DebtItem } from '@/types'

type Strategy = 'none' | 'snowball' | 'avalanche'

const emptyForm: DebtItemFormData = {
  name: '',
  description: null,
  total_amount: 0,
  remaining_amount: 0,
  interest_rate: null,
  monthly_payment: null,
  start_date: null,
  due_date: null,
}

export default function DebitiPage() {
  const { data: debts, isLoading } = useDebtItems()
  const { data: settings } = useSettings()
  const createDebt = useCreateDebtItem()
  const updateDebt = useUpdateDebtItem()
  const deleteDebt = useDeleteDebtItem()
  const { showToast } = useToast()

  const [strategy, setStrategy] = useState<Strategy>('none')
  const [showForm, setShowForm] = useState(false)
  const [editingDebt, setEditingDebt] = useState<DebtItem | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<DebtItemFormData>(emptyForm)

  const currency = settings?.currency || 'EUR'
  const fmt = (n: number) => formatCurrency(n, currency)

  // Ordine strategia
  const sortedDebts = (() => {
    if (!debts?.length) return debts ?? []
    const copy = [...debts]
    if (strategy === 'snowball') return copy.sort((a, b) => a.remaining_amount - b.remaining_amount)
    if (strategy === 'avalanche') return copy.sort((a, b) => (b.interest_rate ?? 0) - (a.interest_rate ?? 0))
    return copy
  })()

  const totalRemaining = debts?.reduce((s, d) => s + d.remaining_amount, 0) ?? 0
  const totalOriginal = debts?.reduce((s, d) => s + d.total_amount, 0) ?? 0
  const totalMonthly = debts?.reduce((s, d) => s + (d.monthly_payment ?? 0), 0) ?? 0
  const paidPct = totalOriginal > 0 ? Math.round(((totalOriginal - totalRemaining) / totalOriginal) * 100) : 0

  function openCreate() {
    setEditingDebt(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(debt: DebtItem) {
    setEditingDebt(debt)
    setForm({
      name: debt.name,
      description: debt.description,
      total_amount: debt.total_amount,
      remaining_amount: debt.remaining_amount,
      interest_rate: debt.interest_rate,
      monthly_payment: debt.monthly_payment,
      start_date: debt.start_date,
      due_date: debt.due_date,
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingDebt(null)
    setForm(emptyForm)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingDebt) {
        await updateDebt.mutateAsync({ id: editingDebt.id, data: form })
        showToast('Debito aggiornato', 'success')
      } else {
        await createDebt.mutateAsync(form)
        showToast('Debito aggiunto', 'success')
      }
      closeForm()
    } catch {
      showToast('Errore durante il salvataggio', 'error')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDebt.mutateAsync(id)
      showToast('Debito rimosso', 'info')
    } catch {
      showToast('Errore durante la rimozione', 'error')
    } finally {
      setConfirmDeleteId(null)
    }
  }

  const payoffDate = (debt: DebtItem) => {
    const m = monthsToPayoff(debt.remaining_amount, debt.monthly_payment ?? 0, debt.interest_rate ?? 0)
    if (!isFinite(m)) return 'N/D'
    const d = new Date()
    d.setMonth(d.getMonth() + m)
    return d.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })
  }

  const interestLabel = (debt: DebtItem) => {
    const i = totalInterest(debt.remaining_amount, debt.monthly_payment ?? 0, debt.interest_rate ?? 0)
    return isFinite(i) ? fmt(i) : 'N/D'
  }

  const formModalRef = useModalA11y<HTMLDivElement>(showForm, closeForm)
  const deleteModalRef = useModalA11y<HTMLDivElement>(!!confirmDeleteId, () => setConfirmDeleteId(null))

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Debiti</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Gestisci e pianifica l&apos;estinzione dei tuoi debiti</p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            <span>+</span> Aggiungi debito
          </button>
        </div>

        {/* Summary cards */}
        {!isLoading && (debts?.length ?? 0) > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Debito residuo</p>
              <p className="text-2xl font-bold text-red-600">{fmt(totalRemaining)}</p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Debito originale</p>
              <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">{fmt(totalOriginal)}</p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Rate mensili tot.</p>
              <p className="text-2xl font-bold text-orange-600">{fmt(totalMonthly)}</p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Già rimborsato</p>
              <p className="text-2xl font-bold text-emerald-600">{paidPct}%</p>
              <div className="mt-2 h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${paidPct}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Strategy selector */}
        {!isLoading && (debts?.length ?? 0) > 1 && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Strategia di estinzione</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {([
                { key: 'none', label: 'Nessuna', desc: 'Ordine inserimento' },
                { key: 'snowball', label: '❄️ Snowball', desc: 'Prima il debito più piccolo — motivazione immediata' },
                { key: 'avalanche', label: '🏔️ Avalanche', desc: 'Prima il tasso più alto — risparmio massimo sugli interessi' },
              ] as const).map(s => (
                <button
                  key={s.key}
                  onClick={() => setStrategy(s.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    strategy === s.key
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-emerald-400'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {strategy !== 'none' && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {strategy === 'snowball'
                  ? '❄️ Snowball: paga il minimo su tutti i debiti tranne quello con il saldo residuo più basso — concentra ogni euro extra lì fino all\'estinzione.'
                  : '🏔️ Avalanche: paga il minimo su tutti i debiti tranne quello con il tasso di interesse più alto — minimizza gli interessi totali pagati.'}
              </p>
            )}
          </div>
        )}

        {/* Debt list */}
        {isLoading ? (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-12 shadow-sm border border-zinc-100 dark:border-zinc-700 text-center text-zinc-500 dark:text-zinc-400">
            Caricamento...
          </div>
        ) : sortedDebts.length === 0 ? (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-12 shadow-sm border border-zinc-100 dark:border-zinc-700 text-center">
            <div className="text-4xl mb-4">📉</div>
            <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Nessun debito registrato</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
              Aggiungi mutuo, prestito, carta o qualsiasi debito da monitorare
            </p>
            <button
              onClick={openCreate}
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-5 rounded-lg text-sm transition-colors"
            >
              Aggiungi debito
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDebts.map((debt, idx) => {
              const pct = debt.total_amount > 0
                ? Math.round(((debt.total_amount - debt.remaining_amount) / debt.total_amount) * 100)
                : 0
              const isPriority = strategy !== 'none' && idx === 0

              return (
                <div
                  key={debt.id}
                  className={`bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border ${
                    isPriority ? 'border-emerald-400 dark:border-emerald-600' : 'border-zinc-100 dark:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{debt.name}</h3>
                        {isPriority && (
                          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium">
                            Priorità
                          </span>
                        )}
                      </div>
                      {debt.description && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">{debt.description}</p>
                      )}

                      {/* Progress bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                          <span>Rimborsato {pct}%</span>
                          <span>{fmt(debt.remaining_amount)} residui</span>
                        </div>
                        <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                        {debt.monthly_payment && (
                          <span className="text-zinc-600 dark:text-zinc-400">
                            Rata: <strong>{fmt(debt.monthly_payment)}/mese</strong>
                          </span>
                        )}
                        {debt.interest_rate !== null && debt.interest_rate !== undefined && (
                          <span className="text-zinc-600 dark:text-zinc-400">
                            Tasso: <strong>{debt.interest_rate}%</strong>
                          </span>
                        )}
                        {debt.monthly_payment && (
                          <span className="text-zinc-600 dark:text-zinc-400">
                            Estinzione stimata: <strong>{payoffDate(debt)}</strong>
                          </span>
                        )}
                        {debt.monthly_payment && debt.interest_rate && (
                          <span className="text-zinc-600 dark:text-zinc-400">
                            Interessi tot.: <strong>{interestLabel(debt)}</strong>
                          </span>
                        )}
                        {debt.due_date && (
                          <span className="text-zinc-600 dark:text-zinc-400">
                            Scadenza: <strong>{debt.due_date.split('-').reverse().join('/')}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(debt)}
                        className="text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 transition-colors text-sm"
                        aria-label="Modifica"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(debt.id)}
                        className="text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors text-sm"
                        aria-label="Elimina"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="debt-modal-title">
          <div ref={formModalRef} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-700">
              <h2 id="debt-modal-title" className="text-lg font-bold text-zinc-900 dark:text-white">
                {editingDebt ? 'Modifica debito' : 'Aggiungi debito'}
              </h2>
              <button onClick={closeForm} aria-label="Chiudi" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="es. Mutuo casa, Prestito auto..."
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Descrizione</label>
                <input
                  type="text"
                  value={form.description ?? ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))}
                  placeholder="Opzionale"
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Importo originale *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.total_amount || ''}
                    onChange={e => setForm(f => ({ ...f, total_amount: parseFloat(e.target.value) || 0 }))}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Residuo attuale *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.remaining_amount || ''}
                    onChange={e => setForm(f => ({ ...f, remaining_amount: parseFloat(e.target.value) || 0 }))}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Tasso interesse (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.interest_rate ?? ''}
                    onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="es. 3.5"
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Rata mensile</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.monthly_payment ?? ''}
                    onChange={e => setForm(f => ({ ...f, monthly_payment: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="es. 500"
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Data inizio</label>
                  <input
                    type="date"
                    value={form.start_date ?? ''}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value || null }))}
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Data scadenza</label>
                  <input
                    type="date"
                    value={form.due_date ?? ''}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value || null }))}
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeForm}
                  className="flex-1 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
                  Annulla
                </button>
                <button type="submit"
                  disabled={createDebt.isPending || updateDebt.isPending}
                  className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium transition-colors">
                  {createDebt.isPending || updateDebt.isPending ? 'Salvataggio...' : editingDebt ? 'Aggiorna' : 'Aggiungi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-debt-title">
          <div ref={deleteModalRef} className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 id="delete-debt-title" className="text-base font-semibold text-zinc-900 dark:text-white mb-2">Rimuovi debito</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">Il debito verrà archiviato e non sarà più visibile.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
                Annulla
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)}
                disabled={deleteDebt.isPending}
                className="flex-1 py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium transition-colors">
                {deleteDebt.isPending ? 'Rimozione...' : 'Rimuovi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
