import { createContext, useContext, useEffect, useState } from 'react'
import { onSpeaking } from '../lib/voice'
import type { Word } from '../types'

export const WordsContext = createContext<Word[]>([])
export const useWords = () => useContext(WordsContext)

export const CelebrateContext = createContext<() => void>(() => {})
export const useCelebrate = () => useContext(CelebrateContext)

export function useSpeaking(): boolean {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => onSpeaking(setSpeaking), [])
  return speaking
}

export type Route = 'home' | 'learn' | 'practice' | 'words' | 'settings'
const ROUTES: Route[] = ['home', 'learn', 'practice', 'words', 'settings']

function parseHash(): { route: Route; param: string } {
  const [, r = 'home', param = ''] = window.location.hash.split('/')
  return { route: (ROUTES as string[]).includes(r) ? (r as Route) : 'home', param: decodeURIComponent(param) }
}

/** Tiny hash router — no server config needed wherever the app is hosted. */
export function useRoute() {
  const [state, setState] = useState(parseHash)
  useEffect(() => {
    const onChange = () => {
      setState(parseHash())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return state
}

export function go(route: Route, param?: string | number) {
  window.location.hash = `/${route}${param !== undefined ? `/${encodeURIComponent(String(param))}` : ''}`
}
