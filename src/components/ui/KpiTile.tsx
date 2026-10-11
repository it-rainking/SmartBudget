import type { ReactNode } from 'react'
import { classNames } from '@/lib/utils'
import { Skeleton } from './Skeleton'

interface KpiTileProps {
  label: string
  value: ReactNode
  /** Classe colore del valore (es. text-red-600) */
  tone?: string
  hint?: ReactNode
  badge?: ReactNode
  loading?: boolean
  title?: string
  className?: string
}

// Riquadro KPI compatto: etichetta, valore, riga di nota facoltativa
export function KpiTile({ label, value, tone, hint, badge, loading, title, className }: KpiTileProps) {
  return (
    <div
      title={title}
      className={classNames(
        'bg-white dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700 shadow-sm px-3 py-2.5 sm:p-4 min-w-0',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">{label}</span>
        {badge}
      </div>
      {loading ? (
        <Skeleton className="h-6 w-20 mt-1.5" />
      ) : (
        <p className={classNames('text-base sm:text-2xl font-bold mt-0.5 truncate', tone ?? 'text-zinc-900 dark:text-white')}>{value}</p>
      )}
      {!loading && hint && <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{hint}</div>}
    </div>
  )
}
