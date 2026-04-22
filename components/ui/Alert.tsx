import type { ReactNode } from 'react'

type AlertVariant = 'info' | 'success' | 'warning' | 'error'

type AlertProps = {
  variant: AlertVariant
  icon: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  align?: 'start' | 'center'
  className?: string
}

const styles: Record<AlertVariant, string> = {
  info:    'bg-primary/10 border-primary/25 dark:bg-primary/10 dark:border-primary/25',
  success: 'bg-primary/10 border-primary/25 dark:bg-primary/10 dark:border-primary/25',
  warning: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/60',
  error:   'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/50',
}

const titleStyles: Record<AlertVariant, string> = {
  info:    'text-zinc-700 dark:text-zinc-200',
  success: 'text-primary',
  warning: 'text-amber-800 dark:text-amber-400',
  error:   'text-red-700 dark:text-red-400',
}

const descStyles: Record<AlertVariant, string> = {
  info:    'text-zinc-500 dark:text-zinc-400',
  success: 'text-primary/70',
  warning: 'text-amber-700 dark:text-amber-500',
  error:   'text-red-600 dark:text-red-500',
}

export function Alert({
  variant,
  icon,
  title,
  description,
  action,
  align = 'start',
  className = '',
}: AlertProps) {
  return (
    <div
      className={[
        'rounded-2xl p-4 border flex gap-3',
        align === 'center' ? 'items-center' : 'items-start',
        styles[variant],
        className,
      ].join(' ')}
      role="alert"
    >
      <span className="shrink-0 leading-none mt-0.5" aria-hidden="true">
        {icon}
      </span>

      <div className="flex-1 min-w-0">
        <p className={`text-[length:var(--fs-body-sm)] font-semibold leading-snug ${titleStyles[variant]}`}>
          {title}
        </p>
        {description && (
          <div className={`text-[length:var(--fs-caption)] leading-snug mt-0.5 ${descStyles[variant]}`}>
            {description}
          </div>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
