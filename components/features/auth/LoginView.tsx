'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Field, inputCls } from '../../ui/Input'

export function LoginView() {
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
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7.07-7.07l7 7a5 5 0 0 1-7.07 7.07Z" />
              <line x1="8.5" y1="11.5" x2="15.5" y2="11.5" />
            </svg>
          </div>
          <h1 className="text-[length:var(--fs-display)] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">MedApp</h1>
          <p className="text-[length:var(--fs-body)] text-zinc-400 dark:text-zinc-500 mt-1">Tu medicación, organizada</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm">
          <h2 className="text-[length:var(--fs-label)] font-semibold text-zinc-800 dark:text-zinc-100 mb-5">
            {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com" autoComplete="email" className={inputCls} />
            </Field>
            <Field label="Contraseña">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? 'Mínimo 6 caracteres' : '••••••••'}
                autoComplete={isSignUp ? 'new-password' : 'current-password'} className={inputCls} />
            </Field>
            {error && (
              <p className="text-[length:var(--fs-body-sm)] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl px-3 py-2.5">
                {error}
              </p>
            )}
            {successMsg && (
              <p className="text-[length:var(--fs-body-sm)] text-primary bg-primary/10 border border-primary/25 rounded-xl px-3 py-2.5">
                {successMsg}
              </p>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-white text-[length:var(--fs-body-lg)] font-semibold mt-1 transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm">
              {loading ? 'Cargando…' : isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        <p className="text-center text-[length:var(--fs-body-sm)] text-zinc-400 dark:text-zinc-500 mt-5">
          {isSignUp ? '¿Ya tenés cuenta?' : '¿No tenés cuenta?'}{' '}
          <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMsg('') }}
            className="text-primary font-semibold">
            {isSignUp ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </p>
      </div>
    </div>
  )
}
