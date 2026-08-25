'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Pause, Play, Repeat } from 'lucide-react'
import { DashboardLayout } from '@/components/DashboardLayout'
import {
  useRecurringExpenses,
  useCreateRecurringExpense,
  useUpdateRecurringExpense,
  useDeleteRecurringExpense,
  useGenerateRecurringBackfill,
} from '@/hooks/useRecurringExpenses'
import { useExpenseCategories } from '@/hooks/useCategories'
import { useToast } from '@/components/Toast'
import { useSettings } from '@/hooks/useSettings'
import { useModalA11y } from '@/hooks/useModalA11y'
import { formatCurrency, getLocalDateString, getPaymentMethods } from '@/lib/utils'
import type { RecurringExpense } from '@/types'

const BACKFILL_MAX_MONTHS = 24

export default function SpeseRicorrentiPage() {
  const { showToast } = useToast()
  const { data: settings } = useSettings()
  const currency = settings?.currency || 'EUR'
  const paymentMethods = getPaymentMethods(settings?.payment_methods)
  const fmt = (amount: number) => formatCurrency(amount, currency)

  const { data: recurringExpenses, isLoading } = useRecurringExpenses()
  const { data: expenseCategories } = useExpenseCategories()

  const createRecurring = useCreateRecurringExpense()
  const updateRecurring = useUpdateRecurringExpense()
  const deleteRecurring = useDeleteRecurringExpense()
  const generateBackfill = useGenerateRecurringBackfill()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RecurringExpense | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<RecurringExpense | null>(null)
  const [backfillMonths, setBackfillMonths] = useState('3')

  // Form state
  const [fName, setFName] = useState('')
  const [fCategoryId, setFCategoryId] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDayOfMonth, setFDayOfMonth] = useState(String(new Date().getDate()))
  const [fPaymentMethod, setFPaymentMethod] = useState('')
  const [fNotes, setFNotes] = useState('')
  const [fStartDate, setFStartDate] = useState(getLocalDateString())

  const getCategoryLabel = (categoryId: string | null) => {
    const cat = expenseCategories?.find((c) => c.id === categoryId)
    return cat ? `${cat.icon || ''} ${cat.name}` : 'Nessuna categoria'
  }

  const openCreateForm = () => {
    setEditing(null)
    setFName('')
    setFCategoryId('')
    setFAmount('')
    setFDayOfMonth(String(new Date().getDate()))
    setFPaymentMethod('')
    setFNotes('')
    setFStartDate(getLocalDateString())
    setShowForm(true)
  }

  const openEditForm = (item: RecurringExpense) => {
    setEditing(item)
    setFName(item.name)
    setFCategoryId(item.category_id || '')
    setFAmount(String(item.amount))
    setFDayOfMonth(String(item.day_of_month))
    setFPaymentMethod(item.payment_method || '')
    setFNotes(item.notes || '')
    setFStartDate(item.start_date)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const formModalRef = useModalA11y<HTMLDivElement>(showForm, closeForm)
  const deleteModalRef = useModalA11y<HTMLDivElement>(!!confirmDelete, () => setConfirmDelete(null))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const amount = parseFloat(fAmount)
    if (isNaN(amount) || amount <= 0) {
      showToast('Inserisci un importo valido maggiore di zero', 'error')
      return
    }
    const dayOfMonth = parseInt(fDayOfMonth, 10)
    if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      showToast('Il giorno del mese deve essere tra 1 e 31', 'error')
      return
    }
    if (!fName.trim()) {
      showToast('Inserisci un nome', 'error')
      return
    }

    const payload = {
      name: fName.trim(),
      category_id: fCategoryId || undefined,
      amount,
      day_of_month: dayOfMonth,
      payment_method: fPaymentMethod || undefined,
      notes: fNotes || undefined,
      start_date: fStartDate,
    }

    try {
      if (editing) {
        await updateRecurring.mutateAsync({ id: editing.id, data: payload })
        showToast('Spesa ricorrente aggiornata')
      } else {
        await createRecurring.mutateAsync(payload)
        showToast('Spesa ricorrente aggiunta')
      }
      closeForm()
    } catch {
      showToast('Errore durante il salvataggio', 'error')
    }
  }

  const handleToggleActive = async (item: RecurringExpense) => {
    try {
      await updateRecurring.mutateAsync({ id: item.id, data: { is_active: !item.is_active } })
      showToast(item.is_active ? 'Spesa ricorrente messa in pausa' : 'Spesa ricorrente riattivata')
    } catch {
      showToast('Errore durante l\'aggiornamento', 'error')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await deleteRecurring.mutateAsync(confirmDelete.id)
      showToast('Spesa ricorrente eliminata', 'info')
    } catch {
      showToast('Errore durante l\'eliminazione', 'error')
    } finally {
      setConfirmDelete(null)
    }
  }

  const handleBackfill = async () => {
    const months = parseInt(backfillMonths, 10)
    if (isNaN(months) || months < 1 || months > BACKFILL_MAX_MONTHS) {
      showToast(`Inserisci un numero di mesi tra 1 e ${BACKFILL_MAX_MONTHS}`, 'error')
      return
    }
    try {
      const created = await generateBackfill.mutateAsync(months)
      showToast(
        created > 0
          ? `Generate ${created} transazioni negli ultimi ${months} mesi`
          : 'Nessuna nuova transazione da generare: erano già tutte presenti'
      )
    } catch {
      showToast('Errore durante la generazione degli arretrati', 'error')
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Spese ricorrenti</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Modelli di spesa che generano automaticamente le transazioni ogni mese
            </p>
          </div>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm shrink-0"
          >
            <Plus size={15} />
            Nuova spesa ricorrente
          </button>
        </div>

        {/* Backfill */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Genera arretrati</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Crea le transazioni mancanti dei mesi passati per tutte le spese ricorrenti attive
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              min={1}
              max={BACKFILL_MAX_MONTHS}
              value={backfillMonths}
              onChange={(e) => setBackfillMonths(e.target.value)}
              className="w-20 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
            />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">mesi indietro</span>
            <button
              onClick={handleBackfill}
              disabled={generateBackfill.isPending}
              className="py-2 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-60 transition-colors"
            >
              {generateBackfill.isPending ? 'Generazione...' : 'Genera'}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-zinc-500">Caricamento...</div>
          ) : recurringExpenses?.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              Nessuna spesa ricorrente. Aggiungine una per generare automaticamente le transazioni ogni mese.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
              {recurringExpenses?.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${item.is_active ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500'}`}>
                      <Repeat size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                        {getCategoryLabel(item.category_id)} · giorno {item.day_of_month}
                        {!item.is_active && ' · in pausa'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <span className="font-semibold text-sm sm:text-base text-red-600">{fmt(item.amount)}</span>
                    <button
                      onClick={() => handleToggleActive(item)}
                      aria-label={item.is_active ? 'Metti in pausa' : 'Riattiva'}
                      title={item.is_active ? 'Metti in pausa' : 'Riattiva'}
                      className="p-1 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    >
                      {item.is_active ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => openEditForm(item)}
                      aria-label="Modifica spesa ricorrente"
                      className="p-1 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(item)}
                      aria-label="Elimina spesa ricorrente"
                      className="p-1 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" role="dialog" aria-modal="true" aria-labelledby="recurring-modal-title">
          <div ref={formModalRef} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between shrink-0">
              <h2 id="recurring-modal-title" className="text-xl font-bold text-zinc-900 dark:text-white">
                {editing ? 'Modifica spesa ricorrente' : 'Nuova spesa ricorrente'}
              </h2>
              <button type="button" onClick={closeForm} aria-label="Chiudi" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Nome</label>
                <input
                  type="text"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  required
                  placeholder="es. Affitto, Netflix, Palestra"
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Categoria</label>
                <select
                  value={fCategoryId}
                  onChange={(e) => setFCategoryId(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                >
                  <option value="">Nessuna categoria</option>
                  {expenseCategories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Importo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={fAmount}
                    onChange={(e) => setFAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Giorno del mese</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={fDayOfMonth}
                    onChange={(e) => setFDayOfMonth(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Attiva dal</label>
                <input
                  type="date"
                  value={fStartDate}
                  onChange={(e) => setFStartDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Nessuna occorrenza verrà generata prima di questa data</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Metodo di pagamento</label>
                <select
                  value={fPaymentMethod}
                  onChange={(e) => setFPaymentMethod(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                >
                  <option value="">Seleziona metodo</option>
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                  {fPaymentMethod && !paymentMethods.includes(fPaymentMethod) && (
                    <option value={fPaymentMethod}>{fPaymentMethod}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Note (opzionale)</label>
                <input
                  type="text"
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 py-3 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={createRecurring.isPending || updateRecurring.isPending}
                  className="flex-1 py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium transition-colors"
                >
                  {(createRecurring.isPending || updateRecurring.isPending) ? 'Salvataggio...' : editing ? 'Aggiorna' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" role="dialog" aria-modal="true" aria-labelledby="delete-recurring-title">
          <div ref={deleteModalRef} className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 id="delete-recurring-title" className="text-base font-semibold text-zinc-900 dark:text-white mb-2">Elimina spesa ricorrente</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
              Le transazioni già generate per &ldquo;{confirmDelete.name}&rdquo; restano nello storico, ma non ne verranno create di nuove. L&apos;azione è irreversibile.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteRecurring.isPending}
                className="flex-1 py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                {deleteRecurring.isPending ? 'Eliminazione...' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
