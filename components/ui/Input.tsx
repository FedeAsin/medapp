import type { ReactNode, InputHTMLAttributes } from 'react'

// Clase base reutilizable como constante (para <input> y <select> nativos en MedSheet)
export const inputCls =
  'w-full h-11 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[length:var(--fs-body)] text-zinc-800 dark:text-zinc-100 outline-none focus:border-primary transition-colors'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  containerClassName?: string
}

export function Input({ label, containerClassName = '', className = '', ...props }: InputProps) {
  return (
    <div className={containerClassName}>
      {label && (
        <label className="text-[length:var(--fs-caption)] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5 block">
          {label}
        </label>
      )}
      <input className={`${inputCls} ${className}`} {...props} />
    </div>
  )
}

// Field wrapper genérico para inputs custom (time picker, color, etc.)
type FieldProps = {
  label: string
  children: ReactNode
  className?: string
}

export function Field({ label, children, className }: FieldProps) {
  return (
    <div className={className}>
      <label className="text-[length:var(--fs-caption)] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  )
}
