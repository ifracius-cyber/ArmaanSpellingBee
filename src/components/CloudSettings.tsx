import { useState } from 'react'
import { CLOUD_ENABLED } from '../config'
import { createCloudSave, joinCloudSave, leaveCloudSave, syncNow, useCloud } from '../lib/cloud'
import { useSettings } from '../lib/store'

export default function CloudSettings() {
  const code = useSettings((s) => s.syncCode)
  const name = useSettings((s) => s.learnerName)
  const { status, message, savedAt } = useCloud()
  const [joinInput, setJoinInput] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!CLOUD_ENABLED) {
    return (
      <section className="glass space-y-2 rounded-3xl p-6">
        <h2 className="font-display text-2xl font-bold text-honey-300">☁️ Cloud save</h2>
        <p className="text-honey-100/80">
          Cloud save isn&apos;t set up in this copy of the app, so progress is saved on this device only.
        </p>
      </section>
    )
  }

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setNote('')
    try {
      await fn()
    } catch (e) {
      setNote(`⚠️ ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="glass space-y-4 rounded-3xl p-6">
      <h2 className="font-display text-2xl font-bold text-honey-300">☁️ Cloud save</h2>
      {code ? (
        <>
          <p className="text-honey-100/80">
            Progress saves to the cloud automatically. To keep going on another phone, tablet or computer, open the app
            there, go to Settings, and enter this save code:
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-xl bg-night-950/70 px-4 py-3 font-display text-xl tracking-widest text-honey-300 select-all sm:text-2xl">
              {code}
            </code>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                navigator.clipboard
                  .writeText(code)
                  .then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  })
                  .catch(() => {})
              }
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-sm text-honey-100/70">
            Keep this code private, like a password. Anyone who has it can see and change this progress.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-honey" disabled={busy} onClick={() => run(syncNow)}>
              Save now
            </button>
            <span className="text-sm">
              {status === 'saved' && `Last saved ${new Date(savedAt).toLocaleTimeString()}`}
              {status === 'syncing' && 'Saving…'}
              {status === 'offline' && 'No internet right now. Progress will save when you’re back online.'}
              {status === 'error' && `Couldn’t save: ${message}`}
            </span>
          </div>
          <button type="button" className="text-sm text-honey-200/70 underline" onClick={leaveCloudSave}>
            Stop cloud saving on this device
          </button>
        </>
      ) : (
        <>
          <p className="text-honey-100/80">
            Turn on cloud save so progress is kept safe and follows {name || 'you'} to any device. You only do this once.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-2xl bg-white/5 p-4">
              <p className="font-display font-semibold">First device</p>
              <p className="text-sm text-honey-100/80">Start cloud save with the progress on this device.</p>
              <button type="button" className="btn btn-honey" disabled={busy} onClick={() => run(createCloudSave)}>
                Turn on cloud save
              </button>
            </div>
            <form
              className="space-y-2 rounded-2xl bg-white/5 p-4"
              onSubmit={(e) => {
                e.preventDefault()
                void run(() => joinCloudSave(joinInput))
              }}
            >
              <label htmlFor="join-code" className="block font-display font-semibold">
                Already have a save code?
              </label>
              <input
                id="join-code"
                className="input font-display tracking-widest uppercase"
                placeholder="BEE-XXXX-XXXX-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
              />
              <button type="submit" className="btn btn-ghost" disabled={busy || !joinInput.trim()}>
                Use this code
              </button>
            </form>
          </div>
        </>
      )}
      {note && <p className="rounded-xl bg-white/5 p-3">{note}</p>}
    </section>
  )
}
