// ─── Types ────────────────────────────────────────────────────────────────────

export interface Medication {
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

export interface DoseItem {
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

// ─── Constants ────────────────────────────────────────────────────────────────

export const STOCK_MAX = 30

export const PRESET_COLORS = [
  '#1D9E75', '#378ADD', '#D85A30', '#BA7517',
  '#9B59B6', '#E74C3C', '#2ECC71', '#F39C12',
]

export const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export const FRANJAS = [
  { key: 'mañana', label: 'Mañana', emoji: '🌅', from: 0,  to: 12 },
  { key: 'tarde',  label: 'Tarde',  emoji: '☀️', from: 12, to: 18 },
  { key: 'noche',  label: 'Noche',  emoji: '🌙', from: 18, to: 24 },
] as const

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getGreeting(name?: string): string {
  const h = new Date().getHours()
  const suffix = name ? `, ${name}` : ''
  if (h >= 6 && h < 12) return `Buenos días${suffix}`
  if (h >= 12 && h < 20) return `Buenas tardes${suffix}`
  return `Buenas noches${suffix}`
}

export function getDateLabel(): string {
  const raw = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function nameFromEmail(email?: string | null): string {
  if (!email) return ''
  const prefix = email.split('@')[0]
  const first = prefix.split(/[._-]/)[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

// ─── Dose helpers ─────────────────────────────────────────────────────────────

export function isLate(time: string): boolean {
  const [h, m] = time.split(':').map(Number)
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes() > h * 60 + m
}

export function getFranja(time: string): string {
  const h = parseInt(time.split(':')[0])
  if (h < 12) return 'mañana'
  if (h < 18) return 'tarde'
  return 'noche'
}

export function frequencyLabel(times: string[]): string {
  const n = times.length
  return n === 1 ? '1 vez al día' : `${n} veces al día`
}

export function buildDoses(medications: Medication[], takenSet: Set<string>): DoseItem[] {
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

// ─── Calendar helpers ─────────────────────────────────────────────────────────

export function buildCalendarCells(): Array<{ date: string; isToday: boolean } | null> {
  const today = new Date()
  const todayIso = today.toISOString().split('T')[0]
  const todayDow = (today.getDay() + 6) % 7

  const cells: Array<{ date: string; isToday: boolean } | null> = []
  const totalPast = todayDow + 28

  for (let i = totalPast; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    cells.push({ date: d.toISOString().split('T')[0], isToday: i === 0 })
  }

  const rem = cells.length % 7
  if (rem !== 0) for (let i = 0; i < 7 - rem; i++) cells.push(null)

  return cells
}
