'use client'

import { useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/Toast'
import { useCreateTransaction, useTransactions } from '@/hooks/useTransactions'
import { useExpenseCategories, useIncomeCategories, useSavingCategories } from '@/hooks/useCategories'
import { useSettings } from '@/hooks/useSettings'
import { classNames, formatDate, getLocalDateString, getPaymentMethods } from '@/lib/utils'
import type { TransactionType } from '@/types'

type QuickType = Exclude<TransactionType, 'debt'>

const TYPES: { value: QuickType; label: string; saved: string; active: string }[] = [
  { value: 'expense', label: 'Spesa', saved: 'Spesa registrata', active: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'income', label: 'Entrata', saved: 'Entrata registrata', active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { value: 'saving', label: 'Risparmio', saved: 'Risparmio registrato', active: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
]

const VISIBLE_CATEGORIES = 5
const LAST_METHOD_KEY = 'smartbudget:last-payment-method'
/** Evento per aprire il form completo quando /transazioni è già la pagina aperta */
export const OPEN_FULL_FORM_EVENT = 'smartbudget:open-full-form'

/** "1.234,56" / "12,5" / "12.50" → numero. Accetta virgola e punto come decimali. */
export function parseAmountInput(raw: string): number {
  const s = raw.trim().replace(/\s|€/g, '')
  if (!s) return NaN
  // Con la virgola i punti sono separatori delle migliaia (formato italiano)
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  return /^\d*\.?\d*$/.test(normalized) ? parseFloat(normalized) : NaN
}

function readLastMethod(): string {
  try {
    return window.localStorage.getItem(LAST_METHOD_KEY) ?? ''
  } catch {
    return ''
  }
}

interface QuickAddSheetProps {
  onClose: () => void
}

// Inserimento rapido dal "+" (barra in basso su mobile, sidebar o tasto N su
// desktop): importo per primo, categorie più usate del mese a un tocco, data
// di oggi e ultimo metodo di pagamento già impostati. Rate PayPal, ricorrenze
// e movimenti eccezionali restano nel form completo di /transazioni, che si
// apre con "Più opzioni" portandosi dietro i valori già inseriti.
export function QuickAddSheet({ onClose }: QuickAddSheetProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { showToast } = useToast()
  const createTransaction = useCreateTransaction()
  const { data: settings } = useSettings()
  const { data: expenseCategories } = useExpenseCategories()
  const { data: incomeCategories } = useIncomeCategories()
  const { data: savingCategories } = useSavingCategories()
  // Stessa query (e cache) della dashboard del mese corrente
  const { data: monthTransactions } = useTransactions()

  const [type, setType] = useState<QuickType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(getLocalDateString())
  const [paymentMethod, setPaymentMethod] = useState(readLastMethod)
  const submittingRef = useRef(false)

  const paymentMethods = getPaymentMethods(settings?.payment_methods)

  const categories = useMemo(() => {
    const list = type === 'expense' ? expenseCategories : type === 'income' ? incomeCategories : savingCategories
    const active = (list ?? []).filter((c) => c.is_active !== false)
    // Ordine per frequenza d'uso nel mese, a parità l'ordine scelto dall'utente
    const usage = new Map<string, number>()
    for (const t of monthTransactions ?? []) {
      if (t.type === type && t.category_id) usage.set(t.category_id, (usage.get(t.category_id) ?? 0) + 1)
    }
    return [...active].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.sort_order - b.sort_order)
  }, [type, expenseCategories, incomeCategories, savingCategories, monthTransactions])

  const visibleCategories = showAllCategories ? categories : categories.slice(0, VISIBLE_CATEGORIES)
  // La categoria scelta da "Altre" resta visibile anche richiudendo l'elenco
  const selectedHidden = !showAllCategories && categoryId && !visibleCategories.some((c) => c.id === categoryId)
    ? categories.find((c) => c.id === categoryId)
    : undefined

  const parsedAmount = parseAmountInput(amount)
  const amountValid = !isNaN(parsedAmount) && parsedAmount > 0

  const changeType = (t: QuickType) => {
    setType(t)
    setCategoryId('')
    setShowAllCategories(false)
  }

  const openFullForm = () => {
    const params = new URLSearchParams({ nuova: '1', tipo: type })
    if (amountValid) params.set('importo', String(parsedAmount))
    if (categoryId) params.set('categoria', categoryId)
    if (description.trim()) params.set('descrizione', description.trim())
    if (date !== getLocalDateString()) params.set('data', date)
    if (paymentMethod) params.set('metodo', paymentMethod)
    onClose()
    // Già su /transazioni la pagina non si rimonta: le si passano i valori
    // con un evento invece che con l'URL
    if (pathname === '/transazioni') {
      window.dispatchEvent(new CustomEvent(OPEN_FULL_FORM_EVENT, { detail: params.toString() }))
    } else {
      router.push(`/transazioni?${params.toString()}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amountValid) {
      showToast('Inserisci un importo maggiore di zero', 'error')
      return
    }
    // Guardia sincrona contro il doppio tap (vedi handleSubmit in /transazioni)
    if (submittingRef.current) return
    submittingRef.current = true
    try {
      await createTransaction.mutateAsync({
        type,
        amount: Math.round(parsedAmount * 100) / 100,
        date,
        category_id: categoryId || undefined,
        description: description.trim() || undefined,
        payment_method: type === 'expense' && paymentMethod ? paymentMethod : undefined,
      })
      if (type === 'expense' && paymentMethod) {
        try { window.localStorage.setItem(LAST_METHOD_KEY, paymentMethod) } catch { /* preferenza facoltativa */ }
      }
      showToast(TYPES.find((t) => t.value === type)?.saved ?? 'Movimento registrato', 'success')
      onClose()
    } catch (err) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'errore sconosciuto'
      showToast(`Salvataggio non riuscito: ${message}`, 'error')
    } finally {
      submittingRef.current = false
    }
  }

  const isToday = date === getLocalDateString()

  return (
    <Modal open onClose={onClose} labelledBy="quick-add-title" dismissOnBackdrop={!amount}>
      <form onSubmit={handleSubmit} className="p-5 pt-3 sm:pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="quick-add-title" className="text-base font-semibold text-zinc-900 dark:text-white">Nuovo movimento</h2>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="p-1.5 -mr-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700">✕</button>
        </div>

        <div className="grid grid-cols-3 rounded-xl border border-zinc-200 dark:border-zinc-700 p-1 gap-1" role="radiogroup" aria-label="Tipo di movimento">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={type === t.value}
              onClick={() => changeType(t.value)}
              className={classNames(
                'py-2 rounded-lg text-sm font-medium transition-colors',
                type === t.value ? t.active : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/50',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="text-center">
          <label htmlFor="quick-amount" className="sr-only">Importo in {settings?.currency || 'EUR'}</label>
          <div className="flex items-baseline justify-center gap-1">
            <input
              id="quick-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              data-autofocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              // Larghezza sul contenuto: il simbolo della valuta resta attaccato alle cifre
              style={{ width: `${Math.max(4, amount.length + 0.5)}ch` }}
              className="max-w-[80%] bg-transparent text-right text-4xl font-bold text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-none"
            />
            <span className="text-2xl font-semibold text-zinc-400">{settings?.currency === 'USD' ? '$' : '€'}</span>
          </div>
          {amount && !amountValid && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Importo non valido: usa solo cifre e la virgola per i decimali</p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Categoria</p>
          {categories.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nessuna categoria: il movimento verrà salvato senza.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[...visibleCategories, ...(selectedHidden ? [selectedHidden] : [])].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={categoryId === c.id}
                  onClick={() => setCategoryId(categoryId === c.id ? '' : c.id)}
                  className={classNames(
                    'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors',
                    categoryId === c.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-medium dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700/50',
                  )}
                >
                  {c.icon && <span aria-hidden="true">{c.icon}</span>}
                  {c.name}
                </button>
              ))}
              {categories.length > VISIBLE_CATEGORIES && (
                <button
                  type="button"
                  onClick={() => setShowAllCategories((v) => !v)}
                  className="px-3 py-2 rounded-lg text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  {showAllCategories ? 'Meno' : `Altre (${categories.length - VISIBLE_CATEGORIES})`}
                </button>
              )}
            </div>
          )}
        </div>

        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrizione (facoltativa)"
          aria-label="Descrizione"
          className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
        />

        <div className="flex flex-wrap gap-2">
          <label className="relative inline-flex items-center px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-sm text-zinc-700 dark:text-zinc-200 cursor-pointer">
            {isToday ? 'Oggi' : formatDate(date)}
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Data"
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
          {type === 'expense' && (
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              aria-label="Metodo di pagamento"
              className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-sm text-zinc-700 dark:text-zinc-200 border-0"
            >
              <option value="">Metodo: nessuno</option>
              {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <button
            type="button"
            onClick={openFullForm}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          >
            <SlidersHorizontal size={14} />
            Più opzioni
          </button>
        </div>

        <button
          type="submit"
          disabled={!amountValid || createTransaction.isPending}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition-colors"
        >
          {createTransaction.isPending ? 'Salvataggio...' : `Salva ${TYPES.find((t) => t.value === type)?.label.toLowerCase()}`}
        </button>
      </form>
    </Modal>
  )
}
