import { create } from 'zustand'
import { CLOUD_ENABLED, SUPABASE_KEY, SUPABASE_URL } from '../config'
import { useAuth } from './auth'
import { snapshotOf, useProgress, useSettings, type ProgressSnapshot } from './store'
import { supabase } from './supabase'

/**
 * Cloud save. Progress lives in the browser as before and is mirrored to Supabase:
 *  - signed in: one row per account in `learner_progress` (protected by Row Level Security);
 *  - older "save code" copies (from before accounts existed) are merged into the account on first sync.
 * Every save first pulls the cloud copy and merges it in, so two devices never overwrite each other.
 */

export type CloudStatus = 'off' | 'syncing' | 'saved' | 'offline' | 'error'

export const useCloud = create<{ status: CloudStatus; message: string; savedAt: number }>(() => ({
  status: 'off',
  message: '',
  savedAt: 0,
}))

const CODE_RE = /^BEE(-[A-Z2-9]{4}){4}$/

/** Accepts codes typed loosely ("bee xxxx xxxx…") and returns the canonical form, or '' if invalid. */
export function cleanCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^BEE/, '')
  if (raw.length !== 16) return ''
  const code = `BEE-${raw.match(/.{4}/g)!.join('-')}`
  return CODE_RE.test(code) ? code : ''
}

/** Reads a progress copy saved under an old save code (used once, to bring it into the account). */
async function fetchByCode(code: string): Promise<ProgressSnapshot | null> {
  const headers: Record<string, string> = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }
  if (!SUPABASE_KEY.startsWith('sb_')) headers.Authorization = `Bearer ${SUPABASE_KEY}`
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_spelling_progress`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_code: code }),
  })
  if (!res.ok) throw new Error(`Couldn’t read the old save code (${res.status}).`)
  return (await res.json()) as ProgressSnapshot | null
}

async function fetchAccount(): Promise<ProgressSnapshot | null> {
  const { data, error } = await supabase!.from('learner_progress').select('data').maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.data as ProgressSnapshot | undefined) ?? null
}

async function saveAccount(userId: string, snap: ProgressSnapshot): Promise<void> {
  const { error } = await supabase!
    .from('learner_progress')
    .upsert({ user_id: userId, data: snap, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
}

let readyFor = '' // user id whose cloud copy has been merged at least once; no uploads before that
let timer: ReturnType<typeof setTimeout> | undefined
let running: Promise<void> | null = null

function setStatus(status: CloudStatus, message = '') {
  useCloud.setState((s) => ({ status, message, savedAt: status === 'saved' ? Date.now() : s.savedAt }))
}

/** Pull the cloud copy, merge it into this device, then upload the merged result. */
export function syncNow(): Promise<void> {
  const userId = useAuth.getState().session?.user.id
  if (!CLOUD_ENABLED || !supabase || !userId) {
    setStatus('off')
    return Promise.resolve()
  }
  if (running) return running
  running = (async () => {
    setStatus('syncing')
    try {
      // Progress on this device that belongs to a different account must not leak into this one.
      const { owner, clearLocal, setOwner } = useProgress.getState()
      if (owner && owner !== userId) clearLocal()
      setOwner(userId)
      const remote = await fetchAccount()
      if (remote) useProgress.getState().mergeRemote(remote)
      const legacy = useSettings.getState().syncCode
      if (legacy) {
        const old = await fetchByCode(legacy).catch(() => null)
        if (old) useProgress.getState().mergeRemote(old)
        useSettings.getState().set({ syncCode: '' })
      }
      readyFor = userId
      await saveAccount(userId, snapshotOf(useProgress.getState()))
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
  if (!readyFor || readyFor !== useAuth.getState().session?.user.id) return
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), 3000)
}

let started = false

/** Call once at startup: syncs on sign-in, after every change, and whenever the app comes back into view. */
export function startCloudSync() {
  if (started || !CLOUD_ENABLED) return
  started = true
  useProgress.subscribe((s, prev) => {
    if (s.words !== prev.words || s.xp !== prev.xp || s.resetAt !== prev.resetAt) scheduleSave()
  })
  useAuth.subscribe((s, prev) => {
    const id = s.session?.user.id
    if (id && id !== prev.session?.user.id) void syncNow()
    if (!id && prev.session) {
      clearTimeout(timer)
      readyFor = ''
      setStatus('off')
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
    else if (readyFor) {
      clearTimeout(timer)
      void syncNow()
    }
  })
  window.addEventListener('online', () => void syncNow())
  void syncNow()
}
