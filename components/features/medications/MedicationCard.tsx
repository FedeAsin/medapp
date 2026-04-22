'use client'

import { useState } from 'react'
import { IconEdit, IconTrash } from '../../icons'
import type { Medication } from '../../../lib/helpers'
import { STOCK_MAX, frequencyLabel } from '../../../lib/helpers'

type MedicationCardProps = {
  med: Medication
  onEdit: (med: Medication) => void
  onDelete: (id: string) => void
}

export function MedicationCard({ med, onEdit, onDelete }: MedicationCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const lowStock = med.stock < med.stock_min
  const pct = Math.min(med.stock / STOCK_MAX, 1)

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl px-4 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center mt-0.5" style={{ backgroundColor: `${med.color}1a` }}>
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: med.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[length:var(--fs-body-lg)] font-semibold text-zinc-800 dark:text-zinc-100">{med.name}</span>
            <span className="text-[length:var(--fs-body-sm)] text-zinc-500 dark:text-zinc-400">{med.dose}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[length:var(--fs-caption)] text-zinc-400">🔄 {frequencyLabel(med.times)}</span>
            {med.times.length > 1 && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span>
                <span className="text-[length:var(--fs-caption)] text-zinc-400">{med.times.join(', ')}</span>
              </>
            )}
          </div>
          {med.instructions && (
            <p className="text-[length:var(--fs-caption)] text-zinc-400 mt-0.5 leading-snug">📋 {med.instructions}</p>
          )}
        </div>

        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(med)} aria-label="Editar"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-[#378ADD] hover:bg-[#378ADD]/10 transition-colors">
            <IconEdit />
          </button>
          <button onClick={() => setConfirmDelete(true)} aria-label="Eliminar"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
            <IconTrash />
          </button>
        </div>
      </div>

      {/* Stock bar */}
      <div className="mt-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[length:var(--fs-overline)] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Stock</span>
          <span className={['text-[length:var(--fs-caption)] font-semibold', lowStock ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-300'].join(' ')}>
            {med.stock} unidades{lowStock && <span className="ml-1 text-[10px] font-medium">⚠ bajo</span>}
          </span>
        </div>
        <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div className={['h-full rounded-full transition-all duration-500', lowStock ? 'bg-red-400' : 'bg-primary'].join(' ')}
            style={{ width: `${pct * 100}%` }} />
        </div>
      </div>

      {confirmDelete && (
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-700 flex items-center justify-between">
          <p className="text-[length:var(--fs-body-sm)] text-zinc-600 dark:text-zinc-300">¿Eliminar este medicamento?</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)}
              className="text-[length:var(--fs-caption)] font-medium text-zinc-400 px-3 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
              Cancelar
            </button>
            <button onClick={() => onDelete(med.id)}
              className="text-[length:var(--fs-caption)] font-medium text-white bg-red-500 px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors">
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
