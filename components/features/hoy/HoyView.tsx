import { useState, useEffect } from 'react'
import type { Medication, DoseItem } from '../../../lib/helpers'
import { FRANJAS, getFranja, getGreeting, getDateLabel } from '../../../lib/helpers'
import { Alert } from '../../ui/Alert'
import { Badge } from '../../ui/Badge'
import { PageHeader } from '../../layout/PageHeader'
import { SectionLabel } from '../../layout/SectionLabel'
import { DoseCard } from '../doses/DoseCard'
import { ProgressRing } from '../doses/ProgressRing'

type HoyViewProps = {
  medications: Medication[]
  doses: DoseItem[]
  onToggle: (id: string) => void
  notifPermission: NotificationPermission | null
  onRequestNotifPermission: () => void
  userName: string
}

export function HoyView({ medications, doses, onToggle, notifPermission, onRequestNotifPermission, userName }: HoyViewProps) {
  const [header, setHeader] = useState({ greeting: '', date: '' })
  useEffect(() => { setHeader({ greeting: getGreeting(userName), date: getDateLabel() }) }, [userName])

  const taken = doses.filter((d) => d.taken)
  const pending = doses.filter((d) => !d.taken)
  const lateCount = pending.filter((d) => d.status === 'late').length
  const lowStock = medications.filter((m) => m.stock < m.stock_min)

  const franjaGroups = FRANJAS.map((f) => ({
    ...f,
    doses: pending.filter((d) => getFranja(d.time) === f.key),
  })).filter((f) => f.doses.length > 0)

  return (
    <div className="flex-1 overflow-y-auto pb-28 px-4 pt-8">
      <PageHeader title={header.greeting || '\u00A0'} subtitle={header.date || '\u00A0'} />

      {notifPermission === 'default' && (
        <Alert
          variant="info"
          icon="🔔"
          title="¿Activar recordatorios?"
          description="Te avisamos cuando sea hora de tomar cada medicamento"
          align="center"
          action={
            <button onClick={onRequestNotifPermission} className="text-[length:var(--fs-caption)] font-semibold text-white bg-primary px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
              Activar
            </button>
          }
          className="mb-3"
        />
      )}

      <section className="bg-white dark:bg-zinc-800 rounded-2xl p-5 mb-3 shadow-sm flex items-center gap-5">
        <ProgressRing taken={taken.length} total={doses.length} />
        <div className="flex-1 min-w-0">
          <p className="text-[length:var(--fs-overline)] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1">Progreso del día</p>
          <p className="text-[length:var(--fs-body-lg)] font-medium text-zinc-700 dark:text-zinc-200 leading-snug">
            {taken.length === doses.length && doses.length > 0
              ? '¡Todo completado! 🎉'
              : lateCount > 0
                ? `${lateCount} dosis atrasada${lateCount !== 1 ? 's' : ''}`
                : `${pending.length} pendiente${pending.length !== 1 ? 's' : ''}`}
          </p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant="success">{taken.length} tomadas</Badge>
            {lateCount > 0 && <Badge variant="warning">{lateCount} atrasadas</Badge>}
            {pending.length - lateCount > 0 && <Badge variant="neutral">{pending.length - lateCount} pendientes</Badge>}
          </div>
        </div>
      </section>

      {lowStock.length > 0 && (
        <Alert
          variant="warning"
          icon="⚠️"
          title="Stock bajo"
          description={
            <>{lowStock.map((m) => (
              <p key={m.id}>{m.name} {m.dose} — <strong>{m.stock}</strong> unidades restantes</p>
            ))}</>
          }
          className="mb-3"
        />
      )}

      {franjaGroups.map((franja) => (
        <section key={franja.key} className="mb-4">
          <SectionLabel>{franja.emoji} {franja.label}</SectionLabel>
          <div className="flex flex-col gap-2">
            {franja.doses.map((d) => <DoseCard key={d.id} dose={d} onToggle={onToggle} />)}
          </div>
        </section>
      ))}

      {taken.length > 0 && (
        <section className="mb-3">
          <SectionLabel>✅ Tomadas</SectionLabel>
          <div className="flex flex-col gap-2">
            {taken.map((d) => <DoseCard key={d.id} dose={d} onToggle={onToggle} />)}
          </div>
        </section>
      )}

      {doses.length === 0 && (
        <div className="text-center py-12 text-zinc-400 dark:text-zinc-600">
          <p className="text-[length:var(--fs-body-lg)]">No tenés medicamentos cargados</p>
          <p className="text-[length:var(--fs-body-sm)] mt-1">Agregá uno en la pestaña Medicación</p>
        </div>
      )}
    </div>
  )
}
