'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { PRESET_COLORS, frequencyLabel } from '../../../lib/helpers'
import type { Medication } from '../../../lib/helpers'
import { BottomSheet } from '../../ui/BottomSheet'
import { Field, inputCls } from '../../ui/Input'

interface MedFormData {
  name: string; dose: string; times: string[]; instructions: string
  stock: string; stock_min: string; color: string
}

type MedSheetProps = {
  userId: string
  editMed?: Medication | Partial<Medication>
  onClose: () => void
  onSaved: () => void
}

export function MedSheet({ userId, editMed, onClose, onSaved }: MedSheetProps) {
  const isEdit = !!(editMed as Medication)?.id

  const [form, setForm] = useState<MedFormData>({
    name: editMed?.name ?? '',
    dose: editMed?.dose ?? '',
    times: editMed?.times ?? ['08:00'],
    instructions: editMed?.instructions ?? '',
    stock: String(editMed?.stock ?? 30),
    stock_min: String(editMed?.stock_min ?? 5),
    color: editMed?.color ?? PRESET_COLORS[0],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField(key: keyof MedFormData, value: string) { setForm((f) => ({ ...f, [key]: value })) }
  function setTime(i: number, value: string) { setForm((f) => { const times = [...f.times]; times[i] = value; return { ...f, times } }) }
  function addTime() { setForm((f) => ({ ...f, times: [...f.times, '12:00'] })) }
  function removeTime(i: number) { setForm((f) => ({ ...f, times: f.times.filter((_, idx) => idx !== i) })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.dose.trim()) { setError('Nombre y dosis son obligatorios.'); return }
    setSaving(true); setError('')

    const payload = {
      name: form.name.trim(),
      dose: form.dose.trim(),
      frequency: frequencyLabel(form.times),
      times: form.times,
      instructions: form.instructions.trim() || null,
      stock: parseInt(form.stock) || 0,
      stock_min: parseInt(form.stock_min) || 5,
      color: form.color,
    }

    let err
    if (isEdit) {
      ;({ error: err } = await supabase.from('medications').update(payload).eq('id', (editMed as Medication).id).eq('user_id', userId))
    } else {
      ;({ error: err } = await supabase.from('medications').insert({ ...payload, active: true, user_id: userId }))
    }

    setSaving(false)
    if (err) { setError('Error al guardar. Intentá de nuevo.'); return }
    onSaved()
  }

  return (
    <BottomSheet onClose={onClose} title={isEdit ? 'Editar medicamento' : 'Agregar medicamento'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Nombre">
          <input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Ej: Enalapril" className={inputCls} />
        </Field>
        <Field label="Dosis">
          <input value={form.dose} onChange={(e) => setField('dose', e.target.value)} placeholder="Ej: 10mg" className={inputCls} />
        </Field>

        <Field label="Horarios">
          <div className="flex flex-col gap-2">
            {form.times.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="time" value={t} onChange={(e) => setTime(i, e.target.value)} className={`${inputCls} flex-1`} />
                {form.times.length > 1 && (
                  <button type="button" onClick={() => removeTime(i)} className="text-red-400 text-[20px] leading-none w-8 h-8 flex items-center justify-center">×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addTime} className="text-[length:var(--fs-body-sm)] text-primary font-medium text-left">
              + Agregar horario
            </button>
          </div>
        </Field>

        <Field label="Instrucciones (opcional)">
          <input value={form.instructions} onChange={(e) => setField('instructions', e.target.value)} placeholder="Ej: Tomar con comida" className={inputCls} />
        </Field>

        <div className="flex gap-3">
          <Field label="Stock" className="flex-1">
            <input type="number" min="0" value={form.stock} onChange={(e) => setField('stock', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Stock mínimo" className="flex-1">
            <input type="number" min="0" value={form.stock_min} onChange={(e) => setField('stock_min', e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Color">
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setField('color', c)}
                className="w-8 h-8 rounded-full transition-transform active:scale-95"
                style={{ backgroundColor: c, outline: form.color === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
            ))}
          </div>
        </Field>

        {error && <p className="text-[length:var(--fs-body-sm)] text-red-500">{error}</p>}

        <button type="submit" disabled={saving}
          className="w-full py-3.5 rounded-xl bg-primary text-white text-[length:var(--fs-body-lg)] font-semibold mt-1 transition-all active:scale-[0.98] disabled:opacity-50">
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar medicamento'}
        </button>
      </form>
    </BottomSheet>
  )
}
