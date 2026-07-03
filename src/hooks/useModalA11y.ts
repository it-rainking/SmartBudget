'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Shared modal/dialog accessibility behavior: traps Tab focus inside the
// dialog, closes on Escape, focuses the first focusable element on open,
// and restores focus to the trigger element on close.
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const container = containerRef.current
    const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    focusable?.[0]?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && container) {
        const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      previouslyFocused?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  return containerRef
}
