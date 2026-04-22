'use client'

import { useState, useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/ui/Spinner'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'

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
  status: 'pending' | 'taken' | 'late'
}

interface ScanResult {
  name?: string
  dose?: string
  activeIngredient?: string
  laboratory?: string
  instructions?: string
  error?: string
}

type ScanState = 'idle' | 'loading' | 'result' | 'error'
type AuthState = 'loading' | 'unauthenticated' | 'authenticated'

// ─── Constants ────────────────────────────────────────────────────────────────

const STOCK_MAX = 30

const PRESET_COLORS = ['#1D9E75', '#378ADD', '#D85A30', '#BA7517', '#9B59B6', '#E74C3C', '#2ECC71', '#F39C12']

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isLate(time: string): boolean {
  const [h, m] = time.split(':').map(Number)
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes() > h * 60 + m
}

function buildDoses(medications: Medication[], takenSet: Set<string>): DoseItem[] {
  const items: DoseItem[] = []
  for (const med of medications)
    for (const time of med.times) {
      const taken = takenSet.has(`${med.id}-${time}`)
      items.push({
        id: `${med.id}-${time}`,
        medicationId: med.id,
        name: med.name,
        dose: med.dose,
        time,
        instructions: med.instructions,
        color: med.color,
        taken,
        status: taken ? 'taken' : isLate(time) ? 'late' : 'pending',
      })
    }
  return items.sort((a, b) => a.time.localeCompare(b.time))
}

function frequencyLabel(times: string[]): string {
  const n = times.length
  return n === 1 ? '1 vez al día' : `${n} veces al día`
}

// ─── Franja horaria ───────────────────────────────────────────────────────────

const FRANJAS = [
  { key: 'mañana', label: 'Mañana',  emoji: '🌅', from: 0,  to: 12 },
  { key: 'tarde',  label: 'Tarde',   emoji: '☀️', from: 12, to: 18 },
  { key: 'noche',  label: 'Noche',   emoji: '🌙', from: 18, to: 24 },
] as const

function getFranja(time: string): string {
  const h = parseInt(time.split(':')[0])
  if (h < 12) return 'mañana'
  if (h < 18) return 'tarde'
  return 'noche'
}

// ─── Notifications ────────────────────────────────────────────────────────────

function scheduleNotifications(doses: DoseItem[]) {
  const now = new Date()
  for (const dose of doses) {
    if (dose.taken) continue
    const [h, m] = dose.time.split(':').map(Number)
    const doseTime = new Date()
    doseTime.setHours(h, m, 0, 0)
    const msUntil = doseTime.getTime() - now.getTime()
    if (msUntil < 0) continue

    setTimeout(() => {
      const title = `💊 Hora de tomar ${dose.name}`
      const body = `${dose.dose}${dose.instructions ? ' — ' + dose.instructions : ''}`
      const icon = '/icons/icon-192.png'
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title, options: { body, icon, badge: icon, tag: dose.id } })
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon, tag: dose.id })
      }
    }, msUntil)
  }
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

// Calendar: build grid cells for last ~5 weeks aligned to Mon-Sun
function buildCalendarCells(): Array<{ date: string; isToday: boolean } | null> {
  const today = new Date()
  const todayIso = today.toISOString().split('T')[0]
  const todayDow = (today.getDay() + 6) % 7 // 0=Mon … 6=Sun

  // Go back to Monday of 4 complete weeks ago
  const cells: Array<{ date: string; isToday: boolean } | null> = []
  const totalPast = todayDow + 28 // cells from that Monday to today (inclusive)

  for (let i = totalPast; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    cells.push({ date: d.toISOString().split('T')[0], isToday: i === 0 })
  }

  // Pad right with nulls to fill last row
  const rem = cells.length % 7
  if (rem !== 0) for (let i = 0; i < 7 - rem; i++) cells.push(null)

  return cells
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
function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
}
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
}
function IconCheck() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
}
function IconCamera() {
  return <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
}

