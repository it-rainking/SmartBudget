'use client'

import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '@/hooks/useNotifications'

const TYPE_BG = {
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50',
  info:    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50',
  success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50',
}
const TYPE_TITLE = {
  warning: 'text-amber-800 dark:text-amber-300',
  info:    'text-blue-800 dark:text-blue-300',
  success: 'text-emerald-800 dark:text-emerald-300',
}
const TYPE_BODY = {
  warning: 'text-amber-600 dark:text-amber-400',
  info:    'text-blue-600 dark:text-blue-400',
  success: 'text-emerald-600 dark:text-emerald-400',
}

export function NotificationBell() {
  const notifications = useNotifications()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  const visible = notifications.filter(n => !dismissed.has(n.id))
  const count = visible.length

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function dismiss(id: string) {
    setDismissed(prev => new Set([...prev, id]))
  }

  function dismissAll() {
    setDismissed(new Set(notifications.map(n => n.id)))
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
        title="Notifiche"
      >
        <span className="text-xl">🔔</span>
        {count > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-700">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Notifiche {count > 0 ? `(${count})` : ''}
            </span>
            {count > 0 && (
              <button onClick={dismissAll} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                Segna tutte come lette
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Nessuna notifica</p>
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {visible.map(n => (
                  <div key={n.id} className={`flex items-start gap-3 p-3 rounded-lg border ${TYPE_BG[n.type]}`}>
                    <span className="text-lg flex-shrink-0 mt-0.5">{n.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${TYPE_TITLE[n.type]}`}>{n.title}</p>
                      <p className={`text-xs mt-0.5 truncate ${TYPE_BODY[n.type]}`}>{n.body}</p>
                    </div>
                    <button
                      onClick={() => dismiss(n.id)}
                      className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 text-xs flex-shrink-0 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
