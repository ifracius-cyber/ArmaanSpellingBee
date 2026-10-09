import { useState } from 'react'
import AccountSettings from '../components/AccountSettings'
import { saveLearnerName, useAuth } from '../lib/auth'
import { useProgress, useSettings } from '../lib/store'
import {
  clearAudioCache,
  fetchAccountVoices,
  testApiKey,
  lastVoiceError,
  MODELS,
  speak,
  SUGGESTED_VOICES,
  type ElevenVoice,
} from '../lib/voice'

export default function SettingsPage({ param }: { param?: string }) {
  const s = useSettings()
  const signedIn = useAuth((a) => Boolean(a.session))
  const reset = useProgress((p) => p.reset)
  const [keyDraft, setKeyDraft] = useState(s.apiKey)
  const [voices, setVoices] = useState<ElevenVoice[]>([])
  const [status, setStatus] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  const saveKey = async () => {
    // People often paste with quotes, spaces or a "xi-api-key:" label — strip all of that.
    const key = keyDraft.trim().replace(/^["']|["']$/g, '').replace(/^xi-api-key:\s*/i, '').trim()
    setKeyDraft(key)
    s.set({ apiKey: key, useElevenLabs: true })
    if (!key) return setStatus(signedIn ? 'Key removed. Using the family account voice.' : 'Key removed. Using the built-in browser voice.')
    if (!key.startsWith('sk_'))
      return setStatus('⚠️ That doesn\'t look like an ElevenLabs API key. API keys start with "sk_" — an Agent ID or voice ID won\'t work here.')
    setStatus('Checking key…')
    try {
      await testApiKey(key)
    } catch (e) {
      return setStatus(`⚠️ ${e instanceof Error ? e.message : e}`)
    }
    try {
      const v = await fetchAccountVoices(key)
      setVoices(v)
      setStatus(`✅ Connected! The teacher voice is ready, and ${v.length} voices from your account are in the Voice list.`)
    } catch {
      // Listing voices needs the optional "Voices: Read" permission; speech works without it.
      setStatus('✅ Connected! The teacher voice is ready. (To pick from all your account voices, also give the key the "Voices → Read" permission.)')
    }
  }

  const test = async () => {
    setStatus('Speaking…')
    await speak(`Hi ${s.learnerName}! Your word is: chrysanthemum. Chrysanthemum.`)
    setStatus(lastVoiceError ? `⚠️ ElevenLabs error — fell back to browser voice: ${lastVoiceError}` : '✅ Sounds good!')
  }

  const voiceOptions = [
    ...SUGGESTED_VOICES,
    ...voices.filter((v) => !SUGGESTED_VOICES.some((sv) => sv.id === v.voice_id)).map((v) => ({ id: v.voice_id, name: v.name })),
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
            ? 'Your family account includes the ElevenLabs teacher voice, so there is no key to paste. Press "Test voice" to hear it.'
            : "Sign in to use the family's ElevenLabs voice, or paste an ElevenLabs API key below. Without either, the app uses your device's built-in voice."}{' '}
          Each phrase is generated once and then saved on this device, so listening again is free.
        </p>
        <Field label={signedIn ? 'Personal ElevenLabs API key (only used when signed out)' : 'ElevenLabs API key'}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="input flex-1"
              type="password"
              autoComplete="off"
              placeholder="sk_…"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
            />
            <button type="button" className="btn btn-honey" onClick={saveKey}>
              Save &amp; check
            </button>
          </div>
        </Field>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={s.useElevenLabs}
            onChange={(e) => s.set({ useElevenLabs: e.target.checked })}
            className="h-5 w-5 accent-amber-400"
          />
          Use ElevenLabs voice when a key is set
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
