import { classNames } from '@/lib/utils'

// Segnaposto grigio pulsante con la forma del contenuto in arrivo
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={classNames('rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse', className)} />
}
