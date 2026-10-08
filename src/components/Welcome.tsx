import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { dismissWelcome } from '../lib/auth'
import { useSettings } from '../lib/store'
import { speak } from '../lib/voice'

const WelcomeScene = lazy(() => import('../three/WelcomeScene'))

const TOTAL_MS = 4700 // the whole sequence, fade included, stays under 5 seconds
const FADE_MS = 500

/** Full-screen welcome animation shown once right after signing in. */
export default function Welcome() {
  const name = useSettings((s) => s.learnerName)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [leaving, setLeaving] = useState(false)
  const nameRef = useRef(name)
  nameRef.current = name

  // Timers start once on mount and are never restarted (e.g. if the name loads a moment later),
  // so the sequence always ends on time.
  useEffect(() => {
    const total = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1800 : TOTAL_MS
    const fade = setTimeout(() => setLeaving(true), total - FADE_MS)
    const done = setTimeout(dismissWelcome, total)
    void speak(`Welcome to the hive, ${nameRef.current}! Let's get buzzing!`)
    return () => {
      clearTimeout(fade)
      clearTimeout(done)
    }
  }, [])

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center bg-night-950/85 backdrop-blur-sm transition-opacity duration-500 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      role="status"
      aria-live="polite"
    >
      {!reduced && (
        <div className="absolute inset-0">
          <Suspense fallback={null}>
            <WelcomeScene name={name} />
          </Suspense>
        </div>
      )}
      <div className="welcome-text pointer-events-none absolute inset-x-4 bottom-[14%] text-center">
        <p className="font-display text-4xl font-bold text-honey-300 drop-shadow-lg sm:text-5xl">
          Welcome to the Hive, {name}!
        </p>
        <p className="mt-2 text-lg text-honey-100">Let&apos;s get buzzing 🐝</p>
      </div>
      <button
        type="button"
        onClick={dismissWelcome}
        className="btn btn-ghost absolute right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] px-4 py-2 text-sm"
      >
        Skip ▶
      </button>
    </div>
  )
}
