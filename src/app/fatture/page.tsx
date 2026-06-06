'use client'

import { useState, useMemo } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useToast } from '@/components/Toast'
import {
  useInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useMarkAsPaid,
  useDeleteInvoice,
} from '@/hooks/useInvoices'
import { formatCurrency } from '@/lib/utils'
import type { Invoice, InvoiceStatus, InvoiceRecurrence } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; dot: string }> = {
  pending:   { label: 'In attesa',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',  dot: 'bg-amber-400' },
  paid:      { label: 'Pagata',     color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500' },
  overdue:   { label: 'Scaduta',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           dot: 'bg-red-500' },
  cancelled: { label: 'Annullata',  color: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400',          dot: 'bg-zinc-400' },
}

const RECURRENCE_LABELS: Record<InvoiceRecurrence, string> = {
  once:      'Una tantum',
  weekly:    'Settimanale',
  monthly:   'Mensile',
  quarterly: 'Trimestrale',
  yearly:    'Annuale',
}

const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const DAYS_IT   = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FatturePage() {
  const today = new Date()
  const { data: invoices = [], isLoading } = useInvoices()
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const markAsPaid    = useMarkAsPaid()
  const deleteInvoice = useDeleteInvoice()
  const { showToast } = useToast()

  const [activeTab,    setActiveTab]    = useState<'lista' | 'calendario'>('lista')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all')
  const [showForm,     setShowForm]     = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [calMonth,     setCalMonth]     = useState(today.getMonth())
  const [calYear,      setCalYear]      = useState(today.getFullYear())
  const [selectedDay,  setSelectedDay]  = useState<number | null>(null)

  // Form state
  const [fName,        setFName]        = useState('')
  const [fAmount,      setFAmount]      = useState('')
  const [fDueDate,     setFDueDate]     = useState(today.toISOString().split('T')[0])
  const [fRecurrence,  setFRecurrence]  = useState<InvoiceRecurrence>('once')
  const [fDescription, setFDescription] = useState('')
  const [fAutoRenew,   setFAutoRenew]   = useState(false)

  // ─── Derived data ──────────────────────────────────────────────────────────

  const filteredList = useMemo(() => {
    if (statusFilter === 'all') return invoices
    return invoices.filter(i => i.status === statusFilter)
  }, [invoices, statusFilter])

  const summary = useMemo(() => {
    const in30 = new Date(); in30.setDate(in30.getDate() + 30)
    const in30s = in30.toISOString().split('T')[0]
    const todayS = today.toISOString().split('T')[0]
    return {
      upcoming: invoices.filter(i => i.status === 'pending' && i.due_date <= in30s).reduce((s, i) => s + i.amount, 0),
      overdue:  invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0),
      paidMonth: invoices.filter(i => i.status === 'paid' && i.paid_date?.startsWith(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`)).reduce((s, i) => s + i.amount, 0),
      overdueCount: invoices.filter(i => i.status === 'overdue').length,
      upcomingCount: invoices.filter(i => i.status === 'pending' && i.due_date <= in30s).length,
      todayCount: invoices.filter(i => i.due_date === todayS && i.status !== 'paid' && i.status !== 'cancelled').length,
    }
  }, [invoices, today])

  // Invoices indexed by day-of-month for calendar
  const calInvoices = useMemo(() => {
    const byDay: Record<number, Invoice[]> = {}
    invoices.forEach(inv => {
      const d = new Date(inv.due_date + 'T00:00:00')
      if (d.getMonth() === calMonth && d.getFullYear() === calYear) {
        const day = d.getDate()
        if (!byDay[day]) byDay[day] = []
        byDay[day].push(inv)
      }
    })
    return byDay
  }, [invoices, calMonth, calYear])

  const selectedDayInvoices = selectedDay ? (calInvoices[selectedDay] ?? []) : []

  // ─── Handlers ──────────────────────────────────────────────────────────────

  // Apre il form in modalità modifica pre-popolando i campi
  const openEditForm = (inv: Invoice) => {
    setEditingInvoice(inv)
    setFName(inv.name)
    setFAmount(String(inv.amount))
    setFDueDate(inv.due_date)
    setFRecurrence(inv.recurrence ?? 'once')
    setFDescription(inv.description ?? '')
    setFAutoRenew(inv.auto_renew ?? false)
    setShowForm(true)
  }

  // Resetta il form e chiude il modal
  const closeForm = () => {
    setShowForm(false)
    setEditingInvoice(null)
    setFName(''); setFAmount(''); setFDescription('')
    setFDueDate(today.toISOString().split('T')[0])
    setFRecurrence('once'); setFAutoRenew(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingInvoice) {
        await updateInvoice.mutateAsync({
          id: editingInvoice.id,
          data: {
            name: fName,
            amount: parseFloat(fAmount),
            due_date: fDueDate,
            recurrence: fRecurrence,
            auto_renew: fAutoRenew,
          },
        })
        closeForm()
        showToast('Fattura modificata', 'success')
      } else {
        await createInvoice.mutateAsync({
          name: fName,
          amount: parseFloat(fAmount),
          due_date: fDueDate,
          recurrence: fRecurrence,
          description: fDescription || null,
          auto_renew: fAutoRenew,
          status: 'pending',
          paid_date: null,
          paid_amount: null,
          category_id: null,
          reminder_days: 3,
        })
        closeForm()
        showToast('Fattura aggiunta')
      }
    } catch {
      showToast('Errore nel salvataggio', 'error')
    }
  }

  const handleMarkPaid = async (id: string) => {
    try {
      await markAsPaid.mutateAsync({ id })
      showToast('Fattura segnata come pagata')
    } catch {
      showToast('Errore', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteInvoice.mutateAsync(id)
      showToast('Fattura eliminata', 'info')
    } catch {
      showToast('Errore', 'error')
    }
  }

  const prevCalMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextCalMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
    setSelectedDay(null)
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

  const fmt = (n: number) => formatCurrency(n)

  const StatusBadge = ({ status }: { status: InvoiceStatus }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[status].color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[status].dot}`} />
      {STATUS_CONFIG[status].label}
    </span>
  )

  // ─── Calendar grid ─────────────────────────────────────────────────────────

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1)
    // Monday-based: Monday=0 ... Sunday=6
    let startOffset = firstDay.getDay() - 1
    if (startOffset < 0) startOffset = 6
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    return { startOffset, daysInMonth }
  }, [calMonth, calYear])

  const todayS = today.toISOString().split('T')[0]

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Fatture & Abbonamenti</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Monitora scadenze e pagamenti ricorrenti</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            <span className="text-lg leading-none">+</span> Nuova fattura
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Prossimi 30 gg</span>
              <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                {summary.upcomingCount} voci
              </span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{fmt(summary.upcoming)}</p>
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Scadute</span>
              {summary.overdueCount > 0 && (
                <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                  {summary.overdueCount} da pagare
                </span>
              )}
            </div>
            <p className={`text-2xl font-bold ${summary.overdue > 0 ? 'text-red-600' : 'text-zinc-400 dark:text-zinc-500'}`}>
              {fmt(summary.overdue)}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Pagate questo mese</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{fmt(summary.paidMonth)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-fit">
          {(['lista', 'calendario'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {tab === 'lista' ? '📋 Lista' : '📅 Calendario'}
            </button>
          ))}
        </div>

        {/* ─── TAB: LISTA ─── */}
        {activeTab === 'lista' && (
          <div className="space-y-4">
            {/* Status filter */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'overdue', 'paid', 'cancelled'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                  }`}
                >
                  {s === 'all' ? 'Tutte' : STATUS_CONFIG[s as InvoiceStatus].label}
                  {s !== 'all' && (
                    <span className="ml-1.5 opacity-60">
                      {invoices.filter(i => i.status === s).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Invoice list */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
              {isLoading ? (
                <div className="p-8 text-center text-zinc-500">Caricamento...</div>
              ) : filteredList.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="text-3xl mb-3">🧾</div>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                    {statusFilter === 'all' ? 'Nessuna fattura. Aggiungine una!' : 'Nessuna fattura con questo stato.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-50 dark:divide-zinc-700/50">
                  {filteredList.map(inv => {
                    const dueDate = new Date(inv.due_date + 'T00:00:00')
                    const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000)
                    const isToday = inv.due_date === todayS

                    return (
                      <div key={inv.id} className={`p-4 flex items-start gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors ${inv.status === 'overdue' ? 'border-l-2 border-red-500' : isToday ? 'border-l-2 border-amber-400' : ''}`}>
                        {/* Left: icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                          inv.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/20' :
                          inv.status === 'overdue' ? 'bg-red-100 dark:bg-red-900/20' :
                          'bg-amber-100 dark:bg-amber-900/20'
                        }`}>
                          {inv.status === 'paid' ? '✅' : inv.status === 'overdue' ? '🔴' : isToday ? '⚠️' : '🧾'}
                        </div>

                        {/* Center: info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-semibold text-zinc-900 dark:text-white text-sm">{inv.name}</span>
                            <StatusBadge status={inv.status} />
                            {inv.recurrence && inv.recurrence !== 'once' && (
                              <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">
                                🔄 {RECURRENCE_LABELS[inv.recurrence]}
                              </span>
                            )}
                          </div>
                          {inv.description && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{inv.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                            <span>Scadenza: {dueDate.toLocaleDateString('it-IT')}</span>
                            {inv.status === 'pending' && (
                              <span className={daysUntil <= 3 ? 'text-red-500 font-medium' : daysUntil <= 7 ? 'text-amber-500' : ''}>
                                {isToday ? 'Scade oggi!' : daysUntil > 0 ? `tra ${daysUntil} gg` : ''}
                              </span>
                            )}
                            {inv.status === 'paid' && inv.paid_date && (
                              <span className="text-emerald-600">Pagata il {new Date(inv.paid_date + 'T00:00:00').toLocaleDateString('it-IT')}</span>
                            )}
                          </div>
                        </div>

                        {/* Right: amount + actions */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`font-bold text-base ${
                            inv.status === 'paid' ? 'text-emerald-600' :
                            inv.status === 'overdue' ? 'text-red-600' : 'text-zinc-800 dark:text-zinc-200'
                          }`}>
                            {fmt(inv.amount)}
                          </span>
                          <div className="flex items-center gap-1">
                            {(inv.status === 'pending' || inv.status === 'overdue') && (
                              <button
                                onClick={() => handleMarkPaid(inv.id)}
                                title="Segna come pagata"
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-sm"
                              >
                                ✓
                              </button>
                            )}
                            <button
                              onClick={() => openEditForm(inv)}
                              title="Modifica"
                              aria-label="Modifica fattura"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-xs"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(inv.id)}
                              title="Elimina"
                              aria-label="Elimina fattura"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: CALENDARIO ─── */}
        {activeTab === 'calendario' && (
          <div className="space-y-4">
            {/* Month navigation */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-700">
                <button onClick={prevCalMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">‹</button>
                <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {MONTHS_IT[calMonth]} {calYear}
                </h3>
                <button onClick={nextCalMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">›</button>
              </div>

              {/* Day headers + grid wrapped for xs overflow */}
              <div className="overflow-x-auto">
              <div className="min-w-[280px]">
              <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-700">
                {DAYS_IT.map(d => (
                  <div key={d} className="text-center text-[10px] sm:text-xs font-medium text-zinc-400 py-2 min-w-0 truncate">
                    <span className="sm:hidden">{d.charAt(0)}</span>
                    <span className="hidden sm:inline">{d}</span>
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7">
                {/* Empty cells before first day */}
                {Array.from({ length: calendarDays.startOffset }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[40px] sm:min-h-[60px] border-b border-r border-zinc-50 dark:border-zinc-700/50" />
                ))}

                {/* Day cells */}
                {Array.from({ length: calendarDays.daysInMonth }, (_, i) => i + 1).map(day => {
                  const dayInvoices = calInvoices[day] ?? []
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isToday = dateStr === todayS
                  const isSelected = selectedDay === day
                  const col = (calendarDays.startOffset + day - 1) % 7

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={`min-h-[40px] sm:min-h-[60px] min-w-0 overflow-hidden border-b border-r border-zinc-50 dark:border-zinc-700/50 p-1 sm:p-1.5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/30'
                      } ${col === 6 ? 'border-r-0' : ''}`}
                    >
                      <div className={`text-[10px] sm:text-xs font-medium w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full mb-1 ${
                        isToday ? 'bg-emerald-600 text-white' : 'text-zinc-700 dark:text-zinc-300'
                      }`}>
                        {day}
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {dayInvoices.slice(0, 3).map(inv => (
                          <div
                            key={inv.id}
                            title={`${inv.name} — ${fmt(inv.amount)}`}
                            className={`w-2 h-2 rounded-full ${STATUS_CONFIG[inv.status].dot}`}
                          />
                        ))}
                        {dayInvoices.length > 3 && (
                          <span className="text-[9px] text-zinc-400">+{dayInvoices.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              </div>{/* min-w */}
              </div>{/* overflow-x-auto */}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
              {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </div>
              ))}
            </div>

            {/* Selected day detail */}
            {selectedDay !== null && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-700">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    {selectedDay} {MONTHS_IT[calMonth]} {calYear}
                  </h3>
                </div>
                {selectedDayInvoices.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-6">Nessuna fattura in questa data</p>
                ) : (
                  <div className="divide-y divide-zinc-50 dark:divide-zinc-700/50">
                    {selectedDayInvoices.map(inv => (
                      <div key={inv.id} className="px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <StatusBadge status={inv.status} />
                          <span className="text-sm text-zinc-800 dark:text-zinc-200">{inv.name}</span>
                          {inv.recurrence && inv.recurrence !== 'once' && (
                            <span className="text-xs text-zinc-400">🔄 {RECURRENCE_LABELS[inv.recurrence]}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">{fmt(inv.amount)}</span>
                          {(inv.status === 'pending' || inv.status === 'overdue') && (
                            <button
                              onClick={() => handleMarkPaid(inv.id)}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                              Paga
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── MODAL: NUOVA FATTURA ─── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{editingInvoice ? 'Modifica fattura' : 'Nuova fattura'}</h2>
              <button onClick={closeForm} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Nome *</label>
                <input
                  type="text"
                  value={fName}
                  onChange={e => setFName(e.target.value)}
                  required
                  placeholder="es. Netflix, Affitto, Mutuo..."
                  className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Importo (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={fAmount}
                    onChange={e => setFAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Scadenza *</label>
                  <input
                    type="date"
                    value={fDueDate}
                    onChange={e => setFDueDate(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Ricorrenza</label>
                <select
                  value={fRecurrence}
                  onChange={e => setFRecurrence(e.target.value as InvoiceRecurrence)}
                  className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                >
                  {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Note (opzionale)</label>
                <input
                  type="text"
                  value={fDescription}
                  onChange={e => setFDescription(e.target.value)}
                  placeholder="Descrizione o note aggiuntive"
                  className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-10 h-5 rounded-full transition-colors ${fAutoRenew ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${fAutoRenew ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span
                  className="text-sm text-zinc-700 dark:text-zinc-300"
                  onClick={() => setFAutoRenew(v => !v)}
                >
                  Rinnovo automatico
                </span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={createInvoice.isPending || updateInvoice.isPending}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium transition-colors"
                >
                  {(createInvoice.isPending || updateInvoice.isPending) ? 'Salvataggio...' : editingInvoice ? 'Aggiorna' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
