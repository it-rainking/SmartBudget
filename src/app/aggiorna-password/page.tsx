'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AggiornaPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Le password non coincidono')
      return
    }

    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setError(error.message)
        return
      }

      await supabase.auth.signOut()
      router.push('/login?reset=success')
      router.refresh()
    } catch {
      setError('Si è verificato un errore. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-zinc-900 dark:to-zinc-800 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-3xl text-white shadow-lg mx-auto mb-4">
              🔒
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Imposta una nuova password
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-2">
              Scegli la nuova password per il tuo account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Nuova password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                placeholder="Minimo 8 caratteri"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Conferma nuova password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                placeholder="Ripeti la password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Aggiornamento in corso...' : 'Aggiorna password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
