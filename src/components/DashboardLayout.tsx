'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { ToastProvider } from '@/components/Toast'
import { NotificationBell } from '@/components/NotificationBell'
import {
  LayoutDashboard, TrendingUp, CreditCard, PieChart,
  Receipt, Target, TrendingDown, Settings, BookOpen,
  Wallet, LogOut,
} from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard/mensile', Icon: LayoutDashboard },
  { name: 'Annuale', href: '/dashboard/annuale', Icon: TrendingUp },
  { name: 'Transazioni', href: '/transazioni', Icon: CreditCard },
  { name: 'Budget', href: '/budget', Icon: PieChart },
  { name: 'Fatture', href: '/fatture', Icon: Receipt },
  { name: 'Obiettivi', href: '/obiettivi', Icon: Target },
  { name: 'Debiti', href: '/debiti', Icon: TrendingDown },
  { name: 'Impostazioni', href: '/settings', Icon: Settings },
  { name: 'Istruzioni', href: '/istruzioni', Icon: BookOpen },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-60 bg-white dark:bg-zinc-800 border-r border-zinc-200 dark:border-zinc-700 hidden lg:flex flex-col">
        <div className="flex h-16 items-center gap-3 px-5 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
            <Wallet size={18} />
          </div>
          <span className="text-lg font-bold text-zinc-900 dark:text-white">SmartBudget</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700/60'
                }`}
              >
                <item.Icon size={17} className="shrink-0" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-sm font-semibold shrink-0">
              {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                {user?.user_metadata?.full_name || 'Utente'}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {user?.email}
              </p>
            </div>
            <NotificationBell />
            <button
              onClick={signOut}
              aria-label="Esci dall'account"
              className="p-2.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              title="Esci"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shrink-0">
              <Wallet size={16} />
            </div>
            <span className="text-base font-bold text-zinc-900 dark:text-white">SmartBudget</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={signOut}
              aria-label="Esci dall'account"
              className="p-2.5 rounded-lg text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="relative border-t border-zinc-100 dark:border-zinc-700">
          <nav className="flex overflow-x-auto px-3 pb-2 pt-1 gap-1">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <item.Icon size={13} className="shrink-0" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          {/* Indica che la barra di navigazione scorre orizzontalmente */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-white dark:from-zinc-800 to-transparent" />
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:pl-60 pt-32 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          <ToastProvider>
            {children}
          </ToastProvider>
        </div>
      </main>
    </div>
  )
}
