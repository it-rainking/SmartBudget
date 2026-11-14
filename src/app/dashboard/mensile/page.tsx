'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Zap } from 'lucide-react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { MonthSwitcher } from '@/components/MonthSwitcher'
import { Card, EmptyState, KpiTile } from '@/components/ui'
import { BalanceHero } from '@/components/dashboard/BalanceHero'
import { CategoryBreakdownSection, type CategoryTotal } from '@/components/dashboard/CategoryBreakdownSection'
import { IncomeSplitSection } from '@/components/dashboard/IncomeSplitSection'
import { AiInsightsSection } from '@/components/dashboard/AiInsightsSection'
import { InstallmentPlansSummary } from '@/components/dashboard/InstallmentPlansSummary'
import { RecurringExpensesBox } from '@/components/dashboard/RecurringExpensesBox'
import { SpendingPlanSection } from '@/components/dashboard/SpendingPlanSection'
import { useMonthlyKPIs } from '@/hooks/useTransactions'
import { useInstallmentPlans } from '@/hooks/useInstallments'
import { useRecurringExpenses } from '@/hooks/useRecurringExpenses'
import { useExpenseCategories } from '@/hooks/useCategories'
import { useSettings } from '@/hooks/useSettings'
import { useSelectedMonth } from '@/hooks/useSelectedMonth'
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe'
import { formatCurrency, formatMonth, getLocalDateString, getMonthDateRange } from '@/lib/utils'
import { computeSpendingPlan, type SpendingGroup } from '@/lib/kakebo'
import type { ExpenseCategory } from '@/types'
import dynamic from 'next/dynamic'

// Aperto solo al tocco su una categoria
const CategoryExpensesModal = dynamic(() => import('@/components/dashboard/CategoryExpensesModal').then((m) => m.CategoryExpensesModal), { ssr: false })

