import type { ButtonHTMLAttributes } from 'react'
import { classNames } from '@/lib/utils'

const VARIANTS = {
  primary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  secondary: 'border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700',
  ghost: 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
  size?: 'sm' | 'md'
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
}
