'use client'

import { useAuth } from '@/hooks/useAuth'

export default function DashboardMensilePage() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-xl text-white">
              💰
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">SmartBudget</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {user?.email}
            </span>
            <button
              onClick={signOut}
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              Esci
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard Mensile</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Benvenuto, {user?.user_metadata?.full_name || 'Utente'}!
          </p>
        </div>

        {/* Placeholder Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Entrate</div>
            <div className="text-2xl font-bold text-emerald-600">€ 0,00</div>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Spese</div>
            <div className="text-2xl font-bold text-red-600">€ 0,00</div>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Risparmi</div>
            <div className="text-2xl font-bold text-blue-600">€ 0,00</div>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Saldo</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">€ 0,00</div>
          </div>
        </div>

        {/* Placeholder for charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm h-80 flex items-center justify-center">
            <p className="text-zinc-400">Grafico Entrate/Spese (coming soon)</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm h-80 flex items-center justify-center">
            <p className="text-zinc-400">Grafico Categorie (coming soon)</p>
          </div>
        </div>
      </main>
    </div>
  )
}
