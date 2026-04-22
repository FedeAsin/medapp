import type { DoseItem } from '../../../lib/helpers'

type DoseCardProps = { dose: DoseItem; onToggle: (id: string) => void }

export function DoseCard({ dose, onToggle }: DoseCardProps) {
  const late = dose.status === 'late'

  return (
    <div className={[
      'rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3 transition-opacity duration-300',
      dose.taken
        ? 'opacity-45 bg-white dark:bg-zinc-800'
        : late
          ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50'
          : 'bg-white dark:bg-zinc-800',
    ].join(' ')}>
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: dose.color }} />

      <div className="flex-1 min-w-0">
        <p className={['text-sm font-semibold leading-snug', dose.taken ? 'line-through decoration-zinc-400 text-zinc-500 dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'].join(' ')}>
          {dose.name} <span className="font-normal text-zinc-500 dark:text-zinc-400">{dose.dose}</span>
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className={['text-xs font-medium', late && !dose.taken ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400'].join(' ')}>
            🕐 {dose.time}{late && !dose.taken ? ' · atrasada' : ''}
          </span>
          {dose.instructions && !late && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span>
              <span className="text-xs text-zinc-400 truncate">{dose.instructions}</span>
            </>
          )}
        </div>
      </div>

      <button
        onClick={() => onToggle(dose.id)}
        aria-label={dose.taken ? 'Marcar como pendiente' : 'Marcar como tomada'}
        className={[
          'shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95',
          dose.taken
            ? 'bg-primary text-white shadow-sm'
            : late
              ? 'border-2 border-amber-400 dark:border-amber-500'
              : 'border-2 border-zinc-200 dark:border-zinc-600 hover:border-primary',
        ].join(' ')}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke={dose.taken ? 'white' : late ? '#f59e0b' : '#d1d5db'}
          strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
  )
}