const TABS = [
  { id: 'hoy',        label: 'Hoy',        Icon: IconCalendar },
  { id: 'medicacion', label: 'Medicación', Icon: IconPill },
  { id: 'escanear',   label: 'Escanear',   Icon: IconScan },
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

const inputCls = 'w-full h-11 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[14px] text-zinc-800 dark:text-zinc-100 outline-none focus:border-primary transition-colors'

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

// ─── Login / Register ─────────────────────────────────────────────────────────

function LoginView() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    if (!email.trim() || !password) { setError('Completá email y contraseña.'); return }
    setLoading(true)
    if (isSignUp) {
      const { error: err } = await supabase.auth.signUp({ email: email.trim(), password })
      if (err) setError(err.message)
      else setSuccessMsg('Revisá tu email para confirmar la cuenta.')
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-dvh bg-bg dark:bg-zinc-950 flex items-center justify-center px-5">
      <div className="w-full max-w-[360px]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7.07-7.07l7 7a5 5 0 0 1-7.07 7.07Z" /><line x1="8.5" y1="11.5" x2="15.5" y2="11.5" /></svg>
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">MedApp</h1>
          <p className="text-[14px] text-zinc-400 dark:text-zinc-500 mt-1">Tu medicación, organizada</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm">
          <h2 className="text-[17px] font-semibold text-zinc-800 dark:text-zinc-100 mb-5">{isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" autoComplete="email" className={inputCls} /></Field>
            <Field label="Contraseña"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isSignUp ? 'Mínimo 6 caracteres' : '••••••••'} autoComplete={isSignUp ? 'new-password' : 'current-password'} className={inputCls} /></Field>
            {error && <p className="text-[13px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl px-3 py-2.5">{error}</p>}
            {successMsg && <p className="text-[13px] text-primary bg-primary/8 border border-primary/25 rounded-xl px-3 py-2.5">{successMsg}</p>}
            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-primary text-white text-[15px] font-semibold mt-1 transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm">
              {loading ? 'Cargando…' : isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
        <p className="text-center text-[13px] text-zinc-400 dark:text-zinc-500 mt-5">
          {isSignUp ? '¿Ya tenés cuenta?' : '¿No tenés cuenta?'}{' '}
          <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMsg('') }} className="text-primary font-semibold">{isSignUp ? 'Iniciar sesión' : 'Crear cuenta'}</button>
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
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="var(--clr-primary)" strokeWidth={SW} strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-bold leading-none text-zinc-800 dark:text-zinc-100">{taken}<span className="text-sm font-normal text-zinc-400">/{total}</span></span>
        <span className="text-[11px] text-zinc-400 mt-0.5">dosis</span>
      </div>
    </div>
  )
}

// ─── Dose card ────────────────────────────────────────────────────────────────

