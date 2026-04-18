'use client'

import { useState, useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Medication {
  id: string
  name: string
  dose: string
  frequency: string
  times: string[]
  instructions?: string
  stock: number
  stock_min: number
  color: string
  active: boolean
}

interface DoseItem {
  id: string
  medicationId: string
  name: string
  dose: string
  time: string
  instructions?: string
  color: string
  taken: boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

type ScanState = 'idle' | 'loading' | 'result'
type AuthState = 'loading' | 'unauthenticated' | 'authenticated'

// ─── Constants ────────────────────────────────────────────────────────────────

const STOCK_MAX = 30

const SCAN_RESULT = { comercial: 'Losartán', activo: 'Losartán potásico', dosis: '50mg', laboratorio: 'Roemmers' }

const QUICK_QUESTIONS = ['¿Puedo tomar ibuprofeno?', '¿Qué hace el Enalapril?', 'Olvidé una dosis']

const INITIAL_MESSAGES: ChatMessage[] = [{
  id: 'init',
  role: 'assistant',
  text: 'Hola, soy tu asistente de medicación. Tengo acceso a tu lista de medicamentos y puedo ayudarte con dudas. ¿En qué puedo ayudarte?',
}]

const PRESET_COLORS = ['#1D9E75', '#378ADD', '#D85A30', '#BA7517', '#9B59B6', '#E74C3C', '#2ECC71', '#F39C12']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function buildDoses(medications: Medication[], takenSet: Set<string>): DoseItem[] {
  const items: DoseItem[] = []
  for (const med of medications)
    for (const time of med.times)
      items.push({
        id: `${med.id}-${time}`,
        medicationId: med.id,
        name: med.name,
        dose: med.dose,
        time,
        instructions: med.instructions,
        color: med.color,
        taken: takenSet.has(`${med.id}-${time}`),
      })
  return items.sort((a, b) => a.time.localeCompare(b.time))
}

function frequencyLabel(times: string[]): string {
  const n = times.length
  return n === 1 ? '1 vez al día' : `${n} veces al día`
}

function getResponse(q: string): string {
  const lq = q.toLowerCase()
  if (lq.includes('ibuprofeno'))
    return 'Tomás Enalapril para la presión. El ibuprofeno puede reducir su efecto. Para dolor ocasional, el paracetamol es más seguro. Consultá con tu médico. ⚠️ No soy un médico.'
  if (lq.includes('enalapril'))
    return 'El Enalapril es un inhibidor de la ECA para hipertensión. Lo tomás a las 8:00 AM en ayunas (10mg). Evitá exceso de potasio y no lo suspendas sin consultar.'
  if (lq.includes('olvidé') || lq.includes('olvide') || lq.includes('dosis'))
    return 'Depende del medicamento y cuánto tiempo pasó. Si fue hace menos de 4 horas, generalmente podés tomarla. Si pasó más tiempo, esperá a la próxima. Nunca dupliques la dosis. ⚠️ Consultá con tu médico.'
  return 'No tengo información específica sobre eso. Te recomiendo consultar con tu médico o farmacéutico. ⚠️ No soy un médico.'
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return 'Buenos días'
  if (h >= 12 && h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function getDateLabel(): string {
  const raw = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCalendar({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
}
function IconPill({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7.07-7.07l7 7a5 5 0 0 1-7.07 7.07Z" /><line x1="8.5" y1="11.5" x2="15.5" y2="11.5" /></svg>
}
function IconScan({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></svg>
}
function IconChat({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
}
function IconSend() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
}
function IconCamera() {
  return <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
}
function IconCheck() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
}

const TABS = [
  { id: 'hoy',        label: 'Hoy',        Icon: IconCalendar },
  { id: 'medicacion', label: 'Medicación', Icon: IconPill },
  { id: 'escanear',   label: 'Escanear',   Icon: IconScan },
  { id: 'asistente',  label: 'Asistente',  Icon: IconChat },
]

// ─── Shared ───────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1 mb-2">{children}</p>
}

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      {subtitle && <p className="text-[13px] text-zinc-400 dark:text-zinc-500 mb-0.5">{subtitle}</p>}
      <h1 className="text-[26px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">{title}</h1>
    </header>
  )
}

const inputCls = 'w-full h-11 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[14px] text-zinc-800 dark:text-zinc-100 outline-none focus:border-[#1D9E75] transition-colors'

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

// ─── Login / Register view ────────────────────────────────────────────────────

function LoginView() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    if (!email.trim() || !password) { setError('Completá email y contraseña.'); return }
    setLoading(true)
    if (isSignUp) {
      const { error: err } = await supabase.auth.signUp({ email: email.trim(), password })
      if (err) setError(err.message)
      else setSuccessMsg('Revisá tu email para confirmar la cuenta.')
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) setError('Email o contraseña incorrectos.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-dvh bg-[#F6F5F0] dark:bg-zinc-950 flex items-center justify-center px-5">
      <div className="w-full max-w-[360px]">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#1D9E75] flex items-center justify-center mb-4 shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7.07-7.07l7 7a5 5 0 0 1-7.07 7.07Z" />
              <line x1="8.5" y1="11.5" x2="15.5" y2="11.5" />
            </svg>
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">MedApp</h1>
          <p className="text-[14px] text-zinc-400 dark:text-zinc-500 mt-1">Tu medicación, organizada</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm">
          <h2 className="text-[17px] font-semibold text-zinc-800 dark:text-zinc-100 mb-5">
            {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                className={inputCls}
              />
            </Field>

            <Field label="Contraseña">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? 'Mínimo 6 caracteres' : '••••••••'}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className={inputCls}
              />
            </Field>

            {error && (
              <p className="text-[13px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl px-3 py-2.5">
                {error}
              </p>
            )}
            {successMsg && (
              <p className="text-[13px] text-[#1D9E75] bg-[#1D9E75]/8 border border-[#1D9E75]/25 rounded-xl px-3 py-2.5">
                {successMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#1D9E75] text-white text-[15px] font-semibold mt-1 transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Cargando…' : isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        {/* Toggle mode */}
        <p className="text-center text-[13px] text-zinc-400 dark:text-zinc-500 mt-5">
          {isSignUp ? '¿Ya tenés cuenta?' : '¿No tenés cuenta?'}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMsg('') }}
            className="text-[#1D9E75] font-semibold"
          >
            {isSignUp ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </p>
      </div>
    </div>
  )
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({ taken, total }: { taken: number; total: number }) {
  const SIZE = 116, SW = 10, R = (SIZE - SW) / 2, C = 2 * Math.PI * R
  const offset = total === 0 ? C : C - (taken / total) * C
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden>
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="#E5E7EB" strokeWidth={SW} className="dark:stroke-zinc-700" />
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="#1D9E75" strokeWidth={SW} strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-bold leading-none text-zinc-800 dark:text-zinc-100">
          {taken}<span className="text-sm font-normal text-zinc-400">/{total}</span>
        </span>
        <span className="text-[11px] text-zinc-400 mt-0.5">dosis</span>
      </div>
    </div>
  )
}

// ─── Dose card ────────────────────────────────────────────────────────────────

function DoseCard({ dose, onToggle }: { dose: DoseItem; onToggle: (id: string) => void }) {
  return (
    <div className={['bg-white dark:bg-zinc-800 rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3 transition-opacity duration-300', dose.taken ? 'opacity-45' : 'opacity-100'].join(' ')}>
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: dose.color }} />
      <div className="flex-1 min-w-0">
        <p className={['text-sm font-semibold text-zinc-800 dark:text-zinc-100 leading-snug', dose.taken ? 'line-through decoration-zinc-400' : ''].join(' ')}>
          {dose.name} <span className="font-normal text-zinc-500 dark:text-zinc-400">{dose.dose}</span>
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-xs text-zinc-400">🕐 {dose.time}</span>
          {dose.instructions && <><span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span><span className="text-xs text-zinc-400 truncate">{dose.instructions}</span></>}
        </div>
      </div>
      <button onClick={() => onToggle(dose.id)} aria-label={dose.taken ? 'Marcar como pendiente' : 'Marcar como tomada'}
        className={['shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95', dose.taken ? 'bg-[#1D9E75] text-white shadow-sm' : 'border-2 border-zinc-200 dark:border-zinc-600 text-transparent hover:border-[#1D9E75]'].join(' ')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      </button>
    </div>
  )
}

// ─── Medication card ──────────────────────────────────────────────────────────

function MedicationCard({ med }: { med: Medication }) {
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
            <span className="text-[15px] font-semibold text-zinc-800 dark:text-zinc-100">{med.name}</span>
            <span className="text-[13px] text-zinc-500 dark:text-zinc-400">{med.dose}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[12px] text-zinc-400">🔄 {frequencyLabel(med.times)}</span>
            {med.times.length > 1 && <><span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span><span className="text-[12px] text-zinc-400">{med.times.join(', ')}</span></>}
          </div>
          {med.instructions && <p className="text-[12px] text-zinc-400 mt-0.5 leading-snug">📋 {med.instructions}</p>}
        </div>
      </div>
      <div className="mt-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Stock</span>
          <span className={['text-[12px] font-semibold', lowStock ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-300'].join(' ')}>
            {med.stock} unidades{lowStock && <span className="ml-1 text-[10px] font-medium">⚠ bajo</span>}
          </span>
        </div>
        <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div className={['h-full rounded-full transition-all duration-500', lowStock ? 'bg-red-400' : 'bg-[#1D9E75]'].join(' ')} style={{ width: `${pct * 100}%` }} />
        </div>
      </div>
    </div>
  )
}

// ─── Add medication form ──────────────────────────────────────────────────────

interface AddMedFormData {
  name: string
  dose: string
  times: string[]
  instructions: string
  stock: string
  stock_min: string
  color: string
}

function AddMedSheet({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AddMedFormData>({
    name: '', dose: '', times: ['08:00'], instructions: '', stock: '30', stock_min: '5', color: PRESET_COLORS[0],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField(key: keyof AddMedFormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setTime(i: number, value: string) {
    setForm((f) => {
      const times = [...f.times]
      times[i] = value
      return { ...f, times }
    })
  }

  function addTime() {
    setForm((f) => ({ ...f, times: [...f.times, '12:00'] }))
  }

  function removeTime(i: number) {
    setForm((f) => ({ ...f, times: f.times.filter((_, idx) => idx !== i) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.dose.trim()) { setError('Nombre y dosis son obligatorios.'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('medications').insert({
      name: form.name.trim(),
      dose: form.dose.trim(),
      frequency: frequencyLabel(form.times),
      times: form.times,
      instructions: form.instructions.trim() || null,
      stock: parseInt(form.stock) || 0,
      stock_min: parseInt(form.stock_min) || 5,
      color: form.color,
      active: true,
      user_id: userId,
    })
    setSaving(false)
    if (err) { setError('Error al guardar. Intentá de nuevo.'); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="w-full max-w-[390px] bg-white dark:bg-zinc-900 rounded-t-3xl px-5 pt-5 pb-10 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mx-auto mb-5" />
        <h2 className="text-[18px] font-bold text-zinc-800 dark:text-zinc-100 mb-5">Agregar medicamento</h2>

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
                  <input type="time" value={t} onChange={(e) => setTime(i, e.target.value)} className={inputCls + ' flex-1'} />
                  {form.times.length > 1 && (
                    <button type="button" onClick={() => removeTime(i)} className="text-red-400 text-[20px] leading-none w-8 h-8 flex items-center justify-center">×</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addTime} className="text-[13px] text-[#1D9E75] font-medium text-left">+ Agregar horario</button>
            </div>
          </Field>

          <Field label="Instrucciones (opcional)">
            <input value={form.instructions} onChange={(e) => setField('instructions', e.target.value)} placeholder="Ej: Tomar con comida" className={inputCls} />
          </Field>

          <div className="flex gap-3">
            <Field label="Stock inicial" className="flex-1">
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
                  style={{ backgroundColor: c, outline: form.color === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }}
                />
              ))}
            </div>
          </Field>

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <button type="submit" disabled={saving}
            className="w-full py-3.5 rounded-xl bg-[#1D9E75] text-white text-[15px] font-semibold mt-1 transition-all active:scale-[0.98] disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar medicamento'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── HOY view ─────────────────────────────────────────────────────────────────

function HoyView({ medications, doses, onToggle }: { medications: Medication[]; doses: DoseItem[]; onToggle: (id: string) => void }) {
  const [header, setHeader] = useState({ greeting: '', date: '' })
  useEffect(() => { setHeader({ greeting: getGreeting(), date: getDateLabel() }) }, [])
  const taken = doses.filter((d) => d.taken)
  const pending = doses.filter((d) => !d.taken)
  const lowStock = medications.filter((m) => m.stock < m.stock_min)
  return (
    <div className="flex-1 overflow-y-auto pb-28 px-4 pt-8">
      <PageHeader title={header.greeting || '\u00A0'} subtitle={header.date || '\u00A0'} />

      <section className="bg-white dark:bg-zinc-800 rounded-2xl p-5 mb-3 shadow-sm flex items-center gap-5">
        <ProgressRing taken={taken.length} total={doses.length} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1">Progreso del día</p>
          <p className="text-[15px] font-medium text-zinc-700 dark:text-zinc-200 leading-snug">
            {taken.length === doses.length && doses.length > 0 ? '¡Todo completado!' : `${pending.length} dosis pendiente${pending.length !== 1 ? 's' : ''}`}
          </p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="text-[11px] font-medium bg-[#1D9E75]/10 text-[#1D9E75] rounded-full px-2.5 py-0.5">{taken.length} tomadas</span>
            <span className="text-[11px] font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-full px-2.5 py-0.5">{pending.length} pendientes</span>
          </div>
        </div>
      </section>

      {lowStock.length > 0 && (
        <section className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 mb-3 flex gap-3 items-start">
          <span className="text-[18px] leading-none mt-0.5" aria-hidden>⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-400 mb-0.5">Stock bajo</p>
            {lowStock.map((m) => (
              <p key={m.id} className="text-[12px] text-amber-700 dark:text-amber-500 leading-snug">{m.name} {m.dose} — <strong>{m.stock}</strong> unidades restantes</p>
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section className="mb-3">
          <SectionLabel>Pendientes</SectionLabel>
          <div className="flex flex-col gap-2">{pending.map((d) => <DoseCard key={d.id} dose={d} onToggle={onToggle} />)}</div>
        </section>
      )}
      {taken.length > 0 && (
        <section className="mb-3">
          <SectionLabel>Tomadas</SectionLabel>
          <div className="flex flex-col gap-2">{taken.map((d) => <DoseCard key={d.id} dose={d} onToggle={onToggle} />)}</div>
        </section>
      )}
    </div>
  )
}

// ─── MEDICACIÓN view ──────────────────────────────────────────────────────────

function MedicacionView({ medications, userId, onRefresh, onSignOut }: {
  medications: Medication[]
  userId: string
  onRefresh: () => void
  onSignOut: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  return (
    <div className="flex-1 overflow-y-auto pb-28 px-4 pt-8">
      {/* Header row with sign-out */}
      <div className="flex items-start justify-between mb-6">
        <header>
          <p className="text-[13px] text-zinc-400 dark:text-zinc-500 mb-0.5">{`${medications.length} medicamento${medications.length !== 1 ? 's' : ''} activo${medications.length !== 1 ? 's' : ''}`}</p>
          <h1 className="text-[26px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">Mi medicación</h1>
        </header>
        <button
          onClick={onSignOut}
          className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          aria-label="Cerrar sesión"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Salir
        </button>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        {medications.map((med) => <MedicationCard key={med.id} med={med} />)}
      </div>
      <button
        onClick={() => setShowForm(true)}
        className="w-full py-4 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 text-[14px] font-medium flex items-center justify-center gap-2 transition-colors hover:border-[#1D9E75] hover:text-[#1D9E75] active:scale-[0.98]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        Agregar medicamento
      </button>
      {showForm && (
        <AddMedSheet
          userId={userId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); onRefresh() }}
        />
      )}
    </div>
  )
}

// ─── ESCANEAR view ────────────────────────────────────────────────────────────

function ScanView() {
  const [state, setState] = useState<ScanState>('idle')

  function handleScan() {
    setState('loading')
    setTimeout(() => setState('result'), 2000)
  }

  return (
    <div className="flex-1 overflow-y-auto pb-28 px-4 pt-8">
      <PageHeader
        title="Escanear medicamento"
        subtitle="Sacá una foto de la caja y la IA completa los datos"
      />

      {state === 'idle' && (
        <button
          onClick={handleScan}
          className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700
            flex flex-col items-center justify-center gap-4
            bg-white dark:bg-zinc-800/60
            transition-all hover:border-[#1D9E75] hover:bg-[#1D9E75]/5
            active:scale-[0.99] active:bg-[#1D9E75]/8 shadow-sm">
          <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
            <IconCamera />
          </div>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-zinc-600 dark:text-zinc-300">Tocar para sacar foto</p>
            <p className="text-[12px] text-zinc-400 mt-0.5">JPG, PNG o foto de cámara</p>
          </div>
        </button>
      )}

      {state === 'loading' && (
        <div className="w-full aspect-[4/3] rounded-2xl border-2 border-[#1D9E75]/25
          bg-[#1D9E75]/5 dark:bg-[#1D9E75]/8
          flex flex-col items-center justify-center gap-5 shadow-sm">
          <div className="w-12 h-12 rounded-full border-[3px] border-[#1D9E75]/20 border-t-[#1D9E75] spinner" />
          <div className="text-center">
            <p className="text-[15px] font-semibold text-zinc-700 dark:text-zinc-200">Analizando imagen con IA...</p>
            <p className="text-[12px] text-zinc-400 mt-0.5">Esto tarda solo un momento</p>
          </div>
        </div>
      )}

      {state === 'result' && (
        <div className="flex flex-col gap-3">
          <div className="bg-[#1D9E75]/10 border border-[#1D9E75]/25 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1D9E75] flex items-center justify-center shrink-0">
              <IconCheck />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#1D9E75]">Medicamento identificado</p>
              <p className="text-[12px] text-[#1D9E75]/70">Revisá los datos antes de confirmar</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-2xl px-4 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-700">
            {[
              { label: 'Nombre comercial', value: SCAN_RESULT.comercial },
              { label: 'Principio activo', value: SCAN_RESULT.activo },
              { label: 'Dosis',            value: SCAN_RESULT.dosis },
              { label: 'Laboratorio',      value: SCAN_RESULT.laboratorio },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-3.5">
                <span className="text-[13px] text-zinc-400">{label}</span>
                <span className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-100">{value}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2.5 mt-1">
            <button
              onClick={() => setState('idle')}
              className="flex-1 py-3.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-700
                text-[14px] font-semibold text-zinc-600 dark:text-zinc-300
                transition-colors hover:border-zinc-300 active:scale-[0.98]">
              Reintentar
            </button>
            <button className="flex-1 py-3.5 rounded-xl bg-[#1D9E75] text-white text-[14px] font-semibold transition-all active:scale-[0.98] active:brightness-90 shadow-sm">
              Confirmar y agregar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ASISTENTE view ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-2">
      <div className="w-7 h-7 rounded-full bg-[#1D9E75]/15 flex items-center justify-center shrink-0">
        <span className="text-[14px]">🤖</span>
      </div>
      <div className="bg-white dark:bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <span className="typing-dot text-zinc-400 text-xl leading-none">•</span>
        <span className="typing-dot text-zinc-400 text-xl leading-none mx-0.5">•</span>
        <span className="typing-dot text-zinc-400 text-xl leading-none">•</span>
      </div>
    </div>
  )
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={['flex items-end gap-2 mb-2', isUser ? 'flex-row-reverse' : ''].join(' ')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#1D9E75]/15 flex items-center justify-center shrink-0">
          <span className="text-[14px]">🤖</span>
        </div>
      )}
      <div className={[
        'max-w-[78%] px-4 py-2.5 rounded-2xl shadow-sm text-[14px] leading-relaxed',
        isUser
          ? 'bg-[#1D9E75] text-white rounded-br-sm'
          : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-bl-sm',
      ].join(' ')}>
        {msg.text}
      </div>
    </div>
  )
}

// API message format for conversation history
interface ApiMessage {
  role: 'user' | 'assistant'
  content: string
}

function AsistenteView({ medications }: { medications: Medication[] }) {
  const [displayMessages, setDisplayMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [apiHistory, setApiHistory] = useState<ApiMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [quickUsed, setQuickUsed] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMessages, isStreaming, streamingText])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    setInput('')
    setQuickUsed(true)

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: trimmed }
    setDisplayMessages((prev) => [...prev, userMsg])

    const newHistory: ApiMessage[] = [...apiHistory, { role: 'user', content: trimmed }]
    setApiHistory(newHistory)
    setIsStreaming(true)
    setStreamingText('')

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory, medications }),
        signal: abort.signal,
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        setStreamingText(fullText)
      }

      // Commit streaming message to history
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: fullText || 'No pude generar una respuesta. Intentá de nuevo.',
      }
      setDisplayMessages((prev) => [...prev, assistantMsg])
      setApiHistory((prev) => [...prev, { role: 'assistant', content: fullText }])
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'No pude conectarme. Revisá tu conexión e intentá de nuevo.',
      }
      setDisplayMessages((prev) => [...prev, errMsg])
    } finally {
      setIsStreaming(false)
      setStreamingText('')
      abortRef.current = null
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  // Build display list: committed messages + live streaming bubble
  const allMessages = displayMessages

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-8 pb-4 shrink-0">
        <PageHeader title="Asistente" subtitle="Con contexto de tu medicación actual" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {allMessages.map((msg, i) => (
          <div key={msg.id}>
            <ChatBubble msg={msg} />
            {i === 0 && !quickUsed && (
              <div className="flex flex-wrap gap-2 mb-4 pl-9">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-[12px] font-medium px-3 py-1.5 rounded-full
                      border border-zinc-200 dark:border-zinc-700
                      text-zinc-600 dark:text-zinc-300
                      bg-white dark:bg-zinc-800 shadow-sm
                      transition-colors hover:border-[#1D9E75] hover:text-[#1D9E75]
                      active:scale-[0.97]">
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Live streaming bubble */}
        {isStreaming && streamingText === '' && <TypingIndicator />}
        {isStreaming && streamingText !== '' && (
          <ChatBubble
            msg={{ id: 'streaming', role: 'assistant', text: streamingText }}
          />
        )}

        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 px-4 pb-[76px] pt-2 bg-[#F6F5F0]/90 dark:bg-zinc-950/90 backdrop-blur-sm border-t border-zinc-200/60 dark:border-zinc-800/60">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribí tu consulta..."
            className="flex-1 h-11 px-4 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700
              text-[14px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400
              outline-none focus:border-[#1D9E75] transition-colors shadow-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="w-11 h-11 rounded-xl bg-[#1D9E75] text-white flex items-center justify-center
              transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <IconSend />
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px]
      bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md
      border-t border-zinc-200 dark:border-zinc-800
      flex justify-around items-center h-[60px] px-1 z-50">
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id
        return (
          <button key={id} onClick={() => onChange(id)} aria-current={isActive ? 'page' : undefined}
            className={['flex flex-col items-center gap-0.5 flex-1 py-1.5 transition-colors duration-150', isActive ? 'text-[#1D9E75]' : 'text-zinc-400 dark:text-zinc-500'].join(' ')}>
            <Icon active={isActive} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [medications, setMedications] = useState<Medication[]>([])
  const [doses, setDoses] = useState<DoseItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('hoy')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthState(session ? 'authenticated' : 'unauthenticated')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthState(session ? 'authenticated' : 'unauthenticated')
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (authState === 'authenticated' && user) loadData(user.id)
  }, [authState, user])

  async function loadData(userId: string) {
    setDataLoading(true)
    const [{ data: meds }, { data: takenDoses }] = await Promise.all([
      supabase.from('medications').select('*').eq('active', true).eq('user_id', userId).order('created_at'),
      supabase.from('doses').select('medication_id, scheduled_time').eq('date', todayStr()).eq('user_id', userId),
    ])
    const takenSet = new Set<string>(
      (takenDoses ?? []).map((d: { medication_id: string; scheduled_time: string }) => `${d.medication_id}-${d.scheduled_time}`)
    )
    const loadedMeds = (meds ?? []) as Medication[]
    setMedications(loadedMeds)
    setDoses(buildDoses(loadedMeds, takenSet))
    setDataLoading(false)
  }

  async function toggle(doseId: string) {
    if (!user) return
    const dose = doses.find((d) => d.id === doseId)
    if (!dose) return

    setDoses((prev) => prev.map((d) => d.id === doseId ? { ...d, taken: !d.taken } : d))

    if (!dose.taken) {
      await supabase.from('doses').upsert({
        medication_id: dose.medicationId,
        scheduled_time: dose.time,
        date: todayStr(),
        taken_at: new Date().toISOString(),
        user_id: user.id,
      }, { onConflict: 'medication_id,scheduled_time,date' })
    } else {
      await supabase.from('doses')
        .delete()
        .eq('medication_id', dose.medicationId)
        .eq('scheduled_time', dose.time)
        .eq('date', todayStr())
        .eq('user_id', user.id)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setMedications([])
    setDoses([])
    setActiveTab('hoy')
  }

  // Auth loading
  if (authState === 'loading') {
    return (
      <div className="min-h-dvh bg-[#F6F5F0] dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-[3px] border-[#1D9E75]/20 border-t-[#1D9E75] spinner" />
      </div>
    )
  }

  if (authState === 'unauthenticated') {
    return <LoginView />
  }

  // Data loading (first load after login)
  if (dataLoading && medications.length === 0) {
    return (
      <div className="min-h-dvh bg-[#F6F5F0] dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-[3px] border-[#1D9E75]/20 border-t-[#1D9E75] spinner" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#F6F5F0] dark:bg-zinc-950 flex justify-center">
      <div className="w-full max-w-[390px] flex flex-col min-h-dvh">
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'hoy'        && <HoyView medications={medications} doses={doses} onToggle={toggle} />}
          {activeTab === 'medicacion' && <MedicacionView medications={medications} userId={user!.id} onRefresh={() => loadData(user!.id)} onSignOut={handleSignOut} />}
          {activeTab === 'escanear'   && <ScanView />}
          {activeTab === 'asistente'  && <AsistenteView medications={medications} />}
        </main>
        <TabBar active={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  )
}
