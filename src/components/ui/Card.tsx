import type { HTMLAttributes } from 'react'
import { classNames } from '@/lib/utils'

// Contenitore standard delle sezioni: stesso bordo, raggio e ombra ovunque
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={classNames(
        'bg-white dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700 shadow-sm',
        className,
      )}
      {...props}
    />
  )
}
