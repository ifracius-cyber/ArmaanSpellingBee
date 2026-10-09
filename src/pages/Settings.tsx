import { useEffect, useState } from 'react'
import AccountSettings from '../components/AccountSettings'
import { saveLearnerName, useAuth } from '../lib/auth'
import { useProgress, useSettings } from '../lib/store'
import { clearAudioCache, fetchFamilyVoices, lastVoiceError, MODELS, speak, SUGGESTED_VOICES, type VoiceOption } from '../lib/voice'

export default function SettingsPage({ param }: { param?: string }) {
  const s = useSettings()
  const signedIn = useAuth((a) => Boolean(a.session))
  const reset = useProgress((p) => p.reset)
  const [status, setStatus] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [familyVoices, setFamilyVoices] = useState<VoiceOption[]>([])
  const [voicesNote, setVoicesNote] = useState('')

  // Signed-in accounts see every voice on the family ElevenLabs account, not just the built-in four.
  useEffect(() => {
    if (!signedIn) return
    let live = true
    fetchFamilyVoices()
      .then((v) => live && (setFamilyVoices(v), setVoicesNote('')))
      .catch((e) => live && setVoicesNote(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
  }, [signedIn])

  const test = async () => {
    setStatus('Speaking…')
    await speak(`Hi ${s.learnerName}! Your word is: chrysanthemum. Chrysanthemum.`)
    setStatus(
      !signedIn
        ? 'That was the built-in device voice. Sign in to hear the ElevenLabs teacher voice.'
        : lastVoiceError
          ? `⚠️ ElevenLabs error — fell back to browser voice: ${lastVoiceError}`
          : '✅ Sounds good!',
    )
  }

  const voiceOptions = [
    ...SUGGESTED_VOICES,
    ...familyVoices.filter((v) => !SUGGESTED_VOICES.some((sv) => sv.id === v.id)),
  ]

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-bold text-honey-300">⚙️ Settings</h1>
      <AccountSettings focusPassword={param === 'new-password'} />
      <section className="glass space-y-4 rounded-3xl p-6">
        <Field label="Learner's name">
          <input
            className="input"
            value={s.learnerName}
            onChange={(e) => s.set({ learnerName: e.target.value })}
            onBlur={() => void saveLearnerName(s.learnerName)}
          />
        </Field>
        <Field label={`Daily goal: ${s.dailyGoal} words`}>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={s.dailyGoal}
            onChange={(e) => s.set({ dailyGoal: Number(e.target.value) })}
            className="w-full accent-amber-400"
          />
        </Field>
      </section>

      <section className="glass space-y-4 rounded-3xl p-6">
        <h2 className="font-display text-2xl font-bold text-honey-300">🎙️ Teacher voice (ElevenLabs)</h2>
        <p className="text-honey-100/80">
          {signedIn
            ? 'The ElevenLabs teacher voice comes with your family account. There is nothing to set up.'
            : "Sign in to hear the ElevenLabs teacher voice. Until then, the app uses this device's built-in voice."}{' '}
          Each phrase is made once and then saved on this device, so listening again is free.
        </p>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={s.useElevenLabs}
            onChange={(e) => s.set({ useElevenLabs: e.target.checked })}
            className="h-5 w-5 accent-amber-400"
          />
          Use the ElevenLabs teacher voice (turn off to use the device voice)
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Voice">
            <select className="input" value={s.voiceId} onChange={(e) => s.set({ voiceId: e.target.value })}>
              {voiceOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            {voicesNote && <span className="block text-xs text-honey-100/70">{voicesNote}</span>}
          </Field>
          <Field label="Voice model">
            <select className="input" value={s.modelId} onChange={(e) => s.set({ modelId: e.target.value })}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={`Speaking speed: ${s.speed.toFixed(2)}×`}>
          <input
            type="range"
            min={0.7}
            max={1.2}
            step={0.05}
            value={s.speed}
            onChange={(e) => s.set({ speed: Number(e.target.value) })}
            className="w-full accent-amber-400"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-honey" onClick={test}>
            🔊 Test voice
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              await clearAudioCache()
              setStatus('Audio cache cleared.')
            }}
          >
            Clear saved audio
          </button>
        </div>
        {status && <p className="rounded-xl bg-white/5 p-3">{status}</p>}
      </section>


      <section className="glass space-y-3 rounded-3xl p-6">
        <h2 className="font-display text-2xl font-bold text-honey-300">Progress</h2>
        <p className="text-honey-100/80">
          Progress is always saved in this browser. With cloud save on, it's also backed up online.
        </p>
        {/* An in-page confirmation, because browser confirm() dialogs are blocked in some embedded viewers. */}
        {confirmReset ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-rose-400/10 p-3">
            <span>Erase all progress, streaks and honey points? This can&apos;t be undone.</span>
            <button
              type="button"
              className="btn btn-red"
              onClick={() => {
                reset()
                setConfirmReset(false)
              }}
            >
              Yes, erase it
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-red" onClick={() => setConfirmReset(true)}>
            Reset all progress
          </button>
        )}
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="label">{label}</span>
      {children}
    </label>
  )
}
