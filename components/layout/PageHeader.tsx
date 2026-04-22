type PageHeaderProps = { title: string; subtitle?: string }

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-6">
      {subtitle && <p className="text-[length:var(--fs-body-sm)] text-zinc-400 dark:text-zinc-500 mb-0.5">{subtitle}</p>}
      <h1 className="text-[length:var(--fs-display)] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">{title}</h1>
    </header>
  )
}
