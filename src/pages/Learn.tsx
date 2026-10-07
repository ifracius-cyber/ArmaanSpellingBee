import { useEffect, useMemo, useState } from 'react'
import { useWords } from '../components/hooks'
import { LevelPicker, SpeakButton, StopButton, WordInfo } from '../components/ui'
import { MASTERED_BOX, useProgress } from '../lib/store'
import { speak, speakSequence, stopSpeaking } from '../lib/voice'
import { byLevel, firstLetter, spellOut } from '../lib/words'
import LetterTiles, { useLetterReveal } from '../three/LetterTiles'
import type { Level } from '../types'

type Filter = 'all' | 'new' | 'learning' | 'starred'

const LETTER_MS = 520

export default function LearnPage({ initialId }: { initialId?: string }) {
  const words = useWords()
  const { focusLevel, setFocusLevel, words: progress, markKnown, toggleStar } = useProgress()
  const [letter, setLetter] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [index, setIndex] = useState(0)

  // Jump straight to a word when opened from the word list (#/learn/<id>).
  useEffect(() => {
    if (!initialId) return
    const w = words.find((x) => String(x.id) === initialId)
    if (w) {
      setFocusLevel(w.level)
      setLetter(firstLetter(w))
      setFilter('all')
    }
  }, [initialId, words, setFocusLevel])

  const levelWords = useMemo(() => byLevel(words, focusLevel), [words, focusLevel])
  const letters = useMemo(() => [...new Set(levelWords.map(firstLetter))].sort(), [levelWords])
  const list = useMemo(
    () =>
      levelWords.filter((w) => {
        if (letter && firstLetter(w) !== letter) return false
        const p = progress[w.id]
        if (filter === 'new') return !p
        if (filter === 'learning') return !p || p.box < MASTERED_BOX
        if (filter === 'starred') return !!p?.starred
        return true
      }),
    // progress intentionally excluded so the list doesn't reshuffle while marking words
    [levelWords, letter, filter],
  )

  useEffect(() => {
    const target = initialId ? list.findIndex((w) => String(w.id) === initialId) : -1
    setIndex(target >= 0 ? target : 0)
  }, [list, initialId])

  const word = list[Math.min(index, list.length - 1)]
  const reveal = useLetterReveal(word?.word ?? '', LETTER_MS)

  useEffect(() => stopSpeaking, [])

  const next = (delta: number) => {
    stopSpeaking()
    setIndex((i) => (list.length ? (i + delta + list.length) % list.length : 0))
  }

  const spellIt = () => {
    if (!word) return
    reveal.start()
    void speakSequence([word.word, spellOut(word.word), word.word])
  }

  const teachMe = () => {
    if (!word) return
    reveal.start()
    void speakSequence([
      `The word is: ${word.word}.`,
      `It's ${/^[aeiou]/i.test(word.pos) ? 'an' : 'a'} ${word.pos}. It means: ${word.def}`,
      `Here it is in a sentence: ${word.sent}`,
      `It comes from ${word.origin}.`,
      `Some words with a similar meaning are: ${word.syn.join(', ')}.`,
      `Here's how to spell it: ${spellOut(word.word)}. ${word.word}.`,
      `Spelling tip: ${word.hint}`,
    ])
  }

  const p = word ? progress[word.id] : undefined

  return (
    <div className="space-y-4">
      <div className="glass flex flex-col gap-3 rounded-3xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LevelPicker value={focusLevel} onChange={(l) => (setFocusLevel(l as Level), setLetter(''))} />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="rounded-xl bg-white/10 px-3 py-2 font-semibold text-honey-100"
            aria-label="Which words"
          >
            <option value="all">All words</option>
            <option value="new">New words only</option>
            <option value="learning">Not mastered yet</option>
            <option value="starred">⭐ Starred</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1" aria-label="Starting letter">
          <LetterChip active={!letter} onClick={() => setLetter('')}>
            All
          </LetterChip>
          {letters.map((l) => (
            <LetterChip key={l} active={letter === l} onClick={() => setLetter(l)}>
              {l}
            </LetterChip>
          ))}
        </div>
      </div>

      {!word ? (
        <div className="glass rounded-3xl p-10 text-center text-xl">No words match. Try another filter! 🐝</div>
      ) : (
        <article key={word.id} className="glass pop-in rounded-3xl p-5 sm:p-8">
          <div className="flex items-center justify-between text-sm text-honey-100/70">
            <span>
              Word {index + 1} of {list.length}
            </span>
            <span className="flex items-center gap-2">
              {p && p.box >= MASTERED_BOX && <span className="chip">✅ Mastered</span>}
              <button
                type="button"
                onClick={() => toggleStar(word.id)}
                className="text-2xl"
                aria-label={p?.starred ? 'Unstar word' : 'Star word'}
                title="Star words you want to practice more"
              >
                {p?.starred ? '⭐' : '☆'}
              </button>
            </span>
          </div>

          <div className="mt-2 text-center">
            <h1 className="font-display text-5xl font-bold break-words text-honey-300 sm:text-6xl">{word.word}</h1>
            <LetterTiles
              word={word.word}
              revealCount={reveal.count}
              activeIndex={reveal.playing ? reveal.count - 1 : -1}
              height={140}
            />
            <div className="flex flex-wrap justify-center gap-3">
              <SpeakButton className="btn btn-honey" text={word.word}>
                🔊 Say it
              </SpeakButton>
              <button type="button" className="btn btn-honey" onClick={spellIt}>
                🔤 Spell it to me
              </button>
              <button type="button" className="btn btn-ghost" onClick={teachMe}>
                👩‍🏫 Teach me everything
              </button>
              <StopButton />
            </div>
          </div>

          <div className="mt-6">
            <WordInfo word={word} />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn btn-ghost" onClick={() => next(-1)}>
              ← Back
            </button>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-red"
                onClick={() => {
                  markKnown(word.id, false)
                  next(1)
                }}
              >
                🤔 Still learning
              </button>
              <button
                type="button"
                className="btn btn-green"
                onClick={() => {
                  markKnown(word.id, true)
                  void speak('Great job!')
                  next(1)
                }}
              >
                👍 I know it
              </button>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => next(1)}>
              Next →
            </button>
          </div>
        </article>
      )}
    </div>
  )
}

function LetterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-9 rounded-lg px-2 py-1 font-display font-semibold transition ${
        active ? 'bg-honey-400 text-night-900' : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}
