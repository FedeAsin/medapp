type Option<T extends string> = { value: T; label: string }

type SegmentedControlProps<T extends string> = {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 gap-1" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            'flex-1 py-2 rounded-lg text-[length:var(--fs-body-sm)] font-semibold transition-all',
            value === opt.value
              ? 'bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
