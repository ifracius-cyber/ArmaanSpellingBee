import { SUPABASE_KEY, SUPABASE_URL, VOICE_FUNCTION } from '../config'
import { useAuth } from './auth'
import { useSettings } from './store'

/**
 * Teaching voice.
 *
 * Signed-in family accounts hear ElevenLabs through the Supabase voice function, which keeps the
 * ElevenLabs key on the server — nobody ever types or sees a key. Signed out (or if the request
 * fails) the app uses the browser's built-in speech synthesis instead.
 * Generated clips are stored with the Cache API so each phrase is only paid for once.
 */

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

/** Signed-in family accounts get the ElevenLabs voice through the server, with no key in the browser. */
function accountVoiceToken(): string {
  return useAuth.getState().session?.access_token ?? ''
}

export function hasElevenLabs(): boolean {
  return Boolean(accountVoiceToken())
}

export interface VoiceOption {
  id: string
  name: string
}

/** Every voice on the family ElevenLabs account, fetched through the voice function (signed-in only). */
export async function fetchFamilyVoices(): Promise<VoiceOption[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${VOICE_FUNCTION}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accountVoiceToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'voices' }),
  })
  if (!res.ok) {
    const err = await friendlyError(res)
    if (/missing a permission|missing_permissions/i.test(err.message))
      throw new Error('To list all voices, edit the family ElevenLabs key and set "Voices" to Read.')
    throw err
  }
  const json = (await res.json()) as { voices?: VoiceOption[] }
  // Older versions of the voice function don't know this request and reply with an error instead.
  if (!Array.isArray(json.voices)) throw new Error('Update the voice function in Supabase to list all voices.')
  return json.voices
}

/** Asks the voice Edge Function to speak; it holds the ElevenLabs key as a server secret. */
async function accountTtsRequest(text: string, voiceId: string, modelId: string, speed: number): Promise<Response> {
  const url = `${SUPABASE_URL}/functions/v1/${VOICE_FUNCTION}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accountVoiceToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, voiceId, modelId, speed }),
  }).catch(() => {
    // The browser hides the reason when the server answers without CORS headers — that happens
    // when the function is missing, failed to start, or "Enforce JWT Verification" is on.
    throw new Error(
      `Couldn't reach the voice server. Open ${url} in a browser: it should say "voice server is running". If it says "not found", the ${VOICE_FUNCTION} function isn't deployed; if it mentions "authorization", turn off Enforce JWT Verification on the ${VOICE_FUNCTION} function.`,
    )
  })
  if (res.status === 403) throw new Error('This account isn’t on the family voice list yet. Ask a grown-up to add your email.')
  if (res.status === 404) throw new Error(`The voice server isn’t set up yet (the "${VOICE_FUNCTION}" Edge Function is missing).`)
  if (res.status === 401) throw new Error('Please sign in again to use the teacher voice.')
  return res
}

/** Turns an ElevenLabs error response into a message a parent can act on. */
async function friendlyError(res: Response): Promise<Error> {
  let status = ''
  let message = ''
  try {
    const body = (await res.json()) as { detail?: { status?: string; message?: string } | string; error?: string }
    if (body.error) message = body.error
    else if (typeof body.detail === 'string') message = body.detail
    else {
      status = body.detail?.status ?? ''
      message = body.detail?.message ?? ''
    }
  } catch {
    /* body wasn't JSON */
  }
  let hint: string
  if (status === 'invalid_api_key' || (res.status === 401 && !status))
    hint =
      'ElevenLabs rejected the family key. In Supabase → Edge Functions → Secrets, re-paste ELEVENLABS_API_KEY (just the sk_… key: no quotes or spaces).'
  else if (status === 'missing_permissions')
    hint = `The family key is missing a permission. Edit the key on ElevenLabs and turn on "Text to Speech" (Access).`
  else if (status === 'quota_exceeded' || res.status === 402)
    hint = 'The ElevenLabs account is out of credits for this month, or this voice needs a paid plan.'
  else if (status === 'detected_unusual_activity')
    hint = 'ElevenLabs paused free-tier use for this account. Signing in on elevenlabs.io or upgrading usually fixes it.'
  else if (status === 'voice_not_found' || res.status === 404)
    hint = 'That voice is not available on this account. Pick another voice in Settings.'
  else if (res.status === 429) hint = 'Too many requests at once. Wait a few seconds and try again.'
  else hint = `ElevenLabs returned error ${res.status}.`
  return new Error(message ? `${hint} (${message})` : hint)
}

async function elevenLabsAudio(text: string): Promise<Blob> {
  const { voiceId, modelId, speed } = useSettings.getState()
  const cacheKey = `https://cache.local/tts/${modelId}/${voiceId}/${speed}/${encodeURIComponent(text)}`

  let cache: Cache | null = null
  try {
    cache = await caches.open(AUDIO_CACHE)
    const hit = await cache.match(cacheKey)
    if (hit) return await hit.blob()
  } catch {
    // Cache API unavailable (e.g. insecure context) — just fetch every time.
  }

  const res = await accountTtsRequest(text, voiceId, modelId, speed)
  if (!res.ok) throw await friendlyError(res)
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
    if (hasElevenLabs() && useSettings.getState().useElevenLabs) {
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

export async function clearAudioCache(): Promise<void> {
  try {
    await caches.delete(AUDIO_CACHE)
  } catch {
    /* ignore */
  }
}
