type SpinnerProps = {
  size?: 'sm' | 'md'
  variant?: 'primary' | 'white'
  label?: string
}

export function Spinner({ size = 'md', variant = 'primary', label = 'Cargando' }: SpinnerProps) {
  const sizeClass = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  const colorClass =
    variant === 'white'
      ? 'border-white/20 border-t-white'
      : 'border-primary/20 border-t-primary'

  return (
    <div
      className={`${sizeClass} rounded-full border-[3px] ${colorClass} spinner`}
      role="status"
      aria-label={label}
    />
  )
}
