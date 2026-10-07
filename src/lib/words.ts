import type { Level, Word } from '../types'

let cache: Promise<Word[]> | null = null

/** Lazily loads the word list (kept in its own chunk so the first paint is fast). */
export function loadWords(): Promise<Word[]> {
  cache ??= import('../data/words.json').then((m) => m.default as Word[])
  return cache
}

/** Strips accents, case and curly quotes so "passé" and "PASSE" compare equal. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function isCorrect(word: Word, answer: string): boolean {
  const a = normalize(answer)
  return [word.word, ...word.alts].some((w) => normalize(w) === a)
}

export function firstLetter(w: Word): string {
  return normalize(w.word).charAt(0).toUpperCase()
}

export function byLevel(words: Word[], level: Level | 0): Word[] {
  return level === 0 ? words : words.filter((w) => w.level === level)
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Turns a word into the letter sequence a speller says aloud: "A, B, A, F, T". */
export function spellOut(word: string): string {
  return [...word]
    .map((c) => {
      if (c === ' ') return 'space'
      if (c === '-') return 'hyphen'
      if (c === "'" || c === '’') return 'apostrophe'
      if (c === '.') return 'period'
      return c.toUpperCase()
    })
    .join(', ')
}
