'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSelectedMonth } from '@/hooks/useSelectedMonth'
import { classNames } from '@/lib/utils'

const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

interface MonthSwitcherProps {
  /** Mesi futuri selezionabili (transazioni sì, per le rate programmate; dashboard no) */
  allowFuture?: boolean
  /** Callback dopo ogni cambio di mese (es. tornare a pagina 1 della lista) */
  onChange?: () => void
  className?: string
}

// "‹ Ottobre 2026 ›": frecce per il mese prima/dopo, tocco sull'etichetta
// per un selettore a griglia (anno + 12 mesi). Lo stato vive nell'URL
// (useSelectedMonth), quindi header mobile e pagina restano allineati.
export function MonthSwitcher({ allowFuture = false, onChange, className }: MonthSwitcherProps) {
  const { month, year, isCurrentMonth, setMonthYear, goToPrevMonth, goToNextMonth } = useSelectedMonth()
  const [open, setOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(year)
  const rootRef = useRef<HTMLDivElement>(null)

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const isFuture = (m: number, y: number) => y > currentYear || (y === currentYear && m > currentMonth)

  useEffect(() => {
    if (!open) return
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const select = (m: number, y: number) => {
    setMonthYear(m, y)
    setOpen(false)
    onChange?.()
  }

  const nextDisabled = !allowFuture && isCurrentMonth

  return (
    <div ref={rootRef} className={classNames('relative flex items-center gap-0.5', className)}>
      <button
        type="button"
        onClick={() => { goToPrevMonth(); onChange?.() }}
        aria-label="Mese precedente"
        className="p-2 rounded-lg text-zinc-500 hover:text-emerald-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-colors"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        onClick={() => { setPickerYear(year); setOpen((o) => !o) }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="min-w-[8.5rem] px-2 py-1.5 rounded-lg text-sm font-semibold text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
      >
        {MONTHS[month - 1]} {year}
      </button>
      <button
        type="button"
        onClick={() => { goToNextMonth(); onChange?.() }}
        disabled={nextDisabled}
        aria-label="Mese successivo"
        className="p-2 rounded-lg text-zinc-500 hover:text-emerald-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={18} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Scegli il mese"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-64 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setPickerYear((y) => y - 1)} aria-label="Anno precedente" className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">{pickerYear}</span>
            <button
              type="button"
              onClick={() => setPickerYear((y) => y + 1)}
              disabled={!allowFuture && pickerYear >= currentYear}
              aria-label="Anno successivo"
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MONTHS_SHORT.map((label, i) => {
              const m = i + 1
              const selected = m === month && pickerYear === year
              const disabled = !allowFuture && isFuture(m, pickerYear)
              return (
                <button
                  key={label}
                  type="button"
                  disabled={disabled}
                  onClick={() => select(m, pickerYear)}
                  aria-pressed={selected}
                  className={classNames(
                    'py-2 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
                    selected
                      ? 'bg-emerald-500 text-white font-semibold'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700',
                    m === currentMonth && pickerYear === currentYear && !selected && 'ring-1 ring-emerald-500',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
