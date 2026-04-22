import type { ReactNode } from 'react'

type BadgeVariant = 'success' | 'warning' | 'neutral'

type BadgeProps = {
  variant: BadgeVariant
  children: ReactNode
}

const styles: Record<BadgeVariant, string> = {
  success: 'bg-primary/10 text-primary',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  neutral: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400',
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-overline)] font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  )
}
