import { useEffect, useMemo, useRef, useState } from 'react'
import { go, useCelebrate, useRoute, useWords } from '../components/hooks'
import { LevelPicker, ProgressBar, StopButton, WordInfo, maskWord } from '../components/ui'
import { isDue, MASTERED_BOX, useProgress } from '../lib/store'
import { speak, speakSequence, stopSpeaking } from '../lib/voice'
import { byLevel, isCorrect, normalize, shuffle, spellOut } from '../lib/words'
import LetterTiles, { type TileState } from '../three/LetterTiles'
import type { Level, Word } from '../types'

type Mode = 'smart' | 'review' | 'starred' | 'random'

const MODES: { id: Mode; label: string; text: string }[] = [
  { id: 'smart', label: '🧠 Smart mix', text: 'Words due for review first, then new ones.' },
  { id: 'review', label: '🔁 Missed words', text: 'Only words you have missed before.' },
  { id: 'starred', label: '⭐ Starred', text: 'Words you starred while learning.' },
  { id: 'random', label: '🎲 Random', text: 'Any words from the level.' },
]

const PRAISE = ['Correct! Great job!', 'That is correct!', 'Perfect spelling!', 'Yes! Nailed it!', 'Correct! You are a spelling star!']
const ENCOURAGE = ['Nice try! Let\'s look at it together.', 'Almost! Let\'s learn this one.', 'Good effort! Here is the right spelling.']

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

