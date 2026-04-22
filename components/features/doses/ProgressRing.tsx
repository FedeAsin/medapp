type ProgressRingProps = { taken: number; total: number }

export function ProgressRing({ taken, total }: ProgressRingProps) {
  const SIZE = 116, SW = 10, R = (SIZE - SW) / 2, C = 2 * Math.PI * R
  const offset = total === 0 ? C : C - (taken / total) * C

  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#E5E7EB" strokeWidth={SW} className="dark:stroke-zinc-700" />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--clr-primary)" strokeWidth={SW}
          strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-bold leading-none text-zinc-800 dark:text-zinc-100">
          {taken}<span className="text-sm font-normal text-zinc-400">/{total}</span>
        </span>
        <span className="text-[length:var(--fs-overline)] text-zinc-400 mt-0.5">dosis</span>
      </div>
    </div>
  )
}
