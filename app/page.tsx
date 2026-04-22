'use client'

import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { buildDoses, todayStr, nameFromEmail } from '../lib/helpers'
import type { Medication, DoseItem } from '../lib/helpers'
import { scheduleNotifications } from '../lib/notifications'
import { Spinner } from '../components/ui/Spinner'
import { LoginView } from '../components/features/auth/LoginView'
import { HoyView } from '../components/features/hoy/HoyView'
import { MedicacionView } from '../components/features/medicacion/MedicacionView'
import { ScanView } from '../components/features/scan/ScanView'
import { TabBar } from '../components/layout/TabBar'

type AuthState = 'loading' | 'unauthenticated' | 'authenticated'

export default function HomePage() {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [medications, setMedications] = useState<Medication[]>([])
  const [doses, setDoses] = useState<DoseItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('hoy')
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
    if ('Notification' in window) setNotifPermission(Notification.permission)
  }, [])

  useEffect(() => {
    if (notifPermission === 'granted' && doses.length > 0) scheduleNotifications(doses)
  }, [doses, notifPermission])

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

    setDoses((prev) => prev.map((d) => d.id === doseId ? { ...d, taken: !wasTaken } : d))

    if (!wasTaken) {
      const newStock = med ? Math.max(0, med.stock - 1) : 0
      await Promise.all([
        supabase.from('doses').upsert({
          medication_id: dose.medicationId, scheduled_time: dose.time,
          date: todayStr(), taken_at: new Date().toISOString(), user_id: user.id,
        }, { onConflict: 'medication_id,scheduled_time,date' }),
        med && supabase.from('medications').update({ stock: newStock }).eq('id', med.id).eq('user_id', user.id),
      ])
      if (med) setMedications((prev) => prev.map((m) => m.id === med.id ? { ...m, stock: newStock } : m))
    } else {
      const newStock = med ? med.stock + 1 : 0
      await Promise.all([
        supabase.from('doses').delete().eq('medication_id', dose.medicationId).eq('scheduled_time', dose.time).eq('date', todayStr()).eq('user_id', user.id),
        med && supabase.from('medications').update({ stock: newStock }).eq('id', med.id).eq('user_id', user.id),
      ])
      if (med) setMedications((prev) => prev.map((m) => m.id === med.id ? { ...m, stock: newStock } : m))
    }
  }

  async function requestNotifPermission() {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifPermission(perm)
    if (perm === 'granted') scheduleNotifications(doses)
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
          {activeTab === 'hoy' && (
            <HoyView medications={medications} doses={doses} onToggle={toggle}
              notifPermission={notifPermission} onRequestNotifPermission={requestNotifPermission}
              userName={nameFromEmail(user?.email)} />
          )}
          {activeTab === 'medicacion' && (
            <MedicacionView medications={medications} userId={user!.id}
              onRefresh={() => loadData(user!.id)} onSignOut={handleSignOut} />
          )}
          {activeTab === 'escanear' && (
            <ScanView userId={user!.id} onMedAdded={() => loadData(user!.id)} />
          )}
        </main>
        <TabBar active={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  )
}
