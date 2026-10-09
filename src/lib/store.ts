import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Level } from '../types'

const DEFAULT_VOICE = 'hpp4J3VqNfWAUOO0d1Us'

interface SettingsState {
  learnerName: string
  useElevenLabs: boolean
  voiceId: string
  modelId: string
  speed: number
  dailyGoal: number
  /** Cloud save code (BEE-XXXX-XXXX-XXXX-XXXX); empty until cloud save is turned on. */
  syncCode: string
  /** Chose "practice without an account" on the sign-in page. */
  guest: boolean
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      learnerName: 'Armaan',
      useElevenLabs: true,
      voiceId: DEFAULT_VOICE,
      modelId: 'eleven_multilingual_v2',
      speed: 0.9,
      dailyGoal: 20,
      syncCode: '',
      guest: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'spelling-hive-settings',
      // v1 removed the per-browser ElevenLabs key; drop any key an older version saved here.
      version: 1,
      migrate: (persisted) => {
        const { apiKey: _old, ...rest } = (persisted ?? {}) as Record<string, unknown>
        void _old
        return rest as unknown as SettingsState
      },
      // Re-save right after loading so a migrated (key-free) copy replaces the old one in storage.
      onRehydrateStorage: () => (state) => state?.set({}),
    },
  ),
)

/**
 * Leitner-style spaced repetition. Each word sits in a box 0–5; a correct answer moves it
 * up a box (seen again later), a miss sends it back to box 1 (seen again soon).
 */
export interface WordProgress {
  box: number
  right: number
  wrong: number
  last: number // epoch ms of the last study attempt (drives review timing)
  starred?: boolean
  mod?: number // epoch ms of the last change of any kind (used to merge devices)
}

export const MASTERED_BOX = 4
const BOX_DELAY_HOURS = [0, 0, 12, 24, 72, 168]

