'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useEnsureCurrentMonthRecurring } from '@/hooks/useRecurringExpenses'
import { useMonthParam, withMonthParam } from '@/hooks/useSelectedMonth'
import { NotificationBell } from '@/components/NotificationBell'
import { MonthSwitcher } from '@/components/MonthSwitcher'
import { QuickAddSheet } from '@/components/QuickAddSheet'
import { Modal } from '@/components/ui/Modal'
import { classNames } from '@/lib/utils'
import {
  LayoutDashboard, TrendingUp, CreditCard,
  Target, Settings, BookOpen,
  Wallet, LogOut, LineChart, Repeat, Plus, MoreHorizontal, PiggyBank,
  type LucideIcon,
} from 'lucide-react'

// Genera automaticamente le occorrenze del mese corrente per le spese
// ricorrenti attive, una volta per sessione: così si propagano "in avanti nel
// tempo" ad ogni apertura dell'app, senza bisogno di un cron dedicato.
// L'invalidazione delle query transazioni/KPI, se qualcosa viene creato, è
// già gestita dentro useEnsureCurrentMonthRecurring.
function useAutoGenerateRecurringExpenses() {
  const ensureRecurring = useEnsureCurrentMonthRecurring()
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (hasRunRef.current) return
    hasRunRef.current = true
    // Senza onError un fallimento resterebbe invisibile: le occorrenze del mese
    // semplicemente non comparirebbero, senza alcun indizio sul perché.
    ensureRecurring.mutate(undefined, {
      onError: (err) => console.error('Generazione automatica spese ricorrenti fallita', err),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// Tasto N (fuori dai campi di testo) apre l'inserimento rapido su desktop
function useQuickAddShortcut(open: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'n' && e.key !== 'N') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (document.querySelector('[aria-modal="true"]')) return
      e.preventDefault()
      open()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
}

interface NavItem {
  name: string
  href: string
  Icon: LucideIcon
  /** Pagina che legge il mese condiviso `?m=`: il link se lo porta dietro */
  monthAware?: boolean
}

// Le voci "Fatture", "Budget" e "Debiti" sono volutamente escluse: gli
// strumenti non sono in uso al momento. Le pagine /fatture, /budget e
// /debiti e tutto il codice relativo restano intatti e le rotte sono
// ancora raggiungibili da URL diretto (e protette dal middleware).
const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard/mensile', Icon: LayoutDashboard, monthAware: true },
  { name: 'Annuale', href: '/dashboard/annuale', Icon: TrendingUp },
  { name: 'Transazioni', href: '/transazioni', Icon: CreditCard, monthAware: true },
  { name: 'Spese ricorrenti', href: '/spese-ricorrenti', Icon: Repeat },
  { name: 'Obiettivi', href: '/obiettivi', Icon: Target },
  { name: 'Investimenti', href: '/investimenti', Icon: LineChart },
  { name: 'Fondo pensione', href: '/fondo-pensione', Icon: PiggyBank },
  { name: 'Impostazioni', href: '/settings', Icon: Settings },
  { name: 'Istruzioni', href: '/istruzioni', Icon: BookOpen },
]

// Barra in basso su mobile: le 3 destinazioni quotidiane + "+" al centro.
// Tutto il resto sta nel foglio "Altro".
const TAB_LEFT = [
  { name: 'Home', href: '/dashboard/mensile', Icon: LayoutDashboard, monthAware: true },
  { name: 'Movimenti', href: '/transazioni', Icon: CreditCard, monthAware: true },
]
const TAB_RIGHT = [
  { name: 'Investimenti', href: '/investimenti', Icon: LineChart },
]
const MORE_ITEMS = navigation.filter(
  (item) => ![...TAB_LEFT, ...TAB_RIGHT].some((t) => t.href === item.href),
)

// Pagine con selettore del mese nell'header mobile
const MONTH_PAGES: Record<string, { allowFuture: boolean }> = {
  '/dashboard/mensile': { allowFuture: false },
  '/transazioni': { allowFuture: true },
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const monthParam = useMonthParam()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  useAutoGenerateRecurringExpenses()
  useQuickAddShortcut(() => setQuickAddOpen(true))

  const hrefFor = (item: { href: string; monthAware?: boolean }) =>
    item.monthAware ? withMonthParam(item.href, monthParam) : item.href
  const isActive = (href: string) => pathname.startsWith(href)
  const monthPage = MONTH_PAGES[pathname]
  const currentNav = navigation.find((item) => isActive(item.href))
  const moreActive = MORE_ITEMS.some((item) => isActive(item.href))

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 w-60 bg-white dark:bg-zinc-800 border-r border-zinc-200 dark:border-zinc-700 hidden lg:flex flex-col">
        <div className="flex h-16 items-center gap-3 px-5 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
            <Wallet size={18} />
          </div>
          <span className="text-lg font-bold text-zinc-900 dark:text-white">SmartBudget</span>
        </div>

        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
          >
            <Plus size={17} className="shrink-0" />
            <span className="flex-1 text-left">Nuovo movimento</span>
            <kbd className="text-xs font-sans px-1.5 py-0.5 rounded bg-white/20">N</kbd>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={hrefFor(item)}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={classNames(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700/60',
              )}
            >
              <item.Icon size={17} className="shrink-0" />
              {item.name}
            </Link>
          ))}
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
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
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

      {/* Header (mobile): logo, mese o titolo pagina, notifiche */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-800/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-700 pt-[env(safe-area-inset-top)]">
        <div className="grid grid-cols-[2.5rem_1fr_2.5rem] h-14 items-center px-3">
          <Link href={hrefFor(navigation[0])} aria-label="SmartBudget, vai alla dashboard" className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
            <Wallet size={16} />
          </Link>
          <div className="flex justify-center min-w-0">
            {monthPage ? (
              <MonthSwitcher allowFuture={monthPage.allowFuture} />
            ) : (
              <span className="text-base font-semibold text-zinc-900 dark:text-white truncate">
                {currentNav?.name ?? 'SmartBudget'}
              </span>
            )}
          </div>
          <div className="flex justify-end">
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Barra di navigazione in basso (mobile) */}
      <nav
        aria-label="Navigazione principale"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-800/95 backdrop-blur border-t border-zinc-200 dark:border-zinc-700 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          {TAB_LEFT.map((item) => (
            <TabLink key={item.name} href={hrefFor(item)} label={item.name} Icon={item.Icon} active={isActive(item.href)} />
          ))}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              aria-label="Nuovo movimento"
              className="h-14 w-14 -mt-6 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 ring-4 ring-zinc-50 dark:ring-zinc-900 transition-colors"
            >
              <Plus size={26} />
            </button>
          </div>
          {TAB_RIGHT.map((item) => (
            <TabLink key={item.name} href={item.href} label={item.name} Icon={item.Icon} active={isActive(item.href)} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={classNames(
              'flex flex-col items-center justify-center gap-0.5 h-full text-xs transition-colors',
              moreActive ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-zinc-500 dark:text-zinc-400',
            )}
          >
            <MoreHorizontal size={22} />
            Altro
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="lg:pl-60 pt-[calc(3.5rem+env(safe-area-inset-top))] lg:pt-0 pb-tabbar lg:pb-0">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {quickAddOpen && <QuickAddSheet onClose={() => setQuickAddOpen(false)} />}

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} labelledBy="more-menu-title" size="sm">
        <div className="p-4 pt-2">
          <h2 id="more-menu-title" className="sr-only">Altre sezioni</h2>
          <div className="flex items-center gap-3 px-2 py-3 mb-2 border-b border-zinc-100 dark:border-zinc-700">
            <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-sm font-semibold shrink-0">
              {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{user?.user_metadata?.full_name || 'Utente'}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user?.email}</p>
            </div>
          </div>
          <ul className="space-y-0.5">
            {MORE_ITEMS.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={classNames(
                    'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium',
                    isActive(item.href)
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/60',
                  )}
                >
                  <item.Icon size={18} className="shrink-0" />
                  {item.name}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => { setMoreOpen(false); signOut() }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut size={18} className="shrink-0" />
                Esci
              </button>
            </li>
          </ul>
        </div>
      </Modal>
    </div>
  )
}

function TabLink({ href, label, Icon, active }: { href: string; label: string; Icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={classNames(
        'flex flex-col items-center justify-center gap-0.5 h-full text-xs transition-colors',
        active ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-zinc-500 dark:text-zinc-400',
      )}
    >
      <Icon size={22} />
      {label}
    </Link>
  )
}
