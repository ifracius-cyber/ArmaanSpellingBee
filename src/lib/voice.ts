import { useSettings } from './store'

/**
 * Teaching voice.
 *
 * Uses ElevenLabs text-to-speech when an API key is configured, and falls back to the
 * browser's built-in speech synthesis otherwise (or if the ElevenLabs request fails).
 * Generated clips are stored with the Cache API so each phrase is only paid for once.
 */

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1'
const AUDIO_CACHE = 'spelling-hive-tts-v1'


export const SUGGESTED_VOICES = [
  { id: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella — bright & warm (American)' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda — friendly teacher (American)' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice — clear educator (British)' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel — steady announcer (British)' },
]

export const MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2 — best pronunciation of foreign words' },
  { id: 'eleven_flash_v2_5', name: 'Flash v2.5 — fastest & cheapest' },
]

type Listener = (speaking: boolean) => void
const listeners = new Set<Listener>()
let current: HTMLAudioElement | null = null
let token = 0 // bumps on every utterance; stale playback checks it and bails
let seq = 0 // bumps on every user-level request; cancels running sequences

function emit(v: boolean) {
  listeners.forEach((l) => l(v))
}

export function onSpeaking(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function stopSpeaking() {
  seq++
  haltAudio()
}

function haltAudio() {
  token++
  if (current) {
    current.pause()
    current = null
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  emit(false)
}

function getEnvKey(): string {
  return (import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined) ?? ''
}

export function activeApiKey(): string {
  return useSettings.getState().apiKey || getEnvKey()
}

async function elevenLabsAudio(text: string): Promise<Blob> {
  const { voiceId, modelId, speed } = useSettings.getState()
  const key = activeApiKey()
  const cacheKey = `https://cache.local/tts/${modelId}/${voiceId}/${speed}/${encodeURIComponent(text)}`

  let cache: Cache | null = null
  try {
    cache = await caches.open(AUDIO_CACHE)
    const hit = await cache.match(cacheKey)
    if (hit) return await hit.blob()
  } catch {
    // Cache API unavailable (e.g. insecure context) — just fetch every time.
  }

  const res = await fetch(`${ELEVEN_BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.15, speed },
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 200)}`)
  }
  const blob = await res.blob()
  if (cache) await cache.put(cacheKey, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } })).catch(() => {})
  return blob
}

function browserSpeak(text: string, myToken: number): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.85 * useSettings.getState().speed
    u.lang = 'en-US'
    const voices = window.speechSynthesis.getVoices()
    const preferred =
      voices.find((v) => /en-US/i.test(v.lang) && /Samantha|Google US|Aria|Jenny/i.test(v.name)) ??
      voices.find((v) => /en-US/i.test(v.lang))
    if (preferred) u.voice = preferred
    u.onend = u.onerror = () => resolve()
    if (myToken !== token) return resolve()
    window.speechSynthesis.speak(u)
  })
}

export let lastVoiceError = ''

/** Speaks `text`, interrupting anything already playing. Resolves when finished. */
export function speak(text: string): Promise<void> {
  seq++
  return say(text)
}

async function say(text: string): Promise<void> {
  haltAudio()
  const myToken = ++token
  emit(true)
  try {
    if (activeApiKey() && useSettings.getState().useElevenLabs) {
      try {
        const blob = await elevenLabsAudio(text)
        if (myToken !== token) return
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        current = audio
        await new Promise<void>((resolve) => {
          audio.onended = audio.onerror = () => resolve()
          audio.play().catch(() => resolve())
        })
        URL.revokeObjectURL(url)
        lastVoiceError = ''
        return
      } catch (err) {
        lastVoiceError = err instanceof Error ? err.message : String(err)
        console.warn('ElevenLabs failed, using browser voice instead.', err)
      }
    }
    await browserSpeak(text, myToken)
  } finally {
    if (myToken === token) emit(false)
  }
}

/** Speaks several phrases in a row (stops early if interrupted). */
export async function speakSequence(parts: string[]): Promise<void> {
  const mySeq = ++seq
  for (const p of parts) {
    if (mySeq !== seq) return
    await say(p)
  }
}

export interface ElevenVoice {
  voice_id: string
  name: string
  category?: string
}

/** Lists voices on the user's ElevenLabs account (used by Settings). */
export async function fetchAccountVoices(key: string): Promise<ElevenVoice[]> {
  const res = await fetch(`${ELEVEN_BASE}/voices`, { headers: { 'xi-api-key': key } })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`)
  const json = (await res.json()) as { voices: ElevenVoice[] }
  return json.voices
}

export async function clearAudioCache(): Promise<void> {
  try {
    await caches.delete(AUDIO_CACHE)
  } catch {
    /* ignore */
  }
}
