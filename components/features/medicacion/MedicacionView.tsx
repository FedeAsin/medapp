'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Medication } from '../../../lib/helpers'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { IconSignOut, IconPlus } from '../../icons'
import { MedicationCard } from '../medications/MedicationCard'
import { MedSheet } from '../medications/MedSheet'
import { HistorialView } from './HistorialView'

type MedicacionViewProps = {
  medications: Medication[]
  userId: string
  onRefresh: () => void
  onSignOut: () => void
}

const VIEW_OPTIONS = [
  { value: 'list' as const, label: 'Medicamentos' },
  { value: 'historial' as const, label: 'Historial' },
]

export function MedicacionView({ medications, userId, onRefresh, onSignOut }: MedicacionViewProps) {
  const [view, setView] = useState<'list' | 'historial'>('list')
  const [sheetMed, setSheetMed] = useState<Medication | Partial<Medication> | null>(null)

  async function handleDelete(id: string) {
    await supabase.from('medications').update({ active: false }).eq('id', id).eq('user_id', userId)
    onRefresh()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-8 pb-4 shrink-0">
        <div className="flex items-start justify-between mb-4">
          <header>
            <p className="text-[length:var(--fs-body-sm)] text-zinc-400 dark:text-zinc-500 mb-0.5">
              {medications.length} activo{medications.length !== 1 ? 's' : ''}
            </p>
            <h1 className="text-[length:var(--fs-display)] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">Mi medicación</h1>
          </header>
          <button onClick={onSignOut} aria-label="Cerrar sesión"
            className="mt-1 flex items-center gap-1.5 text-[length:var(--fs-caption)] font-medium text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
            <IconSignOut />
            Salir
          </button>
        </div>

        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
      </div>

      {view === 'list' ? (
        <div className="flex-1 overflow-y-auto px-4 pb-28">
          <div className="flex flex-col gap-3 mb-4">
            {medications.map((med) => (
              <MedicationCard key={med.id} med={med} onEdit={(m) => setSheetMed(m)} onDelete={handleDelete} />
            ))}
          </div>
          <button onClick={() => setSheetMed({})}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 text-[length:var(--fs-body)] font-medium flex items-center justify-center gap-2 transition-colors hover:border-primary hover:text-primary active:scale-[0.98]">
            <IconPlus />
            Agregar medicamento
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <HistorialView userId={userId} />
        </div>
      )}

      {sheetMed !== null && (
        <MedSheet
          userId={userId}
          editMed={sheetMed}
          onClose={() => setSheetMed(null)}
          onSaved={() => { setSheetMed(null); onRefresh() }}
        />
      )}
    </div>
  )
}
