'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { ToastProvider } from '@/components/Toast'
import { NotificationBell } from '@/components/NotificationBell'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard/mensile', icon: '📊' },
  { name: 'Annuale', href: '/dashboard/annuale', icon: '📈' },
  { name: 'Transazioni', href: '/transazioni', icon: '💳' },
  { name: 'Budget', href: '/budget', icon: '📅' },
  { name: 'Fatture', href: '/fatture', icon: '🧾' },
  { name: 'Obiettivi', href: '/obiettivi', icon: '🎯' },
  { name: 'Debiti', href: '/debiti', icon: '📉' },
  { name: 'Impostazioni', href: '/settings', icon: '⚙️' },
  { name: 'Istruzioni', href: '/istruzioni', icon: '📖' },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-zinc-800 border-r border-zinc-200 dark:border-zinc-700 hidden lg:block">
        <div className="flex h-16 items-center gap-3 px-6 border-b border-zinc-200 dark:border-zinc-700">
          <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-xl text-white">
            💰
          </div>
          <span className="text-xl font-bold text-zinc-900 dark:text-white">SmartBudget</span>
        </div>

        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-sm font-medium">
              {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                {user?.user_metadata?.full_name || 'Utente'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {user?.email}
              </p>
            </div>
            <NotificationBell />
            <button
              onClick={signOut}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              title="Esci"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-xl text-white">
              💰
            </div>
            <span className="text-xl font-bold text-zinc-900 dark:text-white">SmartBudget</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={signOut}
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              Esci
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex overflow-x-auto px-4 py-2 gap-2 border-t border-zinc-100 dark:border-zinc-700">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <span>{item.icon}</span>
                {item.name}
              </Link>
            )
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="lg:pl-64 pt-32 lg:pt-0">
        <div className="p-6 lg:p-8">
          <ToastProvider>
            {children}
          </ToastProvider>
        </div>
      </main>
    </div>
  )
}
