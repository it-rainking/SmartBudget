import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  Icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
}

// Stato vuoto: dice cosa comparirà qui e come iniziare
export function EmptyState({ Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10">
      <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-3">
        <Icon size={22} />
      </div>
      <p className="font-medium text-zinc-900 dark:text-white">{title}</p>
      {description && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
