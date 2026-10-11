'use client'

import { useRef } from 'react'

const MIN_DISTANCE = 70

// Swipe orizzontale su un contenitore (solo touch): a sinistra = avanti,
// a destra = indietro. Scatta solo per gesti chiaramente orizzontali, così
// lo scroll verticale della pagina non lo attiva per sbaglio. Gli elementi
// con data-no-swipe (es. grafici, righe con azioni) ne sono esclusi.
export function useHorizontalSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)

  return {
    onTouchStart: (e: React.TouchEvent) => {
      if ((e.target as HTMLElement).closest('[data-no-swipe]')) {
        start.current = null
        return
      }
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.current.x
      const dy = t.clientY - start.current.y
      start.current = null
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 2) return
      if (dx < 0) onNext()
      else onPrev()
    },
  }
}
