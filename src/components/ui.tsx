import type { ReactNode } from 'react'
import { speak, stopSpeaking } from '../lib/voice'
import { LEVEL_NAMES, type Level, type Word } from '../types'
import { useSpeaking } from './hooks'

export function SpeakButton({
  text,
  children,
  className = 'btn btn-ghost',
  onSpeak,
}: {
  text: string | (() => Promise<void>)
  children: ReactNode
  className?: string
  onSpeak?: () => void
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        onSpeak?.()
        if (typeof text === 'string') void speak(text)
        else void text()
      }}
    >
      {children}
    </button>
  )
}

export function StopButton() {
  const speaking = useSpeaking()
  if (!speaking) return null
  return (
    <button type="button" className="btn btn-ghost px-3 py-2 text-sm" onClick={stopSpeaking}>
      ⏹ Stop
    </button>
  )
}

export function LevelPicker({
  value,
  onChange,
  allowAll = false,
}: {
  value: Level | 0
  onChange: (l: Level | 0) => void
  allowAll?: boolean
}) {
  const options: (Level | 0)[] = allowAll ? [0, 1, 2, 3] : [1, 2, 3]
  return (
    <div className="inline-flex flex-wrap gap-2" role="radiogroup" aria-label="Difficulty level">
      {options.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={value === l}
          onClick={() => onChange(l)}
          className={`rounded-xl px-4 py-2 font-display font-semibold transition ${
            value === l ? 'bg-honey-400 text-night-900' : 'bg-white/5 text-honey-100 hover:bg-white/10'
          }`}
        >
          {l === 0 ? 'All' : `${'🐝'.repeat(l)} ${LEVEL_NAMES[l]}`}
        </button>
      ))}
    </div>
  )
}

export function ProgressBar({ value, max, color = 'bg-honey-400' }: { value: number; max: number; color?: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Definition, synonyms, sentence, origin and spelling tip for one word. */
export function WordInfo({ word, hideWord = false }: { word: Word; hideWord?: boolean }) {
  const mask = (s: string) => (hideWord ? maskWord(s, word) : s)
  return (
    <div className="grid gap-4 text-left sm:grid-cols-2">
      <section className="rounded-2xl bg-white/5 p-4 sm:col-span-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="label">Definition</span>
          <SpeakButton className="text-sm text-honey-300 hover:text-honey-100" text={`${word.pos}. ${word.def}`}>
            🔊 Read
          </SpeakButton>
        </div>
        <p className="text-lg leading-snug">
          <em className="mr-2 text-honey-300">{word.pos}</em>
          {mask(word.def)}
        </p>
      </section>
      <section className="rounded-2xl bg-white/5 p-4">
        <span className="label">Synonyms &amp; related words</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {word.syn.map((s) => (
            <SpeakButton key={s} className="chip hover:bg-honey-400/25" text={s}>
              {s}
            </SpeakButton>
          ))}
        </div>
      </section>
      <section className="rounded-2xl bg-white/5 p-4">
        <span className="label">Language of origin</span>
        <p className="mt-2 text-lg font-semibold">🌍 {word.origin}</p>
      </section>
      <section className="rounded-2xl bg-white/5 p-4 sm:col-span-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="label">Use it in a sentence</span>
          <SpeakButton className="text-sm text-honey-300 hover:text-honey-100" text={word.sent}>
            🔊 Read
          </SpeakButton>
        </div>
        <p className="text-lg italic">“{mask(word.sent)}”</p>
      </section>
      {!hideWord && (
        <section className="rounded-2xl border border-honey-400/30 bg-honey-400/10 p-4 sm:col-span-2">
          <span className="label">Spelling tip</span>
          <p className="mt-1 text-lg">💡 {word.hint}</p>
          {word.alts.length > 0 && (
            <p className="mt-2 text-sm text-honey-200/80">
              Also accepted: <strong>{word.alts.join(', ')}</strong>
            </p>
          )}
        </section>
      )}
    </div>
  )
}

/** Hides the target word inside a sentence so it doesn't give away the spelling. */
export function maskWord(text: string, word: Word): string {
  const forms = [word.word, ...word.alts].sort((a, b) => b.length - a.length)
  let out = text
  for (const f of forms) {
    const stem = f.length > 5 ? f.slice(0, -2) : f
    const re = new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'gi')
    out = out.replace(re, '_____')
  }
  return out
}