function DoseCard({ dose, onToggle }: { dose: DoseItem; onToggle: (id: string) => void }) {
  const late = dose.status === 'late'
  return (
    <div className={[
      'rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3 transition-opacity duration-300',
      dose.taken ? 'opacity-45 bg-white dark:bg-zinc-800' : late ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50' : 'bg-white dark:bg-zinc-800',
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
          {dose.instructions && !late && <><span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span><span className="text-xs text-zinc-400 truncate">{dose.instructions}</span></>}
        </div>
      </div>
      <button onClick={() => onToggle(dose.id)} aria-label={dose.taken ? 'Marcar como pendiente' : 'Marcar como tomada'}
        className={[
          'shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95',
          dose.taken ? 'bg-primary text-white shadow-sm' : late ? 'border-2 border-amber-400 dark:border-amber-500' : 'border-2 border-zinc-200 dark:border-zinc-600 hover:border-primary',
        ].join(' ')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={dose.taken ? 'white' : late ? '#f59e0b' : '#d1d5db'} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      </button>
    </div>
  )
}

// ─── Medication card ──────────────────────────────────────────────────────────

function MedicationCard({ med, onEdit, onDelete }: {
  med: Medication
  onEdit: (med: Medication) => void
  onDelete: (id: string) => void
}) {
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
            <span className="text-[15px] font-semibold text-zinc-800 dark:text-zinc-100">{med.name}</span>
            <span className="text-[13px] text-zinc-500 dark:text-zinc-400">{med.dose}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[12px] text-zinc-400">🔄 {frequencyLabel(med.times)}</span>
            {med.times.length > 1 && <><span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span><span className="text-[12px] text-zinc-400">{med.times.join(', ')}</span></>}
          </div>
          {med.instructions && <p className="text-[12px] text-zinc-400 mt-0.5 leading-snug">📋 {med.instructions}</p>}
        </div>
        {/* Edit / Delete */}
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(med)} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-[#378ADD] hover:bg-[#378ADD]/10 transition-colors" aria-label="Editar">
            <IconEdit />
          </button>
          <button onClick={() => setConfirmDelete(true)} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" aria-label="Eliminar">
            <IconTrash />
          </button>
        </div>
      </div>

      {/* Stock bar */}
      <div className="mt-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Stock</span>
          <span className={['text-[12px] font-semibold', lowStock ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-300'].join(' ')}>
            {med.stock} unidades{lowStock && <span className="ml-1 text-[10px] font-medium">⚠ bajo</span>}
          </span>
        </div>
        <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div className={['h-full rounded-full transition-all duration-500', lowStock ? 'bg-red-400' : 'bg-primary'].join(' ')} style={{ width: `${pct * 100}%` }} />
        </div>
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-700 flex items-center justify-between">
          <p className="text-[13px] text-zinc-600 dark:text-zinc-300">¿Eliminar este medicamento?</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="text-[12px] font-medium text-zinc-400 px-3 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
            <button onClick={() => onDelete(med.id)} className="text-[12px] font-medium text-white bg-red-500 px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors">Eliminar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add / Edit med form ──────────────────────────────────────────────────────

interface MedFormData {
  name: string; dose: string; times: string[]; instructions: string
  stock: string; stock_min: string; color: string
}

function MedSheet({ userId, editMed, onClose, onSaved }: {
  userId: string
  editMed?: Medication | Partial<Medication>
  onClose: () => void
  onSaved: () => void
}) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-[390px] bg-white dark:bg-zinc-900 rounded-t-3xl px-5 pt-5 pb-10 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mx-auto mb-5" />
        <h2 className="text-[18px] font-bold text-zinc-800 dark:text-zinc-100 mb-5">{isEdit ? 'Editar medicamento' : 'Agregar medicamento'}</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Nombre"><input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Ej: Enalapril" className={inputCls} /></Field>
          <Field label="Dosis"><input value={form.dose} onChange={(e) => setField('dose', e.target.value)} placeholder="Ej: 10mg" className={inputCls} /></Field>

          <Field label="Horarios">
            <div className="flex flex-col gap-2">
              {form.times.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="time" value={t} onChange={(e) => setTime(i, e.target.value)} className={inputCls + ' flex-1'} />
                  {form.times.length > 1 && <button type="button" onClick={() => removeTime(i)} className="text-red-400 text-[20px] leading-none w-8 h-8 flex items-center justify-center">×</button>}
                </div>
              ))}
              <button type="button" onClick={addTime} className="text-[13px] text-primary font-medium text-left">+ Agregar horario</button>
            </div>
          </Field>

          <Field label="Instrucciones (opcional)"><input value={form.instructions} onChange={(e) => setField('instructions', e.target.value)} placeholder="Ej: Tomar con comida" className={inputCls} /></Field>

          <div className="flex gap-3">
            <Field label="Stock" className="flex-1"><input type="number" min="0" value={form.stock} onChange={(e) => setField('stock', e.target.value)} className={inputCls} /></Field>
            <Field label="Stock mínimo" className="flex-1"><input type="number" min="0" value={form.stock_min} onChange={(e) => setField('stock_min', e.target.value)} className={inputCls} /></Field>
          </div>

          <Field label="Color">
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setField('color', c)} className="w-8 h-8 rounded-full transition-transform active:scale-95" style={{ backgroundColor: c, outline: form.color === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
              ))}
            </div>
          </Field>

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <button type="submit" disabled={saving} className="w-full py-3.5 rounded-xl bg-primary text-white text-[15px] font-semibold mt-1 transition-all active:scale-[0.98] disabled:opacity-50">
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar medicamento'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Historial (calendar heatmap) ─────────────────────────────────────────────

function HistorialView({ userId }: { userId: string }) {
  const [countByDate, setCountByDate] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const cells = buildCalendarCells()

  useEffect(() => {
    async function fetchHistory() {
      // from = oldest cell date
      const from = cells.find((c) => c !== null)?.date ?? todayStr()
      const { data } = await supabase
        .from('doses')
        .select('date')
        .eq('user_id', userId)
        .gte('date', from)

      const map = new Map<string, number>()
      for (const d of data ?? []) map.set(d.date, (map.get(d.date) ?? 0) + 1)
      setCountByDate(map)
      setLoading(false)
    }
    fetchHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Streak: consecutive days ending today where count > 0
  const streak = (() => {
    let s = 0
    const today = new Date()
    for (let i = 0; i < 90; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      if ((countByDate.get(d.toISOString().split('T')[0]) ?? 0) > 0) s++
      else break
    }
    return s
  })()

  const totalMonth = (() => {
    let t = 0
    const today = new Date()
    for (let i = 0; i < 30; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      t += countByDate.get(d.toISOString().split('T')[0]) ?? 0
    }
    return t
  })()

  function cellColor(count: number): string {
    if (count === 0) return 'bg-zinc-100 dark:bg-zinc-700/60'
    if (count === 1) return 'bg-primary/25'
    if (count <= 3) return 'bg-primary/55'
    return 'bg-primary'
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Spinner size="sm" />
    </div>
  )

  // Split cells into rows of 7
  const rows: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  // Find which month(s) are covered to show labels
  const monthLabel = (() => {
    const dates = cells.filter(Boolean).map((c) => c!.date)
    if (!dates.length) return ''
    const first = new Date(dates[0])
    const last = new Date(dates[dates.length - 1])
    const fmt = (d: Date) => d.toLocaleDateString('es-AR', { month: 'long' })
    return first.getMonth() === last.getMonth() ? fmt(last) : `${fmt(first)} – ${fmt(last)}`
  })()

  return (
    <div className="px-4 pb-28 pt-2">
      {/* Stats */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[26px] font-bold text-primary">{streak}</p>
          <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mt-0.5">día{streak !== 1 ? 's' : ''} racha</p>
        </div>
        <div className="flex-1 bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[26px] font-bold text-zinc-800 dark:text-zinc-100">{totalMonth}</p>
          <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mt-0.5">dosis este mes</p>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-sm">
        <p className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 capitalize mb-3">{monthLabel}</p>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-zinc-400">{d}</div>
          ))}
        </div>

        {/* Calendar rows */}
        {rows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-1 mb-1">
            {row.map((cell, ci) => {
              if (!cell) return <div key={ci} className="aspect-square rounded-md" />
              const count = countByDate.get(cell.date) ?? 0
              return (
                <div key={ci}
                  className={['aspect-square rounded-md transition-all', cellColor(count), cell.isToday ? 'ring-2 ring-primary ring-offset-1' : ''].join(' ')}
                  title={`${cell.date}: ${count} dosis`}
                />
              )
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-[10px] text-zinc-400">Menos</span>
          {['bg-zinc-100 dark:bg-zinc-700/60', 'bg-primary/25', 'bg-primary/55', 'bg-primary'].map((c, i) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
          ))}
          <span className="text-[10px] text-zinc-400">Más</span>
        </div>
      </div>
    </div>
  )
}

// ─── HOY view ─────────────────────────────────────────────────────────────────

function HoyView({
  medications, doses, onToggle, notifPermission, onRequestNotifPermission,
}: {
  medications: Medication[]
  doses: DoseItem[]
  onToggle: (id: string) => void
  notifPermission: NotificationPermission | null
  onRequestNotifPermission: () => void
}) {
  const [header, setHeader] = useState({ greeting: '', date: '' })
  useEffect(() => { setHeader({ greeting: getGreeting(), date: getDateLabel() }) }, [])

  const taken = doses.filter((d) => d.taken)
  const pending = doses.filter((d) => !d.taken)
  const lateCount = pending.filter((d) => d.status === 'late').length
  const lowStock = medications.filter((m) => m.stock < m.stock_min)

  // Group pending doses by franja horaria
  const franjaGroups = FRANJAS.map((f) => ({
    ...f,
    doses: pending.filter((d) => getFranja(d.time) === f.key),
  })).filter((f) => f.doses.length > 0)

  return (
    <div className="flex-1 overflow-y-auto pb-28 px-4 pt-8">
      <PageHeader title={header.greeting || '\u00A0'} subtitle={header.date || '\u00A0'} />

      {/* Notification permission banner — only show if not yet decided */}
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

      {/* Progress card */}
      <section className="bg-white dark:bg-zinc-800 rounded-2xl p-5 mb-3 shadow-sm flex items-center gap-5">
        <ProgressRing taken={taken.length} total={doses.length} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1">Progreso del día</p>
          <p className="text-[15px] font-medium text-zinc-700 dark:text-zinc-200 leading-snug">
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

      {/* Low stock alert */}
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

      {/* Pending doses grouped by franja */}
      {franjaGroups.map((franja) => (
        <section key={franja.key} className="mb-4">
          <SectionLabel>{franja.emoji} {franja.label}</SectionLabel>
          <div className="flex flex-col gap-2">
            {franja.doses.map((d) => <DoseCard key={d.id} dose={d} onToggle={onToggle} />)}
          </div>
        </section>
      ))}

      {/* Taken doses */}
      {taken.length > 0 && (
        <section className="mb-3">
          <SectionLabel>✅ Tomadas</SectionLabel>
          <div className="flex flex-col gap-2">
            {taken.map((d) => <DoseCard key={d.id} dose={d} onToggle={onToggle} />)}
          </div>
        </section>
      )}

      {/* Empty state */}
      {doses.length === 0 && (
        <div className="text-center py-12 text-zinc-400 dark:text-zinc-600">
          <p className="text-[15px]">No tenés medicamentos cargados</p>
          <p className="text-[13px] mt-1">Agregá uno en la pestaña Medicación</p>
        </div>
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
  const [view, setView] = useState<'list' | 'historial'>('list')
  const [sheetMed, setSheetMed] = useState<Medication | Partial<Medication> | null>(null) // null = closed, {} = new, med = edit

  async function handleDelete(id: string) {
    await supabase.from('medications').update({ active: false }).eq('id', id).eq('user_id', userId)
    onRefresh()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-8 pb-4 shrink-0">
        <div className="flex items-start justify-between mb-4">
          <header>
            <p className="text-[13px] text-zinc-400 dark:text-zinc-500 mb-0.5">{`${medications.length} activo${medications.length !== 1 ? 's' : ''}`}</p>
            <h1 className="text-[26px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">Mi medicación</h1>
          </header>
          <button onClick={onSignOut} className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors" aria-label="Cerrar sesión">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            Salir
          </button>
        </div>

        {/* Toggle */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 gap-1">
          {(['list', 'historial'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={['flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all', view === v ? 'bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'].join(' ')}>
              {v === 'list' ? 'Medicamentos' : 'Historial'}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' ? (
        <div className="flex-1 overflow-y-auto px-4 pb-28">
          <div className="flex flex-col gap-3 mb-4">
            {medications.map((med) => (
              <MedicationCard key={med.id} med={med} onEdit={(m) => setSheetMed(m)} onDelete={handleDelete} />
            ))}
          </div>
          <button onClick={() => setSheetMed({})} className="w-full py-4 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 text-[14px] font-medium flex items-center justify-center gap-2 transition-colors hover:border-primary hover:text-primary active:scale-[0.98]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
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

// ─── ESCANEAR view ────────────────────────────────────────────────────────────

function ScanView({ userId, onMedAdded }: { userId: string; onMedAdded: () => void }) {
  const [state, setState] = useState<ScanState>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return
    setState('loading')
    setResult(null)
    setPreview(URL.createObjectURL(file))

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string
          resolve(dataUrl.split(',')[1])
        }
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
      setResult(data)
      setState('result')
    } catch {
      setState('error')
      setResult({ error: 'No se pudo analizar la imagen. Intentá de nuevo.' })
    }
  }

  function reset() {
    setState('idle')
    setPreview(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Pre-fill data from scan result for MedSheet
  const scanInitial: Partial<Medication> | undefined = result && !result.error ? {
    name: result.name ?? '',
    dose: result.dose ?? '',
    instructions: [result.activeIngredient, result.laboratory].filter(Boolean).join(' — ') || result.instructions || '',
  } : undefined

  return (
    <div className="flex-1 overflow-y-auto pb-28 px-4 pt-8">
      <PageHeader title="Escanear medicamento" subtitle="Sacá una foto de la caja y la IA completa los datos" />

      {/* Hidden file input — capture=environment opens camera on mobile */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

      {state === 'idle' && (
        <button onClick={() => fileInputRef.current?.click()}
          className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-800/60 transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.99] shadow-sm">
          <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center"><IconCamera /></div>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-zinc-600 dark:text-zinc-300">Tocar para sacar foto</p>
            <p className="text-[12px] text-zinc-400 mt-0.5">Se abre la cámara del celular</p>
          </div>
        </button>
      )}

      {(state === 'loading' || preview) && state !== 'result' && state !== 'error' && (
        <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden relative shadow-sm bg-zinc-100 dark:bg-zinc-800">
          {preview && <img src={preview} alt="Preview" className="w-full h-full object-cover" />}
          {state === 'loading' && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3">
              <Spinner variant="white" />
              <p className="text-white text-[14px] font-medium">Analizando con IA…</p>
            </div>
          )}
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col gap-3">
          {preview && <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-sm"><img src={preview} alt="Preview" className="w-full h-full object-cover opacity-50" /></div>}
          <Alert
            variant="error"
            icon="❌"
            title="No se pudo identificar"
            description={result?.error}
          />
          <button onClick={reset} className="w-full py-3.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 text-[14px] font-semibold text-zinc-600 dark:text-zinc-300 active:scale-[0.98]">Intentar de nuevo</button>
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
            {[
              { label: 'Nombre comercial', value: result.name },
              { label: 'Principio activo', value: result.activeIngredient },
              { label: 'Dosis', value: result.dose },
              { label: 'Laboratorio', value: result.laboratory },
              { label: 'Instrucciones', value: result.instructions },
            ].filter(({ value }) => value).map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between py-3.5 gap-4">
                <span className="text-[13px] text-zinc-400 shrink-0">{label}</span>
                <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100 text-right">{value}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2.5 mt-1">
            <button onClick={reset} className="flex-1 py-3.5 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 text-[14px] font-semibold text-zinc-600 dark:text-zinc-300 active:scale-[0.98]">Reintentar</button>
            <button onClick={() => setShowAddForm(true)} className="flex-1 py-3.5 rounded-xl bg-primary text-white text-[14px] font-semibold active:scale-[0.98] shadow-sm">Agregar a mis meds</button>
          </div>
        </div>
      )}

      {showAddForm && scanInitial && (
        <MedSheet userId={userId} editMed={scanInitial} onClose={() => setShowAddForm(false)} onSaved={() => { setShowAddForm(false); reset(); onMedAdded() }} />
      )}
    </div>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 flex justify-around items-center h-[60px] px-1 z-50">
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id
        return (
          <button key={id} onClick={() => onChange(id)} aria-current={isActive ? 'page' : undefined}
            className={['flex flex-col items-center gap-0.5 flex-1 py-1.5 transition-colors duration-150', isActive ? 'text-primary' : 'text-zinc-400 dark:text-zinc-500'].join(' ')}>
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
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null)

  // Register Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    if ('Notification' in window) {
      setNotifPermission(Notification.permission)
    }
  }, [])

  // Schedule notifications whenever doses change
  useEffect(() => {
    if (notifPermission === 'granted' && doses.length > 0) {
      scheduleNotifications(doses)
    }
  }, [doses, notifPermission])

  async function requestNotifPermission() {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifPermission(perm)
    if (perm === 'granted') scheduleNotifications(doses)
  }

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
    const med = medications.find((m) => m.id === dose.medicationId)

    const wasTaken = dose.taken

    // Optimistic UI
    setDoses((prev) => prev.map((d) => d.id === doseId ? { ...d, taken: !wasTaken } : d))

    if (!wasTaken) {
      // Mark as taken + decrement stock
      const newStock = med ? Math.max(0, med.stock - 1) : 0
      await Promise.all([
        supabase.from('doses').upsert({
          medication_id: dose.medicationId,
          scheduled_time: dose.time,
          date: todayStr(),
          taken_at: new Date().toISOString(),
          user_id: user.id,
        }, { onConflict: 'medication_id,scheduled_time,date' }),
        med && supabase.from('medications').update({ stock: newStock }).eq('id', med.id).eq('user_id', user.id),
      ])
      if (med) setMedications((prev) => prev.map((m) => m.id === med.id ? { ...m, stock: newStock } : m))
    } else {
      // Un-mark + restore stock
      const newStock = med ? med.stock + 1 : 0
      await Promise.all([
        supabase.from('doses').delete().eq('medication_id', dose.medicationId).eq('scheduled_time', dose.time).eq('date', todayStr()).eq('user_id', user.id),
        med && supabase.from('medications').update({ stock: newStock }).eq('id', med.id).eq('user_id', user.id),
      ])
      if (med) setMedications((prev) => prev.map((m) => m.id === med.id ? { ...m, stock: newStock } : m))
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setMedications([]); setDoses([]); setActiveTab('hoy')
  }

  if (authState === 'loading' || (dataLoading && medications.length === 0)) {
    return (
      <div className="min-h-dvh bg-bg dark:bg-zinc-950 flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (authState === 'unauthenticated') return <LoginView />

  return (
    <div className="min-h-dvh bg-bg dark:bg-zinc-950 flex justify-center">
      <div className="w-full max-w-[390px] flex flex-col min-h-dvh">
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'hoy'        && <HoyView medications={medications} doses={doses} onToggle={toggle} notifPermission={notifPermission} onRequestNotifPermission={requestNotifPermission} />}
          {activeTab === 'medicacion' && <MedicacionView medications={medications} userId={user!.id} onRefresh={() => loadData(user!.id)} onSignOut={handleSignOut} />}
          {activeTab === 'escanear'   && <ScanView userId={user!.id} onMedAdded={() => loadData(user!.id)} />}
        </main>
        <TabBar active={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  )
}
