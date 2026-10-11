'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Repeat } from 'lucide-react'
import { Modal, Section } from '@/components/ui'
import { useToast } from '@/components/Toast'
import { useExpenseCategories } from '@/hooks/useCategories'
import {
  useRecurringExpensesInMonth,
  useCreateRecurringExpense,
  useEnsureCurrentMonthRecurring,
  type RecurringOccurrence,
} from '@/hooks/useRecurringExpenses'
import { formatCurrency, formatDate, getLocalDateString } from '@/lib/utils'

// Box "Spese ricorrenti": occorrenze già generate nel mese selezionato (una
// riga per ogni modello di /spese-ricorrenti che ha già una transazione
// collegata) più il totale del mese. L'aggiunta di un nuovo modello è
// possibile anche da qui, oltre che dal tab Transazioni (toggle "Transazione
// ricorrente") e dal pannello dedicato.
export function RecurringExpensesBox({
  month,
  year,
  currency,
  className,
}: {
  month: number
  year: number
  currency: string
  className?: string
}) {
  const { showToast } = useToast()
  const fmt = (n: number) => formatCurrency(n, currency)
  const { data: occurrences, isLoading } = useRecurringExpensesInMonth(month, year)
  const { data: expenseCategories } = useExpenseCategories()
  const createRecurring = useCreateRecurringExpense()
  const ensureCurrentMonth = useEnsureCurrentMonthRecurring()

  const [showForm, setShowForm] = useState(false)
  const [fName, setFName] = useState('')
  const [fCategoryId, setFCategoryId] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDayOfMonth, setFDayOfMonth] = useState(String(new Date().getDate()))

  const closeForm = () => setShowForm(false)

  const total = (occurrences ?? []).reduce((sum: number, o: RecurringOccurrence) => sum + o.amount, 0)

  const now = new Date()
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()

  const openForm = () => {
    setFName('')
    setFCategoryId('')
    setFAmount('')
    setFDayOfMonth(String(now.getDate()))
    setShowForm(true)
  }

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

    try {
      await createRecurring.mutateAsync({
        name: fName.trim(),
        category_id: fCategoryId || undefined,
        amount,
        day_of_month: dayOfMonth,
        start_date: getLocalDateString(),
      })
      // Genera subito l'occorrenza se il mese aperto è quello corrente,
      // altrimenti verrà creata automaticamente al prossimo accesso o dal
      // backfill nel pannello dedicato.
      if (isCurrentMonth) {
        await ensureCurrentMonth.mutateAsync()
      }
      showToast('Spesa ricorrente aggiunta')
      closeForm()
    } catch {
      showToast('Errore durante il salvataggio', 'error')
    }
  }

  const count = occurrences?.length ?? 0

  return (
    <>
      <Section
        storageKey="dashboard-recurring"
        title="Spese ricorrenti"
        Icon={Repeat}
        defaultOpen={false}
        className={className}
        summary={isLoading ? 'Caricamento...' : count === 0 ? 'Nessuna questo mese' : `${count} ${count === 1 ? 'spesa' : 'spese'} · ${fmt(total)}`}
        actions={
          <>
            <button
              onClick={openForm}
              aria-label="Aggiungi spesa ricorrente"
              className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">Aggiungi</span>
            </button>
            <Link
              href="/spese-ricorrenti"
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              Gestisci
            </Link>
          </>
        }
      >
        {!isLoading && (!occurrences || occurrences.length === 0) ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Nessuna spesa ricorrente registrata questo mese
          </p>
        ) : (
          <div className="divide-y divide-zinc-50 dark:divide-zinc-700/50 max-h-72 overflow-y-auto">
            {occurrences?.map((o) => (
              <div key={o.id} className="px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base shrink-0">{o.categoryIcon || <Repeat size={15} className="text-zinc-400" />}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                      {o.name}
                      {!o.isActive && (
                        <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(in pausa)</span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatDate(o.date)}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-red-600 shrink-0">{fmt(o.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {showForm && (
        <Modal open onClose={closeForm} labelledBy="quick-recurring-title" size="sm" dismissOnBackdrop={false} className="flex flex-col">
          <div className="p-5 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between shrink-0">
            <h2 id="quick-recurring-title" className="text-lg font-bold text-zinc-900 dark:text-white">Nuova spesa ricorrente</h2>
            <button type="button" onClick={closeForm} aria-label="Chiudi" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">✕</button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Nome</label>
              <input
                type="text"
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                required
                placeholder="es. Affitto, Netflix, Palestra"
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Categoria</label>
              <select
                value={fCategoryId}
                onChange={(e) => setFCategoryId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
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
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={fAmount}
                  onChange={(e) => setFAmount(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Giorno del mese</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={fDayOfMonth}
                  onChange={(e) => setFDayOfMonth(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Per metodo di pagamento, note o data di inizio personalizzata usa il pannello{' '}
              <Link href="/spese-ricorrenti" className="text-emerald-600 hover:underline">Spese ricorrenti</Link>.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeForm}
                className="flex-1 py-2.5 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={createRecurring.isPending || ensureCurrentMonth.isPending}
                className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium transition-colors"
              >
                {(createRecurring.isPending || ensureCurrentMonth.isPending) ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