// Gerarchia della pagina, dal più consultato al meno:
// 1. saldo disponibile con l'andamento del mese (BalanceHero)
// 2. entrate / spese / risparmi
// 3. indicatori secondari in una griglia compatta
// 4. sezioni richiudibili (portamonete, categorie, confronto, rate, ricorrenti, AI)
export default function DashboardMensilePage() {
  // Mese condiviso con /transazioni tramite l'URL (?m=YYYY-MM)
  const { month: selectedMonth, year: selectedYear, isCurrentMonth, goToPrevMonth, goToNextMonth } = useSelectedMonth()
  const swipeHandlers = useHorizontalSwipe(goToPrevMonth, () => { if (!isCurrentMonth) goToNextMonth() })

  const { data: kpis, isLoading } = useMonthlyKPIs(selectedMonth, selectedYear)
  const { data: expenseCategories } = useExpenseCategories()
  const { data: settings } = useSettings()
  const { data: installmentPlans } = useInstallmentPlans(selectedMonth, selectedYear)
  const { data: recurringModels } = useRecurringExpenses()

  const currency = settings?.currency || 'EUR'
  const fmt = (n: number) => formatCurrency(n, currency)
  // Nei 3 riquadri affiancati su mobile i centesimi non ci stanno: importo
  // arrotondato all'euro sotto sm, completo da sm in su
  const fmtTile = (n: number) => (
    <>
      <span className="sm:hidden">{new Intl.NumberFormat('it-IT', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)}</span>
      <span className="hidden sm:inline">{fmt(n)}</span>
    </>
  )

  // Categoria selezionata per il dettaglio delle singole spese (modal)
  const [detailCategory, setDetailCategory] = useState<ExpenseCategory | null>(null)

  // Spese per categoria, dalla più alta
  const categoryBreakdown = useMemo<CategoryTotal[]>(() => {
    if (!expenseCategories || !kpis?.categoryBreakdown) return []
    return expenseCategories
      .filter((cat) => (kpis.categoryBreakdown[cat.id] || 0) > 0)
      .map((cat) => ({ ...cat, total: kpis.categoryBreakdown[cat.id] || 0 }))
      .sort((a, b) => b.total - a.total)
  }, [expenseCategories, kpis])

  const topCategory = categoryBreakdown[0] ?? null

  // Finché il mese non ha entrate registrate, si mostra la stima storica
  // (in giallo) al posto dello zero reale; appena arriva un'entrata vera,
  // subentra il valore reale (in verde).
  const isIncomeEstimated = !!kpis?.isIncomeEstimated
  const displayIncome = isIncomeEstimated ? (kpis?.projectedIncome ?? 0) : (kpis?.totalIncome ?? 0)

  // Portamonete Kakebo. Entrate: le stesse del saldo netto (stima storica
  // finché lo stipendio non è registrato, eccezionali inclusi).
  const planIncome = isIncomeEstimated
    ? (kpis?.projectedIncome ?? 0) + (kpis?.exceptionalIncome ?? 0)
    : (kpis?.totalIncome ?? 0)
  const spendingPlan = useMemo(() => {
    if (!kpis) return null
    const groupByCategory: Record<string, SpendingGroup | null> = {}
    expenseCategories?.forEach((c) => { groupByCategory[c.id] = c.spending_group ?? null })
    // Modelli ricorrenti attivi già iniziati che nel mese non hanno ancora
    // un'occorrenza: uscite fisse attese, non ancora registrate
    const { endDate } = getMonthDateRange(selectedMonth, selectedYear)
    const generated = new Set(kpis.expenseRows.map((t) => t.recurring_expense_id).filter(Boolean))
    const plannedFixed = (recurringModels ?? [])
      .filter((r) => r.is_active && r.start_date <= endDate && !generated.has(r.id))
      .map((r) => ({ amount: Number(r.amount) }))
    return computeSpendingPlan({
      month: selectedMonth,
      year: selectedYear,
      income: planIncome,
      savings: kpis.totalSavings,
      debts: kpis.totalDebts,
      expenses: kpis.expenseRows,
      groupByCategory,
      plannedFixed,
      today: getLocalDateString(),
    })
  }, [kpis, expenseCategories, recurringModels, selectedMonth, selectedYear, planIncome])

  const hasData = displayIncome > 0 || (kpis?.totalExpenses ?? 0) > 0 || (kpis?.totalSavings ?? 0) > 0

  // Curva del saldo: nel mese corrente si ferma a oggi, altrimenti una linea
  // piatta fino a fine mese sembrerebbe una previsione.
  const dailyBalances = kpis?.dailyBalances ?? []
  const balanceValues = isCurrentMonth
    ? dailyBalances.slice(0, Math.min(new Date().getDate(), dailyBalances.length))
    : dailyBalances

  const exceptionalIncome = kpis?.exceptionalIncome ?? 0
  const exceptionalExpenses = kpis?.exceptionalExpenses ?? 0
  const hasExceptional = exceptionalIncome > 0 || exceptionalExpenses > 0
  const delta = kpis?.deltaExpensePercent

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6" {...swipeHandlers}>
        {/* Header: su mobile il mese è nell'header dell'app */}
        <h1 className="sr-only">Dashboard di {formatMonth(selectedMonth, selectedYear)}</h1>
        <div className="hidden lg:flex items-center justify-between gap-4">
          <p aria-hidden="true" className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</p>
          <MonthSwitcher />
        </div>

        {/* 1-2. Saldo disponibile + entrate / spese / risparmi */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          <BalanceHero
            className="lg:col-span-2"
            loading={isLoading}
            openingBalance={kpis?.openingBalance ?? 0}
            closingBalance={kpis?.closingBalance ?? 0}
            balanceValues={balanceValues}
            isCurrentMonth={isCurrentMonth}
            currency={currency}
          />
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 sm:gap-4">
            <KpiTile
              label={isIncomeEstimated ? 'Entrate (stima)' : 'Entrate'}
              value={fmtTile(displayIncome)}
              tone={isIncomeEstimated ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}
              loading={isLoading}
              title={isIncomeEstimated ? 'Stima basata sulla media storica, in attesa di nuove entrate' : undefined}
              hint={isIncomeEstimated ? <span className="text-amber-600 dark:text-amber-400">media storica</span> : undefined}
            />
            <KpiTile
              label="Spese"
              value={fmtTile(kpis?.totalExpenses ?? 0)}
              tone="text-red-600 dark:text-red-400"
              loading={isLoading}
              title="La variazione confronta le spese ordinarie con il mese precedente (movimenti eccezionali esclusi)"
              hint={delta !== null && delta !== undefined ? (
                <span className={delta > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
                  {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}%
                  <span className="hidden sm:inline font-normal text-zinc-500 dark:text-zinc-400"> vs mese prec. ({fmt(kpis?.prevMonthExpenses ?? 0)})</span>
                </span>
              ) : undefined}
            />
            <KpiTile
              label="Risparmi"
              value={fmtTile(kpis?.totalSavings ?? 0)}
              tone="text-blue-600 dark:text-blue-400"
              loading={isLoading}
              hint={(kpis?.savingsPercent ?? 0) > 0 ? <>{kpis?.savingsPercent}%<span className="hidden sm:inline"> delle entrate</span></> : undefined}
            />
          </div>
        </div>

        {/* Movimenti eccezionali: una nota sola invece di una per card */}
        {!isLoading && hasExceptional && (
          <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
            <Zap size={14} className="shrink-0 mt-px" />
            <span>
              Movimenti eccezionali nel mese:
              {exceptionalIncome > 0 && <> entrate {fmt(exceptionalIncome)}</>}
              {exceptionalIncome > 0 && exceptionalExpenses > 0 && ','}
              {exceptionalExpenses > 0 && <> spese {fmt(exceptionalExpenses)}</>}.
              {' '}Contano nei totali, non in medie e confronti. A condizioni normali il saldo netto sarebbe {fmt(kpis?.ordinaryBalance ?? 0)}.
            </span>
          </p>
        )}

        {/* 3. Indicatori secondari */}
        {!isLoading && hasData && (
          <Card className="grid grid-cols-2 lg:grid-cols-4 divide-zinc-100 dark:divide-zinc-700 [&>*]:border-zinc-100 dark:[&>*]:border-zinc-700 [&>*:nth-child(odd)]:border-r lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0 [&>*:nth-child(-n+2)]:border-b lg:[&>*]:border-b-0">
            <SecondaryStat
              label="Saldo netto"
              value={fmt(kpis?.balance ?? 0)}
              tone={(kpis?.balance ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}
              hint={isIncomeEstimated ? 'su entrate stimate' : 'entrate − uscite del mese'}
            />
            <SecondaryStat
              label="Media giornaliera"
              value={fmt(kpis?.dailyAverage ?? 0)}
              hint={exceptionalExpenses > 0 ? 'eccezionali esclusi' : 'spese al giorno'}
            />
            <SecondaryStat
              label="Tasso di risparmio"
              value={`${kpis?.savingsPercent ?? 0}%`}
              hint="sulle entrate"
            />
            <SecondaryStat
              label="Categoria top"
              value={topCategory ? `${topCategory.icon ? `${topCategory.icon} ` : ''}${topCategory.name}` : '—'}
              hint={topCategory ? fmt(topCategory.total) : undefined}
            />
          </Card>
        )}

        {/* 4. Sezioni richiudibili */}
        {!isLoading && hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 items-start">
            {spendingPlan && (
              <SpendingPlanSection
                className="lg:col-span-2"
                plan={spendingPlan}
                month={selectedMonth}
                income={planIncome}
                isIncomeEstimated={isIncomeEstimated}
                savings={kpis?.totalSavings ?? 0}
                debts={kpis?.totalDebts ?? 0}
                isCurrentMonth={isCurrentMonth}
                currency={currency}
              />
            )}
            <CategoryBreakdownSection
              className="lg:col-span-2"
              categories={categoryBreakdown}
              totalExpenses={kpis?.totalExpenses ?? 0}
              exceptionalByCategory={kpis?.exceptionalByCategory ?? {}}
              currency={currency}
              onSelect={setDetailCategory}
            />
            <IncomeSplitSection
              income={displayIncome}
              isIncomeEstimated={isIncomeEstimated}
              totalIncome={kpis?.totalIncome ?? 0}
              totalExpenses={kpis?.totalExpenses ?? 0}
              totalSavings={kpis?.totalSavings ?? 0}
              expensePercent={kpis?.expensePercent ?? 0}
              savingsPercent={kpis?.savingsPercent ?? 0}
              currency={currency}
            />
            {kpis && (
              <AiInsightsSection
                month={selectedMonth}
                year={selectedYear}
                kpis={kpis}
                expenseCategories={expenseCategories}
                currency={currency}
              />
            )}
          </div>
        )}

        {!isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 items-start">
            {(installmentPlans?.length ?? 0) > 0 && (
              <InstallmentPlansSummary plans={installmentPlans!} currency={currency} />
            )}
            <RecurringExpensesBox
              month={selectedMonth}
              year={selectedYear}
              currency={currency}
              className={(installmentPlans?.length ?? 0) > 0 ? '' : 'lg:col-span-2'}
            />
          </div>
        )}

        {/* Mese senza movimenti */}
        {!isLoading && !hasData && (
          <Card>
            <EmptyState
              Icon={BarChart3}
              title="Nessun movimento in questo mese"
              description="Registra entrate e spese con il pulsante + (o il tasto N) per vedere statistiche e grafici."
            />
          </Card>
        )}
      </div>

      {detailCategory && (
        <CategoryExpensesModal
          category={detailCategory}
          month={selectedMonth}
          year={selectedYear}
          currency={currency}
          totalForCategory={kpis?.categoryBreakdown[detailCategory.id] ?? 0}
          onClose={() => setDetailCategory(null)}
        />
      )}
    </DashboardLayout>
  )
}

function SecondaryStat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="px-4 py-3 min-w-0">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`text-base sm:text-lg font-semibold truncate ${tone ?? 'text-zinc-900 dark:text-white'}`}>{value}</p>
      {hint && <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{hint}</p>}
    </div>
  )
}
