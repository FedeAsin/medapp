import type { ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
  loading?: boolean
  children: ReactNode
}

const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none'

const variants: Record<ButtonVariant, string> = {
  primary:   'bg-primary text-white shadow-sm',
  secondary: 'border-2 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300',
  ghost:     'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800',
  danger:    'bg-red-500 text-white hover:bg-red-600',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'text-[length:var(--fs-caption)] px-3 py-1.5 min-h-[var(--touch-sm)]',
  md: 'text-[length:var(--fs-body-lg)] px-5 py-3',
  lg: 'text-[length:var(--fs-label)] px-5 py-3.5 min-h-[var(--touch-md)]',
}

import { Spinner } from './Spinner'

export function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[base, variants[variant], sizes[size], full ? 'w-full' : '', className].join(' ')}
      {...props}
    >
      {loading ? <Spinner size="sm" variant={variant === 'primary' || variant === 'danger' ? 'white' : 'primary'} /> : children}
    </button>
  )
}
