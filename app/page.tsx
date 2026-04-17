'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Medication {
  id: string
  name: string
  dose: string
  times: string[]
  instructions?: string
  stock: number
  minStock: number
  color: string
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

// ─── Mock data ────────────────────────────────────────────────────────────────

const MEDICATIONS: Medication[] = [
  { id: 'enalapril',  name: 'Enalapril',   dose: '10mg',     times: ['08:00'],         instructions: 'Tomar en ayunas',             stock: 12, minStock: 10, color: '#1D9E75' },
  { id: 'metformina', name: 'Metformina',  dose: '850mg',    times: ['08:00', '21:00'], instructions: 'Tomar con comida',            stock: 24, minStock: 10, color: '#378ADD' },
  { id: 'omeprazol',  name: 'Omeprazol',   dose: '20mg',     times: ['07:30'],         instructions: '30 min antes del desayuno',   stock: 3,  minStock: 10, color: '#D85A30' },
  { id: 'vitamina-d', name: 'Vitamina D',  dose: '1000 UI',  times: ['12:00'],         instructions: undefined,                     stock: 30, minStock: 10, color: '#BA7517' },
]

const LOW_STOCK   = MEDICATIONS.filter((m) => m.stock < m.minStock)
const STOCK_MAX   = 30

const SCAN_RESULT = { comercial: 'Losartán', activo: 'Losartán potásico', dosis: '50mg', laboratorio: 'Roemmers' }

const QUICK_QUESTIONS = ['¿Puedo tomar ibuprofeno?', '¿Qué hace el Enalapril?', 'Olvidé una dosis']

const INITIAL_MESSAGES: ChatMessage[] = [{
  id: 'init',
  role: 'assistant',
  text: 'Hola, soy tu asistente de medicación. Tengo acceso a tu lista de medicamentos y puedo ayudarte con dudas. ¿En qué puedo ayudarte?',
}]

function buildDoses(): DoseItem[] {
  const items: DoseItem[] = []
  for (const med of MEDICATIONS)
    for (const time of med.times)
      items.push({ id: `${med.id}-${time}`, medicationId: med.id, name: med.name, dose: med.dose, time, instructions: med.instructions, color: med.color, taken: false })
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const lowStock = med.stock < med.minStock
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

// ─── HOY view ─────────────────────────────────────────────────────────────────

function HoyView({ doses, onToggle }: { doses: DoseItem[]; onToggle: (id: string) => void }) {
  const [header, setHeader] = useState({ greeting: '', date: '' })
  useEffect(() => { setHeader({ greeting: getGreeting(), date: getDateLabel() }) }, [])
  const taken = doses.filter((d) => d.taken)
  const pending = doses.filter((d) => !d.taken)
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

      {LOW_STOCK.length > 0 && (
        <section className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 mb-3 flex gap-3 items-start">
          <span className="text-[18px] leading-none mt-0.5" aria-hidden>⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-400 mb-0.5">Stock bajo</p>
            {LOW_STOCK.map((m) => (
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

function MedicacionView() {
  return (
    <div className="flex-1 overflow-y-auto pb-28 px-4 pt-8">
      <PageHeader title="Mi medicación" subtitle={`${MEDICATIONS.length} medicamentos activos`} />
      <div className="flex flex-col gap-3 mb-4">
        {MEDICATIONS.map((med) => <MedicationCard key={med.id} med={med} />)}
      </div>
      <button className="w-full py-4 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 text-[14px] font-medium flex items-center justify-center gap-2 transition-colors hover:border-[#1D9E75] hover:text-[#1D9E75] active:scale-[0.98]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        Agregar medicamento
      </button>
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
          {/* success banner */}
          <div className="bg-[#1D9E75]/10 border border-[#1D9E75]/25 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1D9E75] flex items-center justify-center shrink-0">
              <IconCheck />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#1D9E75]">Medicamento identificado</p>
              <p className="text-[12px] text-[#1D9E75]/70">Revisá los datos antes de confirmar</p>
            </div>
          </div>

          {/* result card */}
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

          {/* actions */}
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

function AsistenteView() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [quickUsed, setQuickUsed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isTyping) return
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', text: trimmed }])
    setInput('')
    setQuickUsed(true)
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: getResponse(trimmed) }])
    }, 1800)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  const userCount = messages.filter((m) => m.role === 'user').length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* fixed header */}
      <div className="px-4 pt-8 pb-4 shrink-0">
        <PageHeader title="Asistente" subtitle="Tiene contexto de tu medicación actual" />
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {messages.map((msg, i) => (
          <div key={msg.id}>
            <ChatBubble msg={msg} />
            {/* quick questions appear after the first assistant message, before any user reply */}
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
        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* input bar — sits above tab bar (tab bar is fixed h-[60px]) */}
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
            disabled={!input.trim() || isTyping}
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
  const [doses, setDoses] = useState<DoseItem[]>(buildDoses)
  const [activeTab, setActiveTab] = useState('hoy')

  function toggle(id: string) {
    setDoses((prev) => prev.map((d) => (d.id === id ? { ...d, taken: !d.taken } : d)))
  }

  return (
    <div className="min-h-dvh bg-[#F6F5F0] dark:bg-zinc-950 flex justify-center">
      <div className="w-full max-w-[390px] flex flex-col min-h-dvh">
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'hoy'        && <HoyView doses={doses} onToggle={toggle} />}
          {activeTab === 'medicacion' && <MedicacionView />}
          {activeTab === 'escanear'   && <ScanView />}
          {activeTab === 'asistente'  && <AsistenteView />}
        </main>
        <TabBar active={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  )
}
