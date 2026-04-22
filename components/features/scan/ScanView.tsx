'use client'

import { useState, useRef } from 'react'
import type { Medication } from '../../../lib/helpers'
import { Alert } from '../../ui/Alert'
import { Spinner } from '../../ui/Spinner'
import { InfoRow } from '../../ui/InfoRow'
import { IconCheck, IconCamera } from '../../icons'
import { PageHeader } from '../../layout/PageHeader'
import { MedSheet } from '../medications/MedSheet'

interface ScanResult {
  name?: string; dose?: string; activeIngredient?: string
  laboratory?: string; instructions?: string; error?: string
}

type ScanState = 'idle' | 'loading' | 'result' | 'error'

export function ScanView({ userId, onMedAdded }: { userId: string; onMedAdded: () => void }) {
  const [state, setState] = useState<ScanState>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return
    setState('loading'); setResult(null)
    setPreview(URL.createObjectURL(file))

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve((e.target?.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ScanResult = await res.json()
      if (data.error) { setState('error'); setResult(data); return }
      setResult(data); setState('result')
    } catch {
      setState('error')
      setResult({ error: 'No se pudo analizar la imagen. Intentá de nuevo.' })
    }
  }

  function reset() {
    setState('idle'); setPreview(null); setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const scanInitial: Partial<Medication> | undefined = result && !result.error ? {
    name: result.name ?? '',
    dose: result.dose ?? '',
    instructions: [result.activeIngredient, result.laboratory].filter(Boolean).join(' — ') || result.instructions || '',
  } : undefined

  const infoRows = result ? [
    { label: 'Nombre comercial', value: result.name },
    { label: 'Principio activo', value: result.activeIngredient },
    { label: 'Dosis', value: result.dose },
    { label: 'Laboratorio', value: result.laboratory },
    { label: 'Instrucciones', value: result.instructions },
  ].filter((r): r is { label: string; value: string } => !!r.value) : []

  return (
    <div className="flex-1 overflow-y-auto pb-28 px-4 pt-8">
      <PageHeader title="Escanear medicamento" subtitle="Sacá una foto de la caja y la IA completa los datos" />

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

      {state === 'idle' && (
        <button onClick={() => fileInputRef.current?.click()}
          className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-800/60 transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.99] shadow-sm">
          <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center"><IconCamera /></div>
          <div className="text-center">
            <p className="text-[length:var(--fs-body-lg)] font-semibold text-zinc-600 dark:text-zinc-300">Tocar para sacar foto</p>
            <p className="text-[length:var(--fs-caption)] text-zinc-400 mt-0.5">Se abre la cámara del celular</p>
          </div>
        </button>
      )}

      {(state === 'loading' || preview) && state !== 'result' && state !== 'error' && (
        <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden relative shadow-sm bg-zinc-100 dark:bg-zinc-800">
          {preview && <img src={preview} alt="Preview" className="w-full h-full object-cover" />}
          {state === 'loading' && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3">
              <Spinner variant="white" />
              <p className="text-white text-[length:var(--fs-body)] font-medium">Analizando con IA…</p>
            </div>
          )}
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col gap-3">
          {preview && <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-sm"><img src={preview} alt="Preview" className="w-full h-full object-cover opacity-50" /></div>}
          <Alert variant="error" icon="❌" title="No se pudo identificar" description={result?.error} />
          <button onClick={reset} className="w-full py-3.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 text-[length:var(--fs-body)] font-semibold text-zinc-600 dark:text-zinc-300 active:scale-[0.98]">
            Intentar de nuevo
          </button>
        </div>
      )}

      {state === 'result' && result && (
        <div className="flex flex-col gap-3">
          {preview && <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-sm"><img src={preview} alt="Preview" className="w-full h-full object-cover" /></div>}

          <Alert
            variant="success"
            icon={<div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><IconCheck /></div>}
            title="Medicamento identificado"
            description="Revisá los datos antes de agregar"
            align="center"
          />

          <div className="bg-white dark:bg-zinc-800 rounded-2xl px-4 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-700">
            {infoRows.map(({ label, value }) => <InfoRow key={label} label={label} value={value} />)}
          </div>

          <div className="flex gap-2.5 mt-1">
            <button onClick={reset} className="flex-1 py-3.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 text-[length:var(--fs-body)] font-semibold text-zinc-600 dark:text-zinc-300 active:scale-[0.98]">
              Reintentar
            </button>
            <button onClick={() => setShowAddForm(true)} className="flex-1 py-3.5 rounded-xl bg-primary text-white text-[length:var(--fs-body)] font-semibold active:scale-[0.98] shadow-sm">
              Agregar a mis meds
            </button>
          </div>
        </div>
      )}

      {showAddForm && scanInitial && (
        <MedSheet userId={userId} editMed={scanInitial} onClose={() => setShowAddForm(false)}
          onSaved={() => { setShowAddForm(false); reset(); onMedAdded() }} />
      )}
    </div>
  )
}
