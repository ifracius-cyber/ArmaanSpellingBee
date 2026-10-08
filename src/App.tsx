import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { CelebrateContext, go, useRoute, WordsContext, type Route } from './components/hooks'
import { loadWords } from './lib/words'
import { startCloudSync } from './lib/cloud'
import CloudBadge from './components/CloudBadge'
import type { Word } from './types'
import HomePage from './pages/Home'
import LearnPage from './pages/Learn'
import PracticePage from './pages/Practice'
import WordsPage from './pages/WordList'
import SettingsPage from './pages/Settings'

const HiveBackground = lazy(() => import('./three/HiveBackground'))
const Confetti = lazy(() => import('./three/Confetti'))

const NAV: { route: Route; label: string; icon: string }[] = [
  { route: 'home', label: 'Hive', icon: '🏠' },
  { route: 'learn', label: 'Learn', icon: '📖' },
  { route: 'practice', label: 'Spelling Bee', icon: '🎤' },
  { route: 'words', label: 'Word List', icon: '🗂️' },
  { route: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  const { route, param } = useRoute()
  const [words, setWords] = useState<Word[] | null>(null)
  const [burst, setBurst] = useState(0)
  const burstTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    loadWords().then(setWords)
    startCloudSync()
  }, [])

  const celebrate = useCallback(() => {
    setBurst((b) => b + 1)
    clearTimeout(burstTimer.current)
    burstTimer.current = setTimeout(() => setBurst(0), 3500)
  }, [])

  return (
    <CelebrateContext.Provider value={celebrate}>
      <WordsContext.Provider value={words ?? []}>
        <Suspense fallback={null}>
          <HiveBackground excited={burst > 0} />
          <Confetti burstKey={burst} />
        </Suspense>

        <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-28 sm:pb-10">
          <header className="flex items-center justify-between gap-3 py-4">
            <button type="button" onClick={() => go('home')} className="flex items-center gap-2 text-left">
              <span className="text-3xl" aria-hidden>
                🐝
              </span>
              <span className="font-display text-xl leading-tight font-bold text-honey-300 sm:text-2xl">
                Spelling Hive
                <span className="block text-xs font-medium tracking-wide text-honey-100/70">
                  Dallas Regional Spelling Bee · 2027 Words of the Champions
                </span>
              </span>
            </button>
            <div className="flex items-center gap-2">
              <CloudBadge />
              <nav className="hidden gap-1 sm:flex" aria-label="Main">
                {NAV.map((n) => (
                  <NavButton key={n.route} {...n} active={route === n.route} />
                ))}
              </nav>
            </div>
          </header>

          <main className="flex-1">
            {!words ? (
              <div className="glass mt-20 rounded-3xl p-10 text-center font-display text-2xl">Buzzing up the word list…</div>
            ) : route === 'learn' ? (
              <LearnPage initialId={param} />
            ) : route === 'practice' ? (
              <PracticePage />
            ) : route === 'words' ? (
              <WordsPage />
            ) : route === 'settings' ? (
              <SettingsPage />
            ) : (
              <HomePage />
            )}
          </main>
        </div>

        {/* bottom tab bar on phones/tablets */}
        <nav
          className="glass fixed inset-x-0 bottom-0 z-40 flex justify-around rounded-t-3xl px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden"
          aria-label="Main"
        >
          {NAV.map((n) => (
            <NavButton key={n.route} {...n} active={route === n.route} compact />
          ))}
        </nav>
      </WordsContext.Provider>
    </CelebrateContext.Provider>
  )
}

function NavButton({
  route,
  label,
  icon,
  active,
  compact,
}: {
  route: Route
  label: string
  icon: string
  active: boolean
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => go(route)}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-1.5 rounded-xl font-display font-semibold transition ${
        compact ? 'flex-col px-2 py-1 text-[11px]' : 'px-3 py-2 text-sm'
      } ${active ? 'bg-honey-400 text-night-900' : 'text-honey-100 hover:bg-white/10'}`}
    >
      <span className={compact ? 'text-xl' : ''} aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  )
}