export function isDue(p: WordProgress | undefined, now = Date.now()): boolean {
  if (!p) return true
  return now - p.last >= BOX_DELAY_HOURS[Math.min(p.box, 5)] * 3600_000
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Older saves used unpadded dates ("2026-10-8"); normalise so days compare as strings. */
function normDay(s: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''
}

function today(): string {
  return dayKey(new Date())
}

function yesterday(): string {
  return dayKey(new Date(Date.now() - 86400_000))
}

interface ProgressState {
  words: Record<number, WordProgress>
  xp: number
  streak: number
  lastStudyDay: string
  todayCount: number
  bestRun: number
  focusLevel: Level
  /** When progress was last reset — so a reset on one device isn't undone by another device's copy. */
  resetAt: number
  /** Account id this device's progress belongs to ('' = not linked to an account yet). */
  owner: string
  record: (id: number, correct: boolean) => void
  markKnown: (id: number, known: boolean) => void
  toggleStar: (id: number) => void
  setFocusLevel: (l: Level) => void
  reset: () => void
  setBestRun: (n: number) => void
  mergeRemote: (remote: ProgressSnapshot) => void
  /** Empties this device's copy (e.g. on sign-out) without marking a reset that would sync to the cloud. */
  clearLocal: () => void
  setOwner: (owner: string) => void
}

/** The part of progress that is saved to the cloud. */
export type ProgressSnapshot = Pick<
  ProgressState,
  'words' | 'xp' | 'streak' | 'lastStudyDay' | 'todayCount' | 'bestRun' | 'resetAt'
>

export function snapshotOf(s: ProgressSnapshot): ProgressSnapshot {
  const { words, xp, streak, lastStudyDay, todayCount, bestRun, resetAt } = s
  return { words, xp, streak, lastStudyDay, todayCount, bestRun, resetAt }
}

/**
 * Combines two devices' progress: for each word keep the most recently changed entry; for totals keep
 * the larger; for the streak keep whichever device studied most recently. A newer reset wins outright.
 */
export function mergeSnapshots(a: ProgressSnapshot, b: ProgressSnapshot): ProgressSnapshot {
  const resetAt = Math.max(a.resetAt ?? 0, b.resetAt ?? 0)
  const words: Record<number, WordProgress> = {}
  const stamp = (p: WordProgress) => p.mod ?? p.last
  for (const src of [a.words ?? {}, b.words ?? {}]) {
    for (const [id, p] of Object.entries(src)) {
      if (stamp(p) < resetAt) continue
      const cur = words[Number(id)]
      if (!cur || stamp(p) > stamp(cur)) words[Number(id)] = p
    }
  }
  const fresh = (x: ProgressSnapshot) => (x.resetAt ?? 0) >= resetAt
  const aDay = fresh(a) ? normDay(a.lastStudyDay) : ''
  const bDay = fresh(b) ? normDay(b.lastStudyDay) : ''
  const later = aDay > bDay ? a : aDay < bDay ? b : a.todayCount >= b.todayCount ? a : b
  const laterDay = later === a ? aDay : bDay
  return {
    words,
    resetAt,
    xp: Math.max(fresh(a) ? a.xp : 0, fresh(b) ? b.xp : 0),
    bestRun: Math.max(fresh(a) ? a.bestRun : 0, fresh(b) ? b.bestRun : 0),
    lastStudyDay: laterDay,
    streak: laterDay ? Math.max(aDay === laterDay ? a.streak : 0, bDay === laterDay ? b.streak : 0) : 0,
    todayCount: laterDay ? Math.max(aDay === laterDay ? a.todayCount : 0, bDay === laterDay ? b.todayCount : 0) : 0,
  }
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      words: {},
      xp: 0,
      streak: 0,
      lastStudyDay: '',
      todayCount: 0,
      bestRun: 0,
      focusLevel: 1,
      resetAt: 0,
      owner: '',
      record: (id, correct) =>
        set((s) => {
          const prev = s.words[id] ?? { box: 0, right: 0, wrong: 0, last: 0 }
          const next: WordProgress = {
            ...prev,
            box: correct ? Math.min(prev.box + 1, 5) : 1,
            right: prev.right + (correct ? 1 : 0),
            wrong: prev.wrong + (correct ? 0 : 1),
            last: Date.now(),
            mod: Date.now(),
          }
          return { words: { ...s.words, [id]: next }, xp: s.xp + (correct ? 10 : 2), ...bumpDay(s) }
        }),
      markKnown: (id, known) =>
        set((s) => {
          const prev = s.words[id] ?? { box: 0, right: 0, wrong: 0, last: 0 }
          const next = { ...prev, box: known ? Math.max(prev.box, 2) : 1, last: Date.now(), mod: Date.now() }
          return { words: { ...s.words, [id]: next }, xp: s.xp + 1, ...bumpDay(s) }
        }),
      toggleStar: (id) =>
        set((s) => {
          const prev = s.words[id] ?? { box: 0, right: 0, wrong: 0, last: 0 }
          return { words: { ...s.words, [id]: { ...prev, starred: !prev.starred, mod: Date.now() } } }
        }),
      setFocusLevel: (focusLevel) => set({ focusLevel }),
      setBestRun: (n) => set((s) => ({ bestRun: Math.max(s.bestRun, n) })),
      reset: () =>
        set({ words: {}, xp: 0, streak: 0, lastStudyDay: '', todayCount: 0, bestRun: 0, resetAt: Date.now() }),
      mergeRemote: (remote) => set((s) => mergeSnapshots(snapshotOf(s), remote)),
      clearLocal: () =>
        set({ words: {}, xp: 0, streak: 0, lastStudyDay: '', todayCount: 0, bestRun: 0, resetAt: 0, owner: '' }),
      setOwner: (owner) => set({ owner }),
    }),
    { name: 'spelling-hive-progress' },
  ),
)

function bumpDay(s: ProgressState): Pick<ProgressState, 'streak' | 'lastStudyDay' | 'todayCount'> {
  const t = today()
  const last = normDay(s.lastStudyDay)
  if (last === t) return { streak: s.streak, lastStudyDay: t, todayCount: s.todayCount + 1 }
  const streak = last === yesterday() ? s.streak + 1 : 1
  return { streak, lastStudyDay: t, todayCount: 1 }
}

/** Today's count, treating a stale day as zero. */
export function todayCountOf(s: Pick<ProgressState, 'lastStudyDay' | 'todayCount'>): number {
  return normDay(s.lastStudyDay) === today() ? s.todayCount : 0
}

export function liveStreak(s: Pick<ProgressState, 'lastStudyDay' | 'streak'>): number {
  const d = normDay(s.lastStudyDay)
  return d === today() || d === yesterday() ? s.streak : 0
}
