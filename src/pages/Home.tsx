import { useMemo } from 'react'
import { go, useWords } from '../components/hooks'
import { ProgressBar, SpeakButton } from '../components/ui'
import { isDue, liveStreak, MASTERED_BOX, todayCountOf, useProgress, useSettings } from '../lib/store'
import { hasElevenLabs } from '../lib/voice'
import { LEVEL_BLURBS, LEVEL_NAMES, type Level } from '../types'

export default function HomePage() {
  const words = useWords()
  const progress = useProgress()
  const { learnerName, dailyGoal } = useSettings()
  const todayCount = todayCountOf(progress)
  const streak = liveStreak(progress)

  const stats = useMemo(() => {
    const per = { 1: { total: 0, mastered: 0, seen: 0 }, 2: { total: 0, mastered: 0, seen: 0 }, 3: { total: 0, mastered: 0, seen: 0 } }
    let review = 0
    for (const w of words) {
      const p = progress.words[w.id]
      per[w.level].total++
      if (p) {
        per[w.level].seen++
        if (p.box >= MASTERED_BOX) per[w.level].mastered++
        if (p.box > 0 && p.box < MASTERED_BOX && isDue(p)) review++
      }
    }
    return { per, review }
  }, [words, progress.words])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6">
      <section className="glass pop-in rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="label">{greeting}</p>
            <h1 className="mt-1 font-display text-4xl font-bold text-honey-300 sm:text-5xl">Hi, {learnerName}! 👋</h1>
            <p className="mt-2 max-w-md text-lg text-honey-100/90">
              Every champion speller practices a little bit every day. Let&apos;s get buzzing!
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <SpeakButton
                className="btn btn-ghost"
                text={`${greeting}, ${learnerName}! Welcome to your Spelling Hive. Let's learn some new words today. You can do it!`}
              >
                🔊 Say hello
              </SpeakButton>
              {!hasElevenLabs() && (
                <button type="button" className="btn btn-ghost text-sm" onClick={() => go('settings')}>
                  🎙️ Set up ElevenLabs voice
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Day streak" value={`${streak}🔥`} />
            <Stat label="Honey points" value={`${progress.xp}🍯`} />
            <Stat label="Today" value={`${todayCount}/${dailyGoal}`} />
          </div>
        </div>
        <div className="mt-6">
          <div className="mb-1 flex justify-between text-sm">
            <span>Today&apos;s goal</span>
            <span>{todayCount >= dailyGoal ? 'Goal reached! 🎉' : `${dailyGoal - todayCount} words to go`}</span>
          </div>
          <ProgressBar value={todayCount} max={dailyGoal} color="bg-green-400" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <ActionCard
          icon="📖"
          title="Learn words"
          text="Hear each word, see what it means, and watch it spell itself out."
          onClick={() => go('learn')}
        />
        <ActionCard
          icon="🎤"
          title="Spelling Bee"
          text="Practice like the real bee — listen, ask questions, then spell it!"
          onClick={() => go('practice')}
          highlight
        />
        <ActionCard
          icon="🔁"
          title="Review"
          text={stats.review ? `${stats.review} words are ready for review.` : 'Missed words come back here to practice again.'}
          onClick={() => go('practice', 'review')}
        />
      </section>

      <section className="glass rounded-3xl p-6">
        <h2 className="font-display text-2xl font-bold text-honey-300">Your hive progress</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {([1, 2, 3] as Level[]).map((l) => {
            const s = stats.per[l]
            return (
              <button
                key={l}
                type="button"
                onClick={() => {
                  useProgress.getState().setFocusLevel(l)
                  go('learn')
                }}
                className="rounded-2xl bg-white/5 p-4 text-left transition hover:bg-white/10"
              >
                <div className="font-display text-xl font-semibold">
                  {'🐝'.repeat(l)} {LEVEL_NAMES[l]}
                </div>
                <p className="mt-1 text-sm text-honey-100/70">{LEVEL_BLURBS[l]}</p>
                <div className="mt-3 mb-1 flex justify-between text-sm">
                  <span>{s.mastered} mastered</span>
                  <span>{s.total} words</span>
                </div>
                <ProgressBar value={s.mastered} max={s.total} />
                <p className="mt-1 text-xs text-honey-100/60">{s.seen} studied so far</p>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 px-3 py-3">
      <div className="font-display text-2xl font-bold text-honey-300">{value}</div>
      <div className="text-xs text-honey-100/70">{label}</div>
    </div>
  )
}

function ActionCard({
  icon,
  title,
  text,
  onClick,
  highlight,
}: {
  icon: string
  title: string
  text: string
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`glass group rounded-3xl p-6 text-left transition hover:-translate-y-1 ${
        highlight ? 'ring-2 ring-honey-400' : ''
      }`}
    >
      <div className="text-4xl transition group-hover:scale-110" aria-hidden>
        {icon}
      </div>
      <h3 className="mt-2 font-display text-2xl font-bold text-honey-300">{title}</h3>
      <p className="mt-1 text-honey-100/80">{text}</p>
    </button>
  )
}
