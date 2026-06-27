'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle, XCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type]
          return (
            <div
              key={toast.id}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-white shadow-lg whitespace-nowrap transition-opacity ${
                toast.type === 'error'
                  ? 'bg-red-600'
                  : toast.type === 'info'
                  ? 'bg-zinc-700'
                  : 'bg-emerald-600'
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {toast.message}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
