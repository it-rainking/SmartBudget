'use client'

import { Tag } from 'lucide-react'
import { Modal } from '@/components/ui'
import { useTransactions } from '@/hooks/useTransactions'
import { formatCurrency, formatMonth } from '@/lib/utils'
import type { ExpenseCategory } from '@/types'

// Modal che elenca tutte le singole spese di una categoria nel mese selezionato.
// È un componente separato così la query sulle transazioni parte solo quando
// il modal è montato (cioè quando l'utente clicca una categoria).
export function CategoryExpensesModal({
  category,
  month,
  year,
  currency,
  totalForCategory,
  onClose,
}: {
  category: ExpenseCategory
  month: number
  year: number
  currency: string
  totalForCategory: number
  onClose: () => void
}) {
  const { data: transactions, isLoading } = useTransactions({
    month,
    year,
    type: 'expense',
    category_id: category.id,
  })
  const fmt = (n: number) => formatCurrency(n, currency)

  return (
    <Modal open onClose={onClose} labelledBy="category-detail-title" className="flex flex-col">
      <div className="p-5 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
            style={{ backgroundColor: (category.color || '#6b7280') + '22' }}>
            {category.icon || <Tag size={16} className="text-zinc-400" />}
          </div>
          <div className="min-w-0">
            <h2 id="category-detail-title" className="text-base font-bold text-zinc-900 dark:text-white truncate">{category.name}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatMonth(month, year)} · {fmt(totalForCategory)}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Chiudi" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shrink-0">✕</button>
      </div>

      <div className="overflow-y-auto p-2">
        {isLoading ? (
          <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Caricamento...</p>
        ) : !transactions || transactions.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Nessuna spesa registrata per questa categoria</p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
            {transactions.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {t.description || 'Senza descrizione'}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {(() => { const [y, m, d] = t.date.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('it-IT') })()}
                    {t.payment_method ? ` · ${t.payment_method}` : ''}
                  </p>
                </div>
                <span className="text-sm font-semibold text-red-600 shrink-0">-{fmt(t.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
