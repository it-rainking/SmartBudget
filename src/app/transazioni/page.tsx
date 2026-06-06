'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useTransactions, useCreateTransaction, useUpdateTransaction, useDeleteTransaction } from '@/hooks/useTransactions'
import { useIncomeCategories, useExpenseCategories, useSavingCategories, useInitializeCategories } from '@/hooks/useCategories'
import { useToast } from '@/components/Toast'
import { ImportCSVModal } from '@/components/ImportCSVModal'
import type { TransactionType, Transaction } from '@/types'

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
]

const PAYMENT_METHODS = [
  'Contanti', 'Carta di Credito', 'Carta di Debito', 'Bonifico', 'PayPal', 'Altro'
]

const PAGE_SIZE = 20

export default function TransazioniPage() {
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [showForm, setShowForm] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [filterType, setFilterType] = useState<TransactionType | ''>('')
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('')
  const [filterMinAmount, setFilterMinAmount] = useState('')
  const [filterMaxAmount, setFilterMaxAmount] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { showToast } = useToast()

  // Form state
  const [formType, setFormType] = useState<TransactionType>('expense')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formDescription, setFormDescription] = useState('')
  const [formPaymentMethod, setFormPaymentMethod] = useState('')
  const [formIsRecurring, setFormIsRecurring] = useState(false)

  // Queries
  const { data: transactions, isLoading } = useTransactions({
    month: selectedMonth,
    year: selectedYear,
    type: filterType || undefined,
    payment_method: filterPaymentMethod || undefined,
  })
  const { data: incomeCategories } = useIncomeCategories()
  const { data: expenseCategories } = useExpenseCategories()
  const { data: savingCategories } = useSavingCategories()

  // Mutations
  const createTransaction = useCreateTransaction()
  const updateTransaction = useUpdateTransaction()
  const deleteTransaction = useDeleteTransaction()
  const initializeCategories = useInitializeCategories()

  // Shortcut tastiera: Ctrl+N = nuova transazione, Esc = chiudi modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDeleteId) { setConfirmDeleteId(null); return }
        if (showForm) { closeForm(); return }
        if (showImport) setShowImport(false)
      }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        if (!showForm && !showImport) setShowForm(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showForm, showImport, confirmDeleteId])

  // Check if categories exist
  const hasCategories = (incomeCategories?.length || 0) > 0 ||
                        (expenseCategories?.length || 0) > 0 ||
                        (savingCategories?.length || 0) > 0

  // Filtra client-side per descrizione e range importo
  const filteredTransactions = transactions?.filter(t => {
    if (searchTerm && !t.description?.toLowerCase().includes(searchTerm.toLowerCase())) return false
    if (filterMinAmount && t.amount < parseFloat(filterMinAmount)) return false
    if (filterMaxAmount && t.amount > parseFloat(filterMaxAmount)) return false
    return true
  })

  const totalPages = Math.ceil((filteredTransactions?.length ?? 0) / PAGE_SIZE)
  const paginatedTransactions = filteredTransactions?.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const getCategories = () => {
    switch (formType) {
      case 'income':
        return incomeCategories || []
      case 'expense':
        return expenseCategories || []
      case 'saving':
        return savingCategories || []
      default:
        return []
    }
  }

  const getCategoryName = (categoryId: string, type: TransactionType) => {
    let categories: { id: string; name: string; icon?: string | null }[] = []
    switch (type) {
      case 'income':
        categories = incomeCategories || []
        break
      case 'expense':
        categories = expenseCategories || []
        break
      case 'saving':
        categories = savingCategories || []
        break
    }
    const cat = categories.find(c => c.id === categoryId)
    return cat ? `${cat.icon || ''} ${cat.name}` : 'Categoria'
  }

  // Apre il form in modalità modifica pre-popolando i campi
  const openEditForm = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setFormType(transaction.type)
    setFormCategoryId(transaction.category_id || '')
    setFormAmount(String(transaction.amount))
    setFormDate(transaction.date)
    setFormDescription(transaction.description || '')
    setFormPaymentMethod(transaction.payment_method || '')
    setFormIsRecurring(transaction.is_recurring || false)
    setShowForm(true)
  }

  // Resetta il form e chiude il modal
  const closeForm = () => {
    setFormAmount('')
    setFormDescription('')
    setFormCategoryId('')
    setFormPaymentMethod('')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormIsRecurring(false)
    setEditingTransaction(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      type: formType,
      category_id: formCategoryId,
      amount: parseFloat(formAmount),
      date: formDate,
      description: formDescription || undefined,
      payment_method: formPaymentMethod || undefined,
      is_recurring: formIsRecurring,
    }

    try {
      if (editingTransaction) {
        await updateTransaction.mutateAsync({ id: editingTransaction.id, data: payload })
        closeForm()
        showToast('Transazione modificata', 'success')
      } else {
        await createTransaction.mutateAsync(payload)
        closeForm()
        showToast('Transazione aggiunta')
      }
    } catch {
      showToast('Errore durante il salvataggio', 'error')
    }
  }

  const handleInitCategories = async () => {
    try {
      await initializeCategories.mutateAsync()
      showToast('Categorie inizializzate')
    } catch {
      showToast('Errore inizializzazione categorie', 'error')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)
  }

  const getTypeColor = (type: TransactionType) => {
    switch (type) {
      case 'income':
        return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
      case 'expense':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20'
      case 'saving':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
      case 'debt':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
    }
  }

  const getTypeLabel = (type: TransactionType) => {
    switch (type) {
      case 'income': return 'Entrata'
      case 'expense': return 'Spesa'
      case 'saving': return 'Risparmio'
      case 'debt': return 'Debito'
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Transazioni</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Gestisci le tue entrate e uscite</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              <span>📥</span>
              Importa CSV
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              <span>+</span>
              Nuova Transazione
            </button>
          </div>
        </div>

        {/* Initialize Categories Banner */}
        {!hasCategories && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-amber-800 dark:text-amber-200">Categorie non configurate</h3>
                <p className="text-sm text-amber-600 dark:text-amber-400">Inizializza le categorie predefinite per iniziare</p>
              </div>
              <button
                onClick={handleInitCategories}
                disabled={initializeCategories.isPending}
                className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {initializeCategories.isPending ? 'Inizializzazione...' : 'Inizializza Categorie'}
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(Number(e.target.value)); setCurrentPage(1) }}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
            >
              {MONTHS.map((month, i) => (
                <option key={i} value={i + 1}>{month}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(Number(e.target.value)); setCurrentPage(1) }}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
            >
              {[2024, 2025, 2026].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value as TransactionType | ''); setCurrentPage(1) }}
            className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
          >
            <option value="">Tutti i tipi</option>
            <option value="income">Entrate</option>
            <option value="expense">Spese</option>
            <option value="saving">Risparmi</option>
          </select>
        </div>

        {/* Ricerca testo */}
        <input
          type="text"
          placeholder="Cerca per descrizione..."
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }}
          className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        {/* Filtri avanzati */}
        <div>
          <button
            onClick={() => setShowAdvancedFilters(v => !v)}
            className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors"
          >
            <span>{showAdvancedFilters ? '▲' : '▼'}</span> Filtri avanzati
          </button>
          {showAdvancedFilters && (
            <div className="mt-3 flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 dark:text-zinc-400">Metodo pagamento</label>
                <select
                  value={filterPaymentMethod}
                  onChange={e => { setFilterPaymentMethod(e.target.value); setCurrentPage(1) }}
                  className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
                >
                  <option value="">Tutti</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 dark:text-zinc-400">Importo min (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={filterMinAmount}
                  onChange={e => { setFilterMinAmount(e.target.value); setCurrentPage(1) }}
                  placeholder="0"
                  className="w-28 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 dark:text-zinc-400">Importo max (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={filterMaxAmount}
                  onChange={e => { setFilterMaxAmount(e.target.value); setCurrentPage(1) }}
                  placeholder="∞"
                  className="w-28 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
                />
              </div>
              {(filterPaymentMethod || filterMinAmount || filterMaxAmount) && (
                <button
                  onClick={() => {
                    setFilterPaymentMethod('')
                    setFilterMinAmount('')
                    setFilterMaxAmount('')
                    setCurrentPage(1)
                  }}
                  className="px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-500 transition-colors"
                >
                  Azzera filtri
                </button>
              )}
            </div>
          )}
        </div>

        {/* Transactions List */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-zinc-500">Caricamento...</div>
          ) : transactions?.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              Nessuna transazione per questo periodo
            </div>
          ) : filteredTransactions?.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              Nessun risultato per &ldquo;{searchTerm}&rdquo;
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
              {paginatedTransactions?.map((transaction) => (
                <div key={transaction.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                  <div className="flex items-center gap-4">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(transaction.type)}`}>
                      {getTypeLabel(transaction.type)}
                    </div>
                    <div>
                      {transaction.category_id ? (
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {getCategoryName(transaction.category_id, transaction.type)}
                        </p>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-xs italic text-gray-500 bg-gray-100 dark:bg-zinc-700 dark:text-gray-400">
                          Non categorizzato
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        {transaction.description && (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">{transaction.description}</p>
                        )}
                        {transaction.is_recurring && (
                          <span title="Ricorrente" className="text-xs text-blue-400">🔄</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">{new Date(transaction.date).toLocaleDateString('it-IT')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-semibold ${transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </span>
                    <button
                      onClick={() => openEditForm(transaction)}
                      aria-label="Modifica transazione"
                      className="text-zinc-400 hover:text-emerald-600 transition-colors"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(transaction.id)}
                      aria-label="Elimina transazione"
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-700">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredTransactions?.length ?? 0)} di {filteredTransactions?.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  ‹ Prec.
                </button>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  Succ. ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{editingTransaction ? 'Modifica Transazione' : 'Nuova Transazione'}</h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Type Selection */}
              <div className="flex gap-2">
                {(['income', 'expense', 'saving'] as TransactionType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setFormType(type)
                      setFormCategoryId('')
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      formType === type
                        ? type === 'income'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : type === 'expense'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
                    }`}
                  >
                    {getTypeLabel(type)}
                  </button>
                ))}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Categoria
                </label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                >
                  <option value="">Seleziona categoria</option>
                  {getCategories().map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Importo (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Data
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Descrizione (opzionale)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  placeholder="es. Spesa al supermercato"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Metodo di pagamento
                </label>
                <select
                  value={formPaymentMethod}
                  onChange={(e) => setFormPaymentMethod(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                >
                  <option value="">Seleziona metodo</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>

              {/* Ricorrente */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Transazione ricorrente</p>
                  <p className="text-xs text-zinc-400">Es. affitto, abbonamento mensile</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormIsRecurring(v => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${formIsRecurring ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                  aria-pressed={formIsRecurring}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formIsRecurring ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Actions */}
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
                  disabled={createTransaction.isPending || updateTransaction.isPending}
                  className="flex-1 py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium transition-colors"
                >
                  {(createTransaction.isPending || updateTransaction.isPending) ? 'Salvataggio...' : editingTransaction ? 'Aggiorna' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">Elimina transazione</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">Questa azione è irreversibile.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  deleteTransaction.mutate(confirmDeleteId)
                  showToast('Transazione eliminata', 'info')
                  setConfirmDeleteId(null)
                }}
                className="flex-1 py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && <ImportCSVModal onClose={() => setShowImport(false)} />}
    </DashboardLayout>
  )
}
