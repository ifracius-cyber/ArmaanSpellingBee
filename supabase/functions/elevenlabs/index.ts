// Supabase Edge Function "elevenlabs": speaks text with ElevenLabs for signed-in family accounts.
//
// The ElevenLabs key lives only here, as the secret ELEVENLABS_API_KEY, so it never reaches a browser.
// Only accounts whose email is listed in the secret ALLOWED_EMAILS (comma-separated) may use it, so
// strangers who sign up can't spend the family's ElevenLabs credits.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const MODELS = new Set(['eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  // Opening the function URL in a browser shows whether it's deployed and configured (no secrets revealed).
  if (req.method === 'GET') {
    const emails = (Deno.env.get('ALLOWED_EMAILS') ?? '').split(',').filter((e) => e.trim()).length
    return json(200, {
      ok: true,
      message: 'The Spelling Hive voice server is running.',
      ELEVENLABS_API_KEY: Deno.env.get('ELEVENLABS_API_KEY') ? 'set' : 'MISSING — add it under Edge Functions → Secrets',
      ALLOWED_EMAILS: emails ? `${emails} email(s) allowed` : 'MISSING — add it under Edge Functions → Secrets',
    })
  }
  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user?.email) return json(401, { error: 'Sign in to use the teacher voice.' })

  const allowed = (Deno.env.get('ALLOWED_EMAILS') ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (!allowed.includes(data.user.email.toLowerCase())) return json(403, { error: 'This account is not on the voice list.' })

  // Forgive the usual copy-paste slips: surrounding spaces, quotes, or a pasted "xi-api-key:" label.
  const key = (Deno.env.get('ELEVENLABS_API_KEY') ?? '')
    .trim()
    .replace(/^xi-api-key:\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim()
  if (!key) return json(500, { error: 'ELEVENLABS_API_KEY secret is not set.' })

  let body: { action?: unknown; text?: unknown; voiceId?: unknown; modelId?: unknown; speed?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Bad request' })
  }

  // The app's voice picker: list every voice on the family ElevenLabs account (needs "Voices: Read").
  if (body.action === 'voices') {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } })
    if (!res.ok) {
      const status = res.status === 401 || res.status === 403 ? 502 : res.status
      return new Response(await res.text(), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    const { voices } = (await res.json()) as { voices: { voice_id: string; name: string; category?: string }[] }
    return json(200, { voices: voices.map((v) => ({ id: v.voice_id, name: v.name, category: v.category ?? '' })) })
  }
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const voiceId = typeof body.voiceId === 'string' && /^[A-Za-z0-9]{8,40}$/.test(body.voiceId) ? body.voiceId : ''
  const modelId = typeof body.modelId === 'string' && MODELS.has(body.modelId) ? body.modelId : 'eleven_multilingual_v2'
  const speed = typeof body.speed === 'number' ? Math.min(1.2, Math.max(0.7, body.speed)) : 0.9
  if (!text || text.length > 1500 || !voiceId) return json(400, { error: 'Bad request' })

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.15, speed },
    }),
  })
  if (!res.ok) {
    // Keep ElevenLabs' own error details (e.g. out of credits), but never reuse 401/403,
    // which the app reads as "this learner's sign-in was refused".
    const status = res.status === 401 || res.status === 403 ? 502 : res.status
    return new Response(await res.text(), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
  return new Response(res.body, { headers: { ...cors, 'Content-Type': 'audio/mpeg' } })
})
