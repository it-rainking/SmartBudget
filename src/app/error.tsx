'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-8 shadow-sm border border-red-200 dark:border-red-900/40 max-w-md w-full text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Qualcosa è andato storto</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          {error.message || 'Errore imprevisto. Riprova tra qualche momento.'}
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Riprova
        </button>
      </div>
    </div>
  )
}
