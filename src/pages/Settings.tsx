import { useState } from 'react'
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

export default function SettingsPage() {
  const s = useSettings()
  const reset = useProgress((p) => p.reset)
  const [keyDraft, setKeyDraft] = useState(s.apiKey)
  const [voices, setVoices] = useState<ElevenVoice[]>([])
  const [status, setStatus] = useState('')

  const saveKey = async () => {
    // People often paste with quotes, spaces or a "xi-api-key:" label — strip all of that.
    const key = keyDraft.trim().replace(/^["']|["']$/g, '').replace(/^xi-api-key:\s*/i, '').trim()
    setKeyDraft(key)
    s.set({ apiKey: key, useElevenLabs: true })
    if (!key) return setStatus('Key removed — using the built-in browser voice.')
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
      <section className="glass space-y-4 rounded-3xl p-6">
        <h1 className="font-display text-3xl font-bold text-honey-300">⚙️ Settings</h1>
        <Field label="Learner's name">
          <input className="input" value={s.learnerName} onChange={(e) => s.set({ learnerName: e.target.value })} />
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
          Paste an ElevenLabs API key to use lifelike voices. Without one, the app uses your device&apos;s built-in voice.
          The key is saved only in this browser. Each phrase is generated once and then cached, so repeat listens are
          free.
        </p>
        <Field label="ElevenLabs API key">
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
        <p className="text-honey-100/80">Progress is saved in this browser on this device.</p>
        <button
          type="button"
          className="btn btn-red"
          onClick={() => {
            if (confirm('Erase all progress, streaks and honey points? This cannot be undone.')) reset()
          }}
        >
          Reset all progress
        </button>
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
