import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Level } from '../types'

const DEFAULT_VOICE = 'hpp4J3VqNfWAUOO0d1Us'

interface SettingsState {
  learnerName: string
  apiKey: string
  useElevenLabs: boolean
  voiceId: string
  modelId: string
  speed: number
  dailyGoal: number
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      learnerName: 'Armaan',
      apiKey: '',
      useElevenLabs: true,
      voiceId: DEFAULT_VOICE,
      modelId: 'eleven_multilingual_v2',
      speed: 0.9,
      dailyGoal: 20,
      set: (patch) => set(patch),
    }),
    { name: 'spelling-hive-settings' },
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
  last: number // epoch ms
  starred?: boolean
}

export const MASTERED_BOX = 4
const BOX_DELAY_HOURS = [0, 0, 12, 24, 72, 168]

export function isDue(p: WordProgress | undefined, now = Date.now()): boolean {
  if (!p) return true
  return now - p.last >= BOX_DELAY_HOURS[Math.min(p.box, 5)] * 3600_000
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function yesterday(): string {
  const d = new Date(Date.now() - 86400_000)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

interface ProgressState {
  words: Record<number, WordProgress>
  xp: number
  streak: number
  lastStudyDay: string
  todayCount: number
  bestRun: number
  focusLevel: Level
  record: (id: number, correct: boolean) => void
  markKnown: (id: number, known: boolean) => void
  toggleStar: (id: number) => void
  setFocusLevel: (l: Level) => void
  reset: () => void
  setBestRun: (n: number) => void
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
      record: (id, correct) =>
        set((s) => {
          const prev = s.words[id] ?? { box: 0, right: 0, wrong: 0, last: 0 }
          const next: WordProgress = {
            ...prev,
            box: correct ? Math.min(prev.box + 1, 5) : 1,
            right: prev.right + (correct ? 1 : 0),
            wrong: prev.wrong + (correct ? 0 : 1),
            last: Date.now(),
          }
          return { words: { ...s.words, [id]: next }, xp: s.xp + (correct ? 10 : 2), ...bumpDay(s) }
        }),
      markKnown: (id, known) =>
        set((s) => {
          const prev = s.words[id] ?? { box: 0, right: 0, wrong: 0, last: 0 }
          const next = { ...prev, box: known ? Math.max(prev.box, 2) : 1, last: Date.now() }
          return { words: { ...s.words, [id]: next }, xp: s.xp + 1, ...bumpDay(s) }
        }),
      toggleStar: (id) =>
        set((s) => {
          const prev = s.words[id] ?? { box: 0, right: 0, wrong: 0, last: 0 }
          return { words: { ...s.words, [id]: { ...prev, starred: !prev.starred } } }
        }),
      setFocusLevel: (focusLevel) => set({ focusLevel }),
      setBestRun: (n) => set((s) => ({ bestRun: Math.max(s.bestRun, n) })),
      reset: () => set({ words: {}, xp: 0, streak: 0, lastStudyDay: '', todayCount: 0, bestRun: 0 }),
    }),
    { name: 'spelling-hive-progress' },
  ),
)

function bumpDay(s: ProgressState): Pick<ProgressState, 'streak' | 'lastStudyDay' | 'todayCount'> {
  const t = today()
  if (s.lastStudyDay === t) return { streak: s.streak, lastStudyDay: t, todayCount: s.todayCount + 1 }
  const streak = s.lastStudyDay === yesterday() ? s.streak + 1 : 1
  return { streak, lastStudyDay: t, todayCount: 1 }
}

/** Today's count, treating a stale day as zero. */
export function todayCountOf(s: Pick<ProgressState, 'lastStudyDay' | 'todayCount'>): number {
  return s.lastStudyDay === today() ? s.todayCount : 0
}

export function liveStreak(s: Pick<ProgressState, 'lastStudyDay' | 'streak'>): number {
  return s.lastStudyDay === today() || s.lastStudyDay === yesterday() ? s.streak : 0
}
