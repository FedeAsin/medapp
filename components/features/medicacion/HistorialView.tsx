'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { buildCalendarCells, todayStr, WEEKDAY_LABELS } from '../../../lib/helpers'
import { Spinner } from '../../ui/Spinner'

export function HistorialView({ userId }: { userId: string }) {
  const [countByDate, setCountByDate] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const cells = buildCalendarCells()

  useEffect(() => {
    async function fetchHistory() {
      const from = cells.find((c) => c !== null)?.date ?? todayStr()
      const { data } = await supabase.from('doses').select('date').eq('user_id', userId).gte('date', from)
      const map = new Map<string, number>()
      for (const d of data ?? []) map.set(d.date, (map.get(d.date) ?? 0) + 1)
      setCountByDate(map)
      setLoading(false)
    }
    fetchHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

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

  const rows: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

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
      <div className="flex gap-3 mb-5">
        <div className="flex-1 bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[length:var(--fs-display)] font-bold text-primary">{streak}</p>
          <p className="text-[length:var(--fs-overline)] font-medium text-zinc-400 uppercase tracking-wide mt-0.5">día{streak !== 1 ? 's' : ''} racha</p>
        </div>
        <div className="flex-1 bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[length:var(--fs-display)] font-bold text-zinc-800 dark:text-zinc-100">{totalMonth}</p>
          <p className="text-[length:var(--fs-overline)] font-medium text-zinc-400 uppercase tracking-wide mt-0.5">dosis este mes</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-sm">
        <p className="text-[length:var(--fs-caption)] font-semibold text-zinc-500 dark:text-zinc-400 capitalize mb-3">{monthLabel}</p>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-zinc-400">{d}</div>
          ))}
        </div>

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
