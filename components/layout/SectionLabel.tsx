import type { ReactNode } from 'react'

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[length:var(--fs-overline)] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1 mb-2">
      {children}
    </p>
  )
}
