import { IconCalendar, IconPill, IconScan } from '../icons'

const TABS = [
  { id: 'hoy',        label: 'Hoy',        Icon: IconCalendar },
  { id: 'medicacion', label: 'Medicación', Icon: IconPill },
  { id: 'escanear',   label: 'Escanear',   Icon: IconScan },
]

type TabBarProps = { active: string; onChange: (id: string) => void }

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 flex justify-around items-center h-[60px] px-1 z-50">
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-current={isActive ? 'page' : undefined}
            className={['flex flex-col items-center gap-0.5 flex-1 py-1.5 transition-colors duration-150', isActive ? 'text-primary' : 'text-zinc-400 dark:text-zinc-500'].join(' ')}
          >
            <Icon active={isActive} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