export default function PracticePage() {
  const { param } = useRoute()
  const words = useWords()
  const { focusLevel, setFocusLevel, words: progress } = useProgress()
  const [level, setLevel] = useState<Level | 0>(focusLevel)
  const [mode, setMode] = useState<Mode>(param === 'review' ? 'review' : 'smart')
  const [count, setCount] = useState(10)
  const [session, setSession] = useState<Word[] | null>(null)

  useEffect(() => stopSpeaking, [])

  const pool = useMemo(() => {
    const ws = byLevel(words, level)
    if (mode === 'review') return shuffle(ws.filter((w) => (progress[w.id]?.wrong ?? 0) > 0 && (progress[w.id]?.box ?? 0) < MASTERED_BOX))
    if (mode === 'starred') return shuffle(ws.filter((w) => progress[w.id]?.starred))
    if (mode === 'random') return shuffle(ws)
    const due = shuffle(ws.filter((w) => progress[w.id] && progress[w.id].box < 5 && isDue(progress[w.id])))
    due.sort((a, b) => progress[a.id].box - progress[b.id].box)
    const fresh = ws.filter((w) => !progress[w.id]) // keep alphabetical order for new words
    return [...due, ...fresh]
  }, [words, level, mode, progress])

  if (session) return <Session words={session} onDone={() => setSession(null)} />

  return (
    <div className="glass pop-in space-y-6 rounded-3xl p-6 sm:p-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-honey-300">🎤 Spelling Bee practice</h1>
        <p className="mt-2 text-lg text-honey-100/90">
          Just like on stage: listen to the word, ask for the definition, a sentence or the language of origin, then
          spell it!
        </p>
      </div>
      <div>
        <p className="label mb-2">Level</p>
        <LevelPicker
          value={level}
          allowAll
          onChange={(l) => {
            setLevel(l)
            if (l) setFocusLevel(l)
          }}
        />
      </div>
      <div>
        <p className="label mb-2">Which words</p>
        <div className="grid gap-2 sm:grid-cols-4">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-2xl p-3 text-left transition ${
                mode === m.id ? 'bg-honey-400 text-night-900' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="font-display font-semibold">{m.label}</div>
              <div className="text-sm opacity-80">{m.text}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label mb-2">How many words</p>
        <div className="flex flex-wrap gap-2">
          {[5, 10, 20, 50].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`rounded-xl px-5 py-2 font-display font-semibold ${
                count === n ? 'bg-honey-400 text-night-900' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="btn btn-honey text-xl"
          disabled={!pool.length}
          onClick={() => setSession(pool.slice(0, count))}
        >
          Start the bee! 🐝
        </button>
        <span className="text-honey-100/80">
          {pool.length ? `${pool.length} words available` : 'No words here yet — try another option.'}
        </span>
      </div>
    </div>
  )
}

function Session({ words, onDone }: { words: Word[]; onDone: () => void }) {
  const record = useProgress((s) => s.record)
  const setBestRun = useProgress((s) => s.setBestRun)
  const celebrate = useCelebrate()
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<null | { correct: boolean; attempt: string }>(null)
  const [results, setResults] = useState<{ word: Word; correct: boolean; attempt: string }[]>([])
  const [run, setRun] = useState(0)
  const [shake, setShake] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const word = words[i]
  const finished = i >= words.length

  useEffect(() => {
    if (!word) return
    setAnswer('')
    setResult(null)
    void speak(`Your word is: ${word.word}.`)
    input.current?.focus()
  }, [word])

  if (finished) return <Summary results={results} onAgain={onDone} />

  const submit = () => {
    if (!answer.trim() || result) return
    const correct = isCorrect(word, answer)
    record(word.id, correct)
    setResult({ correct, attempt: answer })
    setResults((r) => [...r, { word, correct, attempt: answer }])
    if (correct) {
      const nextRun = run + 1
      setRun(nextRun)
      setBestRun(nextRun)
      celebrate()
      void speak(pick(PRAISE))
    } else {
      setRun(0)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      void speakSequence([pick(ENCOURAGE), `${word.word} is spelled: ${spellOut(word.word)}.`, word.word])
    }
  }

  const tileStates: TileState[] | undefined = result
    ? [...word.word].map((ch, idx) =>
        result.correct ? 'correct' : normalize(result.attempt)[idx] === normalize(ch) ? 'correct' : 'wrong',
      )
    : undefined

  const ask = (text: string) => () => void speak(text)

  return (
    <div className="space-y-4">
      <div className="glass flex items-center gap-4 rounded-2xl p-3">
        <button type="button" className="btn btn-ghost px-3 py-1 text-sm" onClick={onDone}>
          ✕ End
        </button>
        <div className="flex-1">
          <ProgressBar value={i} max={words.length} />
        </div>
        <span className="font-display font-semibold">
          {i + 1}/{words.length}
        </span>
        <span className="chip">🔥 {run}</span>
      </div>

      <article className={`glass rounded-3xl p-5 sm:p-8 ${shake ? 'shake' : ''}`}>
        <div className="text-center">
          <p className="label">Listen carefully…</p>
          <button
            type="button"
            onClick={ask(word.word)}
            className="mx-auto mt-3 flex h-28 w-28 items-center justify-center rounded-full bg-honey-400 text-5xl text-night-900 shadow-[0_8px_0_#b45309] transition hover:scale-105 active:translate-y-1 active:shadow-[0_3px_0_#b45309]"
            aria-label="Hear the word again"
          >
            🔊
          </button>
          <p className="mt-3 text-sm text-honey-100/70">Tap to hear the word again</p>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-ghost py-2 text-base" onClick={ask(`${word.pos}. ${word.def}`)}>
            📘 Definition
          </button>
          <button type="button" className="btn btn-ghost py-2 text-base" onClick={ask(word.sent)}>
            💬 Sentence
          </button>
          <button type="button" className="btn btn-ghost py-2 text-base" onClick={ask(`The language of origin is ${word.origin}.`)}>
            🌍 Origin
          </button>
          <button type="button" className="btn btn-ghost py-2 text-base" onClick={ask(`It is ${/^[aeiou]/i.test(word.pos) ? 'an' : 'a'} ${word.pos}.`)}>
            🏷️ Part of speech
          </button>
          <StopButton />
        </div>

        {!result ? (
          <form
            className="mt-6 flex flex-col items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <p className="max-w-xl text-center text-honey-100/80">
              <em className="text-honey-300">{word.pos}</em> — {maskWord(word.def, word)}
            </p>
            <input
              ref={input}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your spelling…"
              aria-label="Your spelling"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full max-w-lg rounded-2xl border-2 border-honey-400/50 bg-night-950/70 px-5 py-4 text-center font-display text-3xl tracking-wider text-honey-100 outline-none placeholder:text-honey-100/30 focus:border-honey-400"
            />
            <div className="flex gap-3">
              <button type="submit" className="btn btn-honey" disabled={!answer.trim()}>
                ✅ Check my spelling
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setAnswer('?')
                  record(word.id, false)
                  setResult({ correct: false, attempt: '' })
                  setResults((r) => [...r, { word, correct: false, attempt: '(skipped)' }])
                  setRun(0)
                  void speakSequence([`${word.word} is spelled: ${spellOut(word.word)}.`, word.word])
                }}
              >
                🙋 Show me
              </button>
            </div>
          </form>
        ) : (
          <div className="pop-in mt-6 space-y-4 text-center">
            <h2 className={`font-display text-3xl font-bold ${result.correct ? 'text-green-300' : 'text-rose-300'}`}>
              {result.correct ? '🎉 Correct!' : '💪 Let’s learn this one'}
            </h2>
            <LetterTiles word={word.word} states={tileStates} height={130} />
            <p className="font-display text-4xl font-bold text-honey-300">{word.word}</p>
            {!result.correct && result.attempt && (
              <p className="text-honey-100/80">
                You spelled: <span className="font-semibold text-rose-300 line-through">{result.attempt}</span>
              </p>
            )}
            <WordInfo word={word} />
            <button type="button" className="btn btn-honey text-xl" onClick={() => setI((x) => x + 1)} autoFocus>
              {i + 1 < words.length ? 'Next word →' : 'See my results 🏆'}
            </button>
          </div>
        )}
      </article>
    </div>
  )
}

function Summary({ results, onAgain }: { results: { word: Word; correct: boolean; attempt: string }[]; onAgain: () => void }) {
  const right = results.filter((r) => r.correct).length
  const pct = results.length ? Math.round((right / results.length) * 100) : 0
  const celebrate = useCelebrate()
  useEffect(() => {
    if (pct >= 70) celebrate()
    void speak(
      pct === 100
        ? `Wow! You got every single word right! You are a spelling champion!`
        : `You spelled ${right} out of ${results.length} words correctly. Keep practicing, you're getting better every day!`,
    )
  }, [])

  return (
    <div className="glass pop-in space-y-5 rounded-3xl p-6 text-center sm:p-8">
      <div className="text-6xl">{pct === 100 ? '🏆' : pct >= 70 ? '🌟' : '🐝'}</div>
      <h1 className="font-display text-4xl font-bold text-honey-300">
        {right} / {results.length} correct
      </h1>
      <p className="text-lg">{pct === 100 ? 'Perfect round! Champion speller!' : pct >= 70 ? 'Awesome work!' : 'Every practice makes you stronger!'}</p>
      {results.some((r) => !r.correct) && (
        <div className="mx-auto max-w-lg rounded-2xl bg-white/5 p-4 text-left">
          <p className="label mb-2">Words to practice again</p>
          <ul className="space-y-1">
            {results
              .filter((r) => !r.correct)
              .map((r) => (
                <li key={r.word.id} className="flex items-center justify-between gap-2">
                  <button type="button" className="font-display text-xl text-honey-300 hover:underline" onClick={() => go('learn', r.word.id)}>
                    {r.word.word}
                  </button>
                  <span className="text-sm text-rose-300 line-through">{r.attempt}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="btn btn-honey" onClick={onAgain}>
          Play again 🐝
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => go('home')}>
          Back to the hive
        </button>
      </div>
    </div>
  )
}
