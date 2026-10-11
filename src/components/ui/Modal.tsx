'use client'

import type { ReactNode } from 'react'
import { useModalA11y } from '@/hooks/useModalA11y'
import { classNames } from '@/lib/utils'

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  '2xl': 'sm:max-w-2xl',
} as const

interface ModalProps {
  open: boolean
  onClose: () => void
  /** id dell'elemento che fa da titolo (aria-labelledby) */
  labelledBy?: string
  /** Etichetta accessibile quando la modale non ha un titolo visibile */
  label?: string
  size?: keyof typeof SIZES
  /**
   * Chiusura toccando lo sfondo. Spento nei form lunghi: un tocco fuori per
   * sbaglio non deve buttare via quello che l'utente ha già scritto.
   */
  dismissOnBackdrop?: boolean
  /** Classi aggiuntive del pannello (layout interno: padding, flex, scroll) */
  className?: string
  children: ReactNode
}

// Unica modale dell'app. Su mobile è un bottom sheet ancorato in basso (a
// portata di pollice, con la maniglia), da `sm` in su una finestra centrata.
// Esc, focus trap, blocco dello scroll e ripristino del focus arrivano da
// useModalA11y.
export function Modal({
  open,
  onClose,
  labelledBy,
  label,
  size = 'md',
  dismissOnBackdrop = true,
  className,
  children,
}: ModalProps) {
  const panelRef = useModalA11y<HTMLDivElement>(open, onClose)
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      onMouseDown={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={classNames(
          'relative w-full bg-white dark:bg-zinc-800 shadow-xl',
          'rounded-t-2xl sm:rounded-2xl max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto',
          'pb-[env(safe-area-inset-bottom)] sm:pb-0',
          SIZES[size],
          className,
        )}
      >
        <div aria-hidden="true" className="sm:hidden mx-auto mt-2 mb-1 h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        {children}
      </div>
    </div>
  )
}
