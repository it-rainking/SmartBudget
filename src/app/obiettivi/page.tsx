'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useGoals, useCreateGoal, useUpdateGoal, useAddGoalProgress, useCompleteGoal, useDeleteGoal } from '@/hooks/useGoals'
import { useSettings } from '@/hooks/useSettings'
import { useToast } from '@/components/Toast'
import { formatCurrency } from '@/lib/utils'
import type { GoalType, Goal } from '@/types'

const TYPE_LABELS: Record<GoalType, string> = {
  saving: 'Risparmio',
  debt: 'Debito',
}

const TYPE_ICONS: Record<GoalType, string> = {
  saving: '🏦',
  debt: '📉',
}

interface NewGoalForm {
  name: string
  target_amount: string
  current_amount: string
  deadline: string
  type: GoalType
  description: string
}

interface ProgressForm {
  goalId: string
  amount: string
  currentAmount: number
}

const emptyForm: NewGoalForm = {
  name: '',
  target_amount: '',
  current_amount: '0',
  deadline: '',
  type: 'saving',
  description: '',
}

export default function ObiettiviPage() {
  const { data: goals, isLoading } = useGoals()
  const { data: settings } = useSettings()
  const createGoal = useCreateGoal()
  const updateGoal = useUpdateGoal()
  const addProgress = useAddGoalProgress()
  const completeGoal = useCompleteGoal()
  const deleteGoal = useDeleteGoal()
  const { showToast } = useToast()

  const [showModal, setShowModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [progressModal, setProgressModal] = useState<ProgressForm | null>(null)
  const [form, setForm] = useState<NewGoalForm>(emptyForm)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [confirmDeleteGoalId, setConfirmDeleteGoalId] = useState<string | null>(null)

  const currency = settings?.currency || 'EUR'
  const fmt = (n: number) => formatCurrency(n, currency)

  const filteredGoals = goals?.filter(g => {
    if (filter === 'active') return !g.is_completed
    if (filter === 'completed') return g.is_completed
    return true
  }) ?? []

  const activeGoals = goals?.filter(g => !g.is_completed) ?? []
  const completedGoals = goals?.filter(g => g.is_completed) ?? []
  const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0)
  const totalSaved = activeGoals.reduce((s, g) => s + g.current_amount, 0)

  // Apre il modal in modalità modifica pre-popolando i campi
  function openEditForm(goal: Goal) {
    setEditingGoal(goal)
    setForm({
      name: goal.name,
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount),
      deadline: goal.deadline ?? '',
      type: goal.type as GoalType,
      description: goal.description ?? '',
    })
    setShowModal(true)
  }

  // Chiude il modal e resetta il form
  function closeModal() {
    setShowModal(false)
    setEditingGoal(null)
    setForm(emptyForm)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const target = parseFloat(form.target_amount)
    const current = parseFloat(form.current_amount || '0')
    if (!form.name || isNaN(target) || target <= 0) return

    if (editingGoal) {
      try {
        await updateGoal.mutateAsync({
          id: editingGoal.id,
          data: {
            name: form.name,
            target_amount: target,
            ...(form.deadline ? { deadline: form.deadline } : {}),
          },
        })
        showToast('Obiettivo modificato', 'success')
        closeModal()
      } catch {
        showToast('Errore durante la modifica', 'error')
      }
      return
    }

    try {
      await createGoal.mutateAsync({
        name: form.name,
        type: form.type,
        target_amount: target,
        current_amount: current,
        deadline: form.deadline || null,
        description: form.description || null,
        is_completed: current >= target,
        completed_at: current >= target ? new Date().toISOString() : null,
        category_id: null,
        icon: null,
        color: null,
      })
      showToast('Obiettivo creato', 'success')
      setShowModal(false)
      setForm(emptyForm)
    } catch {
      showToast('Errore durante la creazione', 'error')
    }
  }

  async function handleAddProgress(e: React.FormEvent) {
    e.preventDefault()
    if (!progressModal) return
    const amount = parseFloat(progressModal.amount)
    if (isNaN(amount) || amount <= 0) return

    try {
      await addProgress.mutateAsync({
        id: progressModal.goalId,
        amount,
        currentAmount: progressModal.currentAmount,
      })
      showToast('Progresso aggiunto', 'success')
      setProgressModal(null)
    } catch {
      showToast('Errore durante l\'aggiornamento', 'error')
    }
  }

  async function handleComplete(id: string, targetAmount: number) {
    try {
      await completeGoal.mutateAsync({ id, targetAmount })
      showToast('Obiettivo completato!', 'success')
    } catch {
      showToast('Errore', 'error')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteGoal.mutateAsync(id)
      showToast('Obiettivo eliminato', 'info')
    } catch {
      showToast('Errore durante l\'eliminazione', 'error')
    } finally {
      setConfirmDeleteGoalId(null)
    }
  }

  function daysUntil(deadline: string | null): number | null {
    if (!deadline) return null
    const diff = new Date(deadline).getTime() - new Date().getTime()
    return Math.ceil(diff / 86400000)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Obiettivi Finanziari</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Monitora i tuoi traguardi di risparmio</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + Nuovo obiettivo
          </button>
        </div>

        {/* Summary cards */}
        {!isLoading && (goals?.length ?? 0) > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Obiettivi attivi', value: activeGoals.length.toString(), icon: '🎯', color: 'text-zinc-900 dark:text-white' },
              { label: 'Completati', value: completedGoals.length.toString(), icon: '✅', color: 'text-emerald-600' },
              { label: 'Target totale', value: fmt(totalTarget), icon: '🏆', color: 'text-zinc-900 dark:text-white' },
              { label: 'Risparmiato', value: fmt(totalSaved), icon: '💰', color: 'text-emerald-600' },
            ].map(card => (
              <div key={card.label} className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{card.label}</span>
                  <span className="text-lg">{card.icon}</span>
                </div>
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Overall progress bar */}
        {!isLoading && activeGoals.length > 0 && totalTarget > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Progresso complessivo obiettivi attivi</span>
              <span className="text-sm font-bold text-emerald-600">{Math.round((totalSaved / totalTarget) * 100)}%</span>
            </div>
            <div className="h-3 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((totalSaved / totalTarget) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{fmt(totalSaved)}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{fmt(totalTarget)}</span>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        {!isLoading && (goals?.length ?? 0) > 0 && (
          <div className="flex gap-2">
            {(['all', 'active', 'completed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-400'
                }`}
              >
                {f === 'all' ? 'Tutti' : f === 'active' ? 'Attivi' : 'Completati'}
              </button>
            ))}
          </div>
        )}

        {/* Goals grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700 animate-pulse">
                <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
                <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded mb-2" />
                <div className="h-8 w-20 bg-zinc-200 dark:bg-zinc-700 rounded" />
              </div>
            ))}
          </div>
        ) : filteredGoals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredGoals.map(goal => {
              const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100)
              const days = daysUntil(goal.deadline)
              const isUrgent = days !== null && days <= 30 && !goal.is_completed
              const goalType = goal.type as GoalType

              return (
                <div
                  key={goal.id}
                  className={`bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border transition-all ${
                    goal.is_completed
                      ? 'border-emerald-200 dark:border-emerald-800/40 opacity-80'
                      : isUrgent
                      ? 'border-amber-300 dark:border-amber-600/50'
                      : 'border-zinc-100 dark:border-zinc-700'
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{goal.icon || TYPE_ICONS[goalType]}</span>
                      <div>
                        <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm leading-tight">{goal.name}</h3>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{TYPE_LABELS[goalType]}</span>
                      </div>
                    </div>
                    {goal.is_completed && (
                      <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                        Completato ✓
                      </span>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-500 dark:text-zinc-400">{fmt(goal.current_amount)}</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{Math.round(pct)}%</span>
                      <span className="text-zinc-500 dark:text-zinc-400">{fmt(goal.target_amount)}</span>
                    </div>
                    <div className="h-2.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          goal.is_completed ? 'bg-emerald-500' : pct >= 75 ? 'bg-emerald-400' : pct >= 40 ? 'bg-blue-400' : 'bg-zinc-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {/* Proiezione mensile necessaria */}
                    {goal.deadline && goal.current_amount < goal.target_amount && (() => {
                      const today = new Date()
                      const deadline = new Date(goal.deadline)
                      const monthsLeft = Math.max(1, (deadline.getFullYear() - today.getFullYear()) * 12 + (deadline.getMonth() - today.getMonth()))
                      const needed = (goal.target_amount - goal.current_amount) / monthsLeft
                      return (
                        <p className="text-xs text-zinc-400 mt-1">
                          Risparmia {formatCurrency(needed, settings?.currency || 'EUR')}/mese per raggiungere l&apos;obiettivo
                        </p>
                      )
                    })()}
                  </div>

                  {/* Deadline */}
                  {goal.deadline && (
                    <div className={`flex items-center gap-1.5 mb-2 text-xs ${isUrgent ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      <span>📅</span>
                      <span>
                        {isUrgent && days !== null
                          ? `Scade tra ${days} giorni`
                          : new Date(goal.deadline).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
                        }
                      </span>
                    </div>
                  )}
                  {goal.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 line-clamp-2">{goal.description}</p>
                  )}

                  {/* Actions */}
                  {!goal.is_completed ? (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-700">
                      <button
                        onClick={() => setProgressModal({ goalId: goal.id, amount: '', currentAmount: goal.current_amount })}
                        className="flex-1 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-medium transition-colors"
                      >
                        + Aggiungi
                      </button>
                      <button
                        onClick={() => handleComplete(goal.id, goal.target_amount)}
                        className="flex-1 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium transition-colors"
                      >
                        Completa
                      </button>
                      <button
                        onClick={() => openEditForm(goal)}
                        aria-label="Modifica obiettivo"
                        className="py-1.5 px-2.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-xs transition-colors"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setConfirmDeleteGoalId(goal.id)}
                        aria-label="Elimina obiettivo"
                        className="py-1.5 px-2.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-xs transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-700">
                      <button
                        onClick={() => openEditForm(goal)}
                        aria-label="Modifica obiettivo"
                        className="py-1.5 px-2.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-xs transition-colors"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setConfirmDeleteGoalId(goal.id)}
                        aria-label="Elimina obiettivo"
                        className="py-1.5 px-2.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-xs transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-12 shadow-sm border border-zinc-100 dark:border-zinc-700 text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              {filter === 'completed' ? 'Nessun obiettivo completato' : filter === 'active' ? 'Nessun obiettivo attivo' : 'Nessun obiettivo'}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">
              {filter === 'all' ? 'Crea il tuo primo obiettivo finanziario per iniziare' : 'Cambia filtro o crea un nuovo obiettivo'}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                + Crea obiettivo
              </button>
            )}
          </div>
        )}

      </div>

      {/* New Goal Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-700">
              <h2 id="goal-modal-title" className="text-lg font-semibold text-zinc-900 dark:text-white">{editingGoal ? 'Modifica Obiettivo' : 'Nuovo Obiettivo'}</h2>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Nome obiettivo *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Es. Fondo vacanze, Macchina nuova..."
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Target ({currency}) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.target_amount}
                    onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Già risparmiato</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.current_amount}
                    onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as GoalType }))}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="saving">{TYPE_ICONS.saving} Risparmio</option>
                    <option value="debt">{TYPE_ICONS.debt} Debito</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Scadenza (opz.)</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Note (opzionale)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Descrizione o motivazione..."
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 px-4 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={createGoal.isPending || updateGoal.isPending}
                  className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {(createGoal.isPending || updateGoal.isPending) ? 'Salvataggio...' : editingGoal ? 'Aggiorna obiettivo' : 'Crea obiettivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Progress Modal */}
      {progressModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="progress-modal-title">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-700">
              <h2 id="progress-modal-title" className="text-lg font-semibold text-zinc-900 dark:text-white">Aggiungi Progresso</h2>
              <button onClick={() => setProgressModal(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">✕</button>
            </div>
            <form onSubmit={handleAddProgress} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Importo da aggiungere ({currency})</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={progressModal.amount}
                  onChange={e => setProgressModal(p => p ? { ...p, amount: e.target.value } : null)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                  required
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Attuale: {fmt(progressModal.currentAmount)}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setProgressModal(null)}
                  className="flex-1 py-2 px-4 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={addProgress.isPending}
                  className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {addProgress.isPending ? 'Salvataggio...' : 'Aggiungi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete obiettivo */}
      {confirmDeleteGoalId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-goal-title">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 id="delete-goal-title" className="text-base font-semibold text-zinc-900 dark:text-white mb-2">Elimina obiettivo</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">Questa azione è irreversibile.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteGoalId(null)}
                className="flex-1 py-2.5 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteGoalId)}
                disabled={deleteGoal.isPending}
                className="flex-1 py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium transition-colors"
              >
                {deleteGoal.isPending ? 'Eliminazione...' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
