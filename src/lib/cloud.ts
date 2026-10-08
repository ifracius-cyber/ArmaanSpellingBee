import { create } from 'zustand'
import { CLOUD_ENABLED, SUPABASE_KEY, SUPABASE_URL } from '../config'
import { snapshotOf, useProgress, useSettings, type ProgressSnapshot } from './store'

/**
 * Cloud save. Progress lives in the browser as before and is mirrored to Supabase under a
 * random save code. Every save first pulls the cloud copy and merges it in, so two devices
 * studying on the same code never overwrite each other's work.
 */

export type CloudStatus = 'off' | 'syncing' | 'saved' | 'offline' | 'error'

export const useCloud = create<{ status: CloudStatus; message: string; savedAt: number }>(() => ({
  status: 'off',
  message: '',
  savedAt: 0,
}))

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O or 1/I mix-ups
const CODE_RE = /^BEE(-[A-Z2-9]{4}){4}$/

export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
  return `BEE-${[0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-')}`
}

/** Accepts codes typed loosely ("bee xxxx xxxx…") and returns the canonical form, or '' if invalid. */
export function cleanCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^BEE/, '')
  if (raw.length !== 16) return ''
  const code = `BEE-${raw.match(/.{4}/g)!.join('-')}`
  return CODE_RE.test(code) ? code : ''
}

async function rpc<T>(fn: string, body: Record<string, unknown>, keepalive = false): Promise<T> {
  const headers: Record<string, string> = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }
  // Legacy anon keys are JWTs and also go in Authorization; new sb_publishable_ keys must not.
  if (!SUPABASE_KEY.startsWith('sb_')) headers.Authorization = `Bearer ${SUPABASE_KEY}`
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    keepalive,
  })
  if (!res.ok) throw new Error(`Cloud save error ${res.status}: ${(await res.text()).slice(0, 160)}`)
  return (await res.json()) as T
}

const fetchRemote = (code: string) => rpc<ProgressSnapshot | null>('get_spelling_progress', { p_code: code })
const saveRemote = (code: string, data: ProgressSnapshot, keepalive = false) =>
  rpc<string>('save_spelling_progress', { p_code: code, p_data: data }, keepalive)

let ready = false // no uploads until we've merged the cloud copy at least once
let timer: ReturnType<typeof setTimeout> | undefined
let running: Promise<void> | null = null

function setStatus(status: CloudStatus, message = '') {
  useCloud.setState((s) => ({ status, message, savedAt: status === 'saved' ? Date.now() : s.savedAt }))
}

/** Pull the cloud copy, merge it into this device, then upload the merged result. */
export function syncNow(): Promise<void> {
  const code = useSettings.getState().syncCode
  if (!CLOUD_ENABLED || !code) return Promise.resolve()
  if (running) return running
  running = (async () => {
    setStatus('syncing')
    try {
      const remote = await fetchRemote(code)
      if (remote) useProgress.getState().mergeRemote(remote)
      ready = true
      await saveRemote(code, snapshotOf(useProgress.getState()))
      setStatus('saved')
    } catch (e) {
      setStatus(navigator.onLine ? 'error' : 'offline', e instanceof Error ? e.message : String(e))
    } finally {
      running = null
    }
  })()
  return running
}

function scheduleSave() {
  if (!ready) return
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), 3000)
}

let started = false

/** Call once at startup: syncs now, after every change, and whenever the app comes back into view. */
export function startCloudSync() {
  if (started || !CLOUD_ENABLED) return
  started = true
  useProgress.subscribe((s, prev) => {
    if (s.words !== prev.words || s.xp !== prev.xp || s.resetAt !== prev.resetAt) scheduleSave()
  })
  document.addEventListener('visibilitychange', () => {
    const code = useSettings.getState().syncCode
    if (!code) return
    if (document.visibilityState === 'hidden' && ready) {
      // Leaving the page: send what we have right away (keepalive lets it finish after the tab closes).
      clearTimeout(timer)
      void saveRemote(code, snapshotOf(useProgress.getState()), true).catch(() => {})
    } else if (document.visibilityState === 'visible') {
      void syncNow()
    }
  })
  window.addEventListener('online', () => void syncNow())
  if (useSettings.getState().syncCode) void syncNow()
}

/** Turns on cloud save for this device with a brand-new save code. */
export async function createCloudSave(): Promise<string> {
  const code = generateCode()
  useSettings.getState().set({ syncCode: code })
  ready = true
  await syncNow()
  return code
}

/** Joins an existing save code (e.g. typed in on a second device) and merges its progress here. */
export async function joinCloudSave(input: string): Promise<void> {
  const code = cleanCode(input)
  if (!code) throw new Error('That code doesn’t look right. It should look like BEE-ABCD-EFGH-JKLM-NPQR.')
  const remote = await fetchRemote(code)
  if (!remote) throw new Error('No saved progress was found for that code. Check each letter and try again.')
  useSettings.getState().set({ syncCode: code })
  ready = false
  await syncNow()
}

export function leaveCloudSave() {
  clearTimeout(timer)
  ready = false
  useSettings.getState().set({ syncCode: '' })
  setStatus('off')
}
