'use client'

import { useCallback, useId, useSyncExternalStore, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { classNames } from '@/lib/utils'
import { Card } from './Card'

const STORAGE_PREFIX = 'smartbudget:section:'
const EVENT = 'smartbudget:section-toggle'

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key)
  } catch {
    return null
  }
}

interface SectionProps {
  /** Chiave per ricordare aperto/chiuso in questo browser */
  storageKey: string
  title: string
  Icon?: LucideIcon
  /** Riga di riepilogo sotto il titolo, utile soprattutto a sezione chiusa */
  summary?: ReactNode
  /** Pulsanti a destra dell'intestazione (fuori dal toggle) */
  actions?: ReactNode
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}

// Sezione richiudibile della dashboard. Lo stato aperto/chiuso è una
// preferenza del solo browser corrente (localStorage). Il server non la
// conosce e usa defaultOpen: useSyncExternalStore riallinea dopo l'idratazione.
export function Section({ storageKey, title, Icon, summary, actions, defaultOpen = true, className, children }: SectionProps) {
  const stored = useSyncExternalStore(subscribe, () => readStored(storageKey), () => null)
  const open = stored === '1' ? true : stored === '0' ? false : defaultOpen
  const bodyId = useId()

  const toggle = useCallback(() => {
    try { window.localStorage.setItem(STORAGE_PREFIX + storageKey, open ? '0' : '1') } catch { /* preferenza facoltativa */ }
    window.dispatchEvent(new Event(EVENT))
  }, [open, storageKey])

  return (
    <Card className={classNames('overflow-hidden', className)}>
      <div className="flex items-center gap-2 pr-3 sm:pr-4">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex-1 min-w-0 flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left"
        >
          {Icon && (
            <span className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0">
              <Icon size={16} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</span>
            {summary && <span className="block text-xs text-zinc-500 dark:text-zinc-400 truncate">{summary}</span>}
          </span>
          <ChevronDown
            size={18}
            className={classNames('shrink-0 text-zinc-400 transition-transform', open && 'rotate-180')}
          />
        </button>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div id={bodyId} hidden={!open} className="border-t border-zinc-100 dark:border-zinc-700">
        {children}
      </div>
    </Card>
  )
}
