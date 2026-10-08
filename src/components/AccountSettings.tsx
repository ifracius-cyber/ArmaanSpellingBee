import { useEffect, useRef, useState } from 'react'
import { CLOUD_ENABLED } from '../config'
import { changePassword, signOut, useAuth } from '../lib/auth'
import { syncNow, useCloud } from '../lib/cloud'
import { useSettings } from '../lib/store'

/** Account, cloud-save status and password change. */
export default function AccountSettings({ focusPassword = false }: { focusPassword?: boolean }) {
  const session = useAuth((s) => s.session)
  const { status, message, savedAt } = useCloud()
  const [pw, setPw] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const pwInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusPassword && session) {
      pwInput.current?.focus()
      setNote('Choose a new password below.')
    }
  }, [focusPassword, session])

  if (!CLOUD_ENABLED) return null

  if (!session) {
    return (
      <section className="glass space-y-3 rounded-3xl p-6">
        <h2 className="font-display text-2xl font-bold text-honey-300">👤 Account</h2>
        <p className="text-honey-100/80">
          You&apos;re practicing without an account, so progress is saved on this device only. Sign in to back it up and
          use it on other devices. Your progress here comes with you.
        </p>
        <button type="button" className="btn btn-honey" onClick={() => useSettings.getState().set({ guest: false })}>
          Sign in or create an account
        </button>
      </section>
    )
  }

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true)
    setNote('')
    try {
      await fn()
      setNote(done)
    } catch (e) {
      setNote(`⚠️ ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="glass space-y-4 rounded-3xl p-6">
      <h2 className="font-display text-2xl font-bold text-honey-300">👤 Account</h2>
      <p>
        Signed in as <strong className="text-honey-300">{session.user.email}</strong>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-honey" disabled={busy} onClick={() => run(syncNow, '')}>
          ☁️ Save now
        </button>
        <span className="text-sm">
          {status === 'saved' && `Progress saved to your account at ${new Date(savedAt).toLocaleTimeString()}.`}
          {status === 'syncing' && 'Saving…'}
          {status === 'offline' && 'No internet right now. Progress will save when you’re back online.'}
          {status === 'error' && `Couldn’t save: ${message}`}
        </span>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          void run(() => changePassword(pw), '✅ Password changed.').then(() => setPw(''))
        }}
      >
        <label className="block flex-1 space-y-1" htmlFor="new-password">
          <span className="label">New password</span>
          <input
            ref={pwInput}
            id="new-password"
            className="input"
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-ghost" disabled={busy || pw.length < 8}>
          Change password
        </button>
      </form>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(signOut, '')}>
        Sign out
      </button>
      {note && <p className="rounded-xl bg-white/5 p-3">{note}</p>}
    </section>
  )
}
