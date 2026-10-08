import { useState } from 'react'
import { sendPasswordReset, signIn, signUp } from '../lib/auth'
import { useSettings } from '../lib/store'

type Mode = 'signin' | 'signup' | 'reset'

/** Sign in / create account screen shown before the app when accounts are enabled. */
export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const switchTo = (m: Mode) => {
    setMode(m)
    setError('')
    setInfo('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'signin') await signIn(email, password)
      else if (mode === 'signup') {
        const signedIn = await signUp(name, email, password)
        if (!signedIn) {
          setInfo(`Almost done! We sent a confirmation link to ${email}. Open it on this device, then come back and sign in.`)
          setMode('signin')
        }
      } else {
        await sendPasswordReset(email)
        setInfo(`If ${email} has an account, a link to reset the password is on its way.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass pop-in w-full max-w-md rounded-3xl p-6 sm:p-8">
        <div className="text-center">
          <div className="text-6xl" aria-hidden>
            🐝
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold text-honey-300">Spelling Hive</h1>
          <p className="mt-1 text-honey-100/80">Dallas Regional Spelling Bee · 2027 Words of the Champions</p>
        </div>

        {mode !== 'reset' && (
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1" role="tablist">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchTo(m)}
                className={`rounded-xl py-2 font-display font-semibold transition ${
                  mode === m ? 'bg-honey-400 text-night-900' : 'text-honey-100 hover:bg-white/10'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        )}

        <form className="mt-5 space-y-4" onSubmit={submit}>
          {mode === 'reset' && (
            <p className="text-honey-100/90">Type your email and we&apos;ll send a link to choose a new password.</p>
          )}
          {mode === 'signup' && (
            <Field id="auth-name" label="Your first name">
              <input
                id="auth-name"
                className="input text-lg"
                required
                maxLength={30}
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          )}
          <Field id="auth-email" label="Email">
            <input
              id="auth-email"
              className="input text-lg"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {mode !== 'reset' && (
            <Field id="auth-password" label="Password">
              <div className="flex gap-2">
                <input
                  id="auth-password"
                  className="input flex-1 text-lg"
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="btn btn-ghost px-3 py-2 text-sm" onClick={() => setShowPw((v) => !v)}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              {mode === 'signup' && <p className="text-xs text-honey-100/60">At least 8 characters.</p>}
            </Field>
          )}

          {error && <p className="rounded-xl bg-rose-400/15 p-3 text-rose-100">⚠️ {error}</p>}
          {info && <p className="rounded-xl bg-green-400/15 p-3 text-green-100">✉️ {info}</p>}

          <button type="submit" className="btn btn-honey w-full text-xl" disabled={busy}>
            {busy ? 'One moment…' : mode === 'signin' ? 'Sign in 🐝' : mode === 'signup' ? 'Create my account 🐝' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-2 text-sm">
          {mode === 'signin' && (
            <button type="button" className="text-honey-200 underline" onClick={() => switchTo('reset')}>
              Forgot your password?
            </button>
          )}
          {mode === 'reset' && (
            <button type="button" className="text-honey-200 underline" onClick={() => switchTo('signin')}>
              ← Back to sign in
            </button>
          )}
          <button
            type="button"
            className="text-honey-100/60 underline"
            onClick={() => useSettings.getState().set({ guest: true })}
          >
            Practice on this device without an account
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
    </div>
  )
}
