'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import {
  useMonthlyBudget,
  useEnsureMonthlyBudget,
  useUpsertBudgetItem,
  useActualAmountsByCategory,
  useBudgetItems,
} from '@/hooks/useBudget'
import { useToast } from '@/components/Toast'
import { useIncomeCategories, useExpenseCategories, useSavingCategories } from '@/hooks/useCategories'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, formatMonth } from '@/lib/utils'

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

type TabType = 'income' | 'expense' | 'saving'

export default function BudgetPage() {
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [activeTab, setActiveTab] = useState<TabType>('expense')
  const [editingValues, setEditingValues] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)

  const { showToast } = useToast()
  const { data: settings } = useSettings()
  const currency = settings?.currency || 'EUR'
  const fmt = (n: number) => formatCurrency(n, currency)

  // Calcola mese/anno precedente
  const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
  const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear

  const { data: budget, isLoading: budgetLoading } = useMonthlyBudget(selectedMonth, selectedYear)
  const { data: prevBudgetData } = useBudgetItems(prevMonth, prevYear)
  const { data: actuals } = useActualAmountsByCategory(selectedMonth, selectedYear)
  const { data: incomeCategories } = useIncomeCategories()
  const { data: expenseCategories } = useExpenseCategories()
  const { data: savingCategories } = useSavingCategories()

  const ensureBudget = useEnsureMonthlyBudget()
  const upsertItem = useUpsertBudgetItem()

  // Crea automaticamente il record budget del mese al mount e al cambio mese/anno
  useEffect(() => {
    ensureBudget.mutate({ month: selectedMonth, year: selectedYear })
    // ensureBudget è stabile: escluso volutamente dalle dipendenze
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear])

  // Sync editing values from loaded budget items
  useEffect(() => {
    if (budget?.items) {
      const vals: Record<string, string> = {}
      budget.items.forEach((item) => {
        vals[item.category_id] = String(item.planned_amount)
      })
      setEditingValues(vals)
    }
  }, [budget])

  const getCategories = () => {
    switch (activeTab) {
      case 'income': return incomeCategories || []
      case 'expense': return expenseCategories || []
      case 'saving': return savingCategories || []
    }
  }

  const getPlanned = (categoryId: string) => parseFloat(editingValues[categoryId] || '0') || 0
  const getActual = (categoryId: string) => actuals?.[categoryId] || 0

  const totalPlanned = getCategories().reduce((sum, cat) => sum + getPlanned(cat.id), 0)
  const totalActual = getCategories().reduce((sum, cat) => sum + getActual(cat.id), 0)

  const handleSave = async (categoryId: string) => {
    setSavingId(categoryId)
    try {
      let budgetId = budget?.id
      if (!budgetId) {
        const result = await ensureBudget.mutateAsync({ month: selectedMonth, year: selectedYear })
        budgetId = result.id
      }
      await upsertItem.mutateAsync({
        budgetId: budgetId!,
        month: selectedMonth,
        year: selectedYear,
        categoryType: activeTab,
        categoryId,
        plannedAmount: getPlanned(categoryId),
      })
    } finally {
      setSavingId(null)
    }
  }

  // Copia tutti gli item del mese precedente nel mese corrente
  const handleCopyFromPrevMonth = async () => {
    const items = prevBudgetData?.monthly_budget_items
    if (!items?.length) return
    setCopying(true)
    try {
      let budgetId = budget?.id
      if (!budgetId) {
        const result = await ensureBudget.mutateAsync({ month: selectedMonth, year: selectedYear })
        budgetId = result.id
      }
      for (const item of items) {
        await upsertItem.mutateAsync({
          budgetId: budgetId!,
          month: selectedMonth,
          year: selectedYear,
          categoryType: item.category_type as TabType,
          categoryId: item.category_id,
          plannedAmount: Number(item.planned_amount),
        })
      }
      showToast('Budget copiato dal mese precedente', 'success')
    } catch {
      showToast('Errore durante la copia del budget', 'error')
    } finally {
      setCopying(false)
    }
  }

  const tabConfig: { key: TabType; label: string; color: string; activeColor: string }[] = [
    { key: 'expense', label: 'Spese', color: 'text-red-600', activeColor: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
    { key: 'income', label: 'Entrate', color: 'text-emerald-600', activeColor: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
    { key: 'saving', label: 'Risparmi', color: 'text-blue-600', activeColor: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  ]

  const activeTabConfig = tabConfig.find(t => t.key === activeTab)!

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Budget Mensile</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Pianifica entrate e uscite per {formatMonth(selectedMonth, selectedYear)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
            >
              {Array.from({ length: 4 }, (_, i) => currentDate.getFullYear() - 1 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={handleCopyFromPrevMonth}
              disabled={!prevBudgetData?.monthly_budget_items?.length || copying}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {copying ? 'Copia in corso...' : 'Copia da mese precedente'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {tabConfig.map((tab) => {
            const cats = tab.key === 'income' ? (incomeCategories || []) : tab.key === 'expense' ? (expenseCategories || []) : (savingCategories || [])
            const planned = cats.reduce((sum, cat) => sum + (parseFloat(editingValues[cat.id] || '0') || 0), 0)
            const actual = cats.reduce((sum, cat) => sum + (actuals?.[cat.id] || 0), 0)
            const pct = planned > 0 ? Math.min(Math.round((actual / planned) * 100), 100) : 0
            return (
              <div key={tab.key} className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">{tab.label}</p>
                <p className={`text-xl font-bold ${tab.color}`}>{fmt(actual)}</p>
                <p className="text-xs text-zinc-400 mt-0.5">di {fmt(planned)} pianificati</p>
                <div className="mt-3 h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      tab.key === 'income' ? 'bg-emerald-500' : tab.key === 'expense' ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-400 mt-1">{pct}%</p>
              </div>
            )
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {tabConfig.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                activeTab === tab.key
                  ? tab.activeColor
                  : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category Table */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <div className="min-w-[500px]">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-zinc-100 dark:border-zinc-700 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <div className="col-span-5">Categoria</div>
            <div className="col-span-3 text-right">Pianificato</div>
            <div className="col-span-2 text-right">Effettivo</div>
            <div className="col-span-2 text-right">Diff.</div>
          </div>

          {budgetLoading ? (
            <div className="p-8 text-center text-zinc-500">Caricamento...</div>
          ) : getCategories().length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              Nessuna categoria trovata. Inizializza le categorie dalle Impostazioni.
            </div>
          ) : (
            <div className="divide-y divide-zinc-50 dark:divide-zinc-700/50">
              {getCategories().map((cat) => {
                const planned = getPlanned(cat.id)
                const actual = getActual(cat.id)
                const diff = activeTab === 'income' ? actual - planned : planned - actual
                const isOver = activeTab === 'income' ? actual < planned : actual > planned

                return (
                  <div key={cat.id} className="grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                    <div className="col-span-5 flex items-center gap-3">
                      <span className="text-xl">{cat.icon || '📦'}</span>
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{cat.name}</span>
                    </div>
                    <div className="col-span-3 flex justify-end">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingValues[cat.id] || ''}
                          onChange={(e) => setEditingValues(prev => ({ ...prev, [cat.id]: e.target.value }))}
                          onBlur={() => handleSave(cat.id)}
                          className="w-24 text-right px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          placeholder="0"
                        />
                        {savingId === cat.id && (
                          <span className="text-xs text-zinc-400">...</span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`text-sm font-medium ${activeTabConfig.color}`}>
                        {fmt(actual)}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`text-sm font-semibold ${
                        planned === 0
                          ? 'text-zinc-400'
                          : isOver
                          ? 'text-red-500'
                          : 'text-emerald-600'
                      }`}>
                        {planned === 0 ? '—' : `${diff >= 0 ? '+' : ''}${fmt(diff)}`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Totals row */}
          {getCategories().length > 0 && (
            <div className="grid grid-cols-12 gap-2 px-6 py-4 border-t-2 border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700/30">
              <div className="col-span-5 text-sm font-bold text-zinc-700 dark:text-zinc-300">Totale</div>
              <div className="col-span-3 text-right text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {fmt(totalPlanned)}
              </div>
              <div className="col-span-2 text-right">
                <span className={`text-sm font-bold ${activeTabConfig.color}`}>
                  {fmt(totalActual)}
                </span>
              </div>
              <div className="col-span-2 text-right">
                {totalPlanned > 0 && (
                  <span className={`text-sm font-bold ${
                    (activeTab === 'income' ? totalActual < totalPlanned : totalActual > totalPlanned)
                      ? 'text-red-500'
                      : 'text-emerald-600'
                  }`}>
                    {(() => {
                      const d = activeTab === 'income' ? totalActual - totalPlanned : totalPlanned - totalActual
                      return `${d >= 0 ? '+' : ''}${fmt(d)}`
                    })()}
                  </span>
                )}
              </div>
            </div>
          )}
          </div>{/* min-w */}
          </div>{/* overflow-x-auto */}
        </div>

        <p className="text-xs text-zinc-400 text-center">
          I valori pianificati vengono salvati automaticamente quando esci dal campo
        </p>
      </div>
    </DashboardLayout>
  )
}
