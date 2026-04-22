import type { ReactNode } from 'react'

type BottomSheetProps = {
  onClose: () => void
  children: ReactNode
  title?: string
}

export function BottomSheet({ onClose, children, title }: BottomSheetProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[390px] bg-white dark:bg-zinc-900 rounded-t-3xl px-5 pt-5 pb-10 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mx-auto mb-5" aria-hidden />

        {title && (
          <h2 className="text-[length:var(--fs-title)] font-bold text-zinc-800 dark:text-zinc-100 mb-5">
            {title}
          </h2>
        )}

        {children}
      </div>
    </div>
  )
}
