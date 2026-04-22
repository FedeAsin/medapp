type InfoRowProps = {
  label: string
  value: string
}

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-start justify-between py-3.5 gap-4">
      <span className="text-[length:var(--fs-body-sm)] text-zinc-400 shrink-0">{label}</span>
      <span className="text-[length:var(--fs-body-sm)] font-semibold text-zinc-800 dark:text-zinc-100 text-right">{value}</span>
    </div>
  )
}
