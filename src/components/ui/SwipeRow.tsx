'use client'

import { useRef, useState, type ReactNode } from 'react'

const ACTION_WIDTH = 72

export interface SwipeAction {
  label: string
  icon?: ReactNode
  className: string
  onClick: () => void
}

interface SwipeRowProps {
  actions: SwipeAction[]
  /** Riga aperta (azioni visibili): controllata dal genitore, una alla volta */
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  className?: string
}

// Riga con azioni nascoste a destra, scoperte con uno swipe verso sinistra
// (solo touch). Il gesto parte orizzontale solo se il dito si muove più in
// orizzontale che in verticale: lo scroll della lista resta del browser
// (touch-action: pan-y). Su desktop le azioni vanno mostrate a parte.
export function SwipeRow({ actions, open, onOpenChange, children, className }: SwipeRowProps) {
  const maxShift = actions.length * ACTION_WIDTH
  const start = useRef<{ x: number; y: number; base: number } | null>(null)
  const mode = useRef<'idle' | 'horizontal' | 'vertical'>('idle')
  const [dragX, setDragX] = useState<number | null>(null)

  const offset = dragX ?? (open ? -maxShift : 0)

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      {/* Nascoste a riga chiusa: altrimenti il colore traspare dagli angoli arrotondati */}
      <div className="absolute inset-y-0 right-0 flex" aria-hidden={!open} style={{ visibility: offset === 0 ? 'hidden' : 'visible' }}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={() => { onOpenChange(false); a.onClick() }}
            style={{ width: ACTION_WIDTH }}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-semibold text-white ${a.className}`}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
      <div
        className="relative bg-white dark:bg-zinc-800 touch-pan-y"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragX === null ? 'transform 180ms ease-out' : 'none',
        }}
        onTouchStart={(e) => {
          const t = e.touches[0]
          start.current = { x: t.clientX, y: t.clientY, base: open ? -maxShift : 0 }
          mode.current = 'idle'
        }}
        onTouchMove={(e) => {
          if (!start.current) return
          const t = e.touches[0]
          const dx = t.clientX - start.current.x
          const dy = t.clientY - start.current.y
          if (mode.current === 'idle') {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
            mode.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
          }
          if (mode.current !== 'horizontal') return
          setDragX(Math.min(0, Math.max(-maxShift - 24, start.current.base + dx)))
        }}
        onTouchEnd={() => {
          if (mode.current === 'horizontal' && dragX !== null) {
            onOpenChange(dragX < -maxShift / 2)
          }
          start.current = null
          mode.current = 'idle'
          setDragX(null)
        }}
        onClickCapture={(e) => {
          // Con la riga aperta, un tocco la richiude invece di attivarla
          if (open) {
            e.stopPropagation()
            e.preventDefault()
            onOpenChange(false)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
