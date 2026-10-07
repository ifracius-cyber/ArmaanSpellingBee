import { useDeferredValue, useMemo, useState } from 'react'
import { go, useWords } from '../components/hooks'
import { LevelPicker } from '../components/ui'
import { MASTERED_BOX, useProgress } from '../lib/store'
import { speak } from '../lib/voice'
import { byLevel, normalize } from '../lib/words'
import type { Level } from '../types'

const PAGE = 60

export default function WordsPage() {
  const words = useWords()
  const progress = useProgress((s) => s.words)
  const [level, setLevel] = useState<Level | 0>(0)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const q = normalize(useDeferredValue(query))

  const list = useMemo(
    () =>
      byLevel(words, level).filter(
        (w) => !q || normalize(w.word).includes(q) || normalize(w.def).includes(q) || w.syn.some((s) => normalize(s).includes(q)),
      ),
    [words, level, q],
  )

  return (
    <div className="space-y-4">
      <div className="glass space-y-3 rounded-3xl p-4">
        <h1 className="font-display text-3xl font-bold text-honey-300">🗂️ All {words.length.toLocaleString()} words</h1>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShown(PAGE)
          }}
          placeholder="Search words, meanings or synonyms…"
          aria-label="Search"
          className="w-full rounded-2xl border border-honey-400/40 bg-night-950/60 px-4 py-3 text-lg outline-none focus:border-honey-400"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LevelPicker
            value={level}
            allowAll
            onChange={(l) => {
              setLevel(l)
              setShown(PAGE)
            }}
          />
          <span className="text-sm text-honey-100/70">{list.length} matching</span>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {list.slice(0, shown).map((w) => {
          const p = progress[w.id]
          return (
            <li key={w.id} className="glass flex gap-3 rounded-2xl p-4">
              <button
                type="button"
                onClick={() => void speak(w.word)}
                className="h-10 w-10 shrink-0 rounded-full bg-honey-400/20 text-lg hover:bg-honey-400/40"
                aria-label={`Hear ${w.word}`}
              >
                🔊
              </button>
              <button type="button" onClick={() => go('learn', w.id)} className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xl font-semibold text-honey-300">{w.word}</span>
                  <span className="text-xs">{'🐝'.repeat(w.level)}</span>
                  {p?.starred && <span>⭐</span>}
                  {p && p.box >= MASTERED_BOX && <span className="chip py-0 text-xs">mastered</span>}
                </div>
                <p className="line-clamp-2 text-sm text-honey-100/80">
                  <em>{w.pos}</em> — {w.def}
                </p>
              </button>
            </li>
          )
        })}
      </ul>
      {shown < list.length && (
        <div className="text-center">
          <button type="button" className="btn btn-ghost" onClick={() => setShown((s) => s + PAGE)}>
            Show more ({list.length - shown} left)
          </button>
        </div>
      )}
    </div>
  )
}
