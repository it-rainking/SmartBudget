'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Mese selezionato condiviso tra dashboard mensile e transazioni, salvato
// nell'URL come `?m=YYYY-MM`. Così passando da una pagina all'altra il mese
// resta quello scelto, il link si può salvare e il tasto indietro funziona.
//
// Niente useSearchParams: in Next 16 richiederebbe un <Suspense> sopra ogni
// pagina. Si legge direttamente window.location e si scrive con
// history.replaceState, che Next intercetta e tiene allineato al router.

const PARAM = 'm'
const EVENT = 'smartbudget:month-change'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(EVENT, onChange)
  }
}

function getSnapshot() {
  return new URLSearchParams(window.location.search).get(PARAM)
}

function getServerSnapshot() {
  return null
}

export function parseMonthParam(value: string | null): { month: number; year: number } | null {
  const match = value?.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return { month, year }
}

export function formatMonthParam(month: number, year: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Aggiunge `?m=` all'href se l'URL corrente ne ha uno (per i link di navigazione). */
export function withMonthParam(href: string, param: string | null) {
  return param && parseMonthParam(param) ? `${href}?${PARAM}=${param}` : href
}

export function useMonthParam() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useSelectedMonth() {
  const param = useMonthParam()
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const parsed = parseMonthParam(param)
  const month = parsed?.month ?? currentMonth
  const year = parsed?.year ?? currentYear

  const setMonthYear = useCallback((m: number, y: number) => {
    const url = new URL(window.location.href)
    // Il mese corrente è il default: niente parametro, URL più pulito
    if (m === new Date().getMonth() + 1 && y === new Date().getFullYear()) {
      url.searchParams.delete(PARAM)
    } else {
      url.searchParams.set(PARAM, formatMonthParam(m, y))
    }
    window.history.replaceState(window.history.state, '', url)
    window.dispatchEvent(new Event(EVENT))
  }, [])

  const shift = useCallback((delta: number) => {
    const d = new Date(year, month - 1 + delta, 1)
    setMonthYear(d.getMonth() + 1, d.getFullYear())
  }, [month, year, setMonthYear])

  const goToPrevMonth = useCallback(() => shift(-1), [shift])
  const goToNextMonth = useCallback(() => shift(1), [shift])

  return {
    month,
    year,
    isCurrentMonth: month === currentMonth && year === currentYear,
    setMonthYear,
    goToPrevMonth,
    goToNextMonth,
  }
}
