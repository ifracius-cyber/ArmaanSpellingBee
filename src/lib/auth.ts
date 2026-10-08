import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { useProgress, useSettings } from './store'
import { supabase } from './supabase'

interface AuthState {
  session: Session | null
  /** False until we've checked for a saved sign-in, so the sign-in page doesn't flash. */
  ready: boolean
  /** Set when the learner has just signed in, to play the welcome animation once. */
  welcome: boolean
}

export const useAuth = create<AuthState>(() => ({ session: null, ready: !supabase, welcome: false }))

export const isSignedIn = () => Boolean(useAuth.getState().session)

function applyProfile(session: Session | null) {
  const name = session?.user.user_metadata?.learner_name as string | undefined
  if (name) useSettings.getState().set({ learnerName: name })
}

let started = false

export function startAuth() {
  if (!supabase || started) return
  started = true
  supabase.auth.getSession().then(({ data }) => {
    applyProfile(data.session)
    useAuth.setState({ session: data.session, ready: true })
  })
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') applyProfile(session)
    // Clicking a "reset password" email link signs the learner in; send them to pick a new password.
    if (event === 'PASSWORD_RECOVERY') setTimeout(() => (location.hash = '/settings/new-password'), 0)
    useAuth.setState((s) => ({
      session,
      ready: true,
      // A sign-in that comes from clicking the confirmation email link also gets the welcome.
      welcome: s.welcome || (event === 'SIGNED_IN' && !s.session && /access_token|type=signup/.test(location.href)),
    }))
  })
}

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email or password isn’t right. Check them and try again.'
  if (/email not confirmed/i.test(message)) return 'Please confirm your email first — look for the message from Supabase in your inbox.'
  if (/already registered|already exists/i.test(message)) return 'There’s already an account with that email. Try signing in instead.'
  if (/password should be at least|weak password/i.test(message)) return 'Pick a longer password — at least 8 characters.'
  if (/rate limit|too many/i.test(message)) return 'Too many tries in a row. Wait a minute and try again.'
  if (/failed to fetch|network/i.test(message)) return 'Couldn’t reach the server. Check the internet connection.'
  return message
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Accounts aren’t set up in this copy of the app.')
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(friendly(error.message))
  useAuth.setState({ welcome: true })
}

/** Returns true if the learner is signed in right away, false if they must confirm their email first. */
export async function signUp(name: string, email: string, password: string): Promise<boolean> {
  if (!supabase) throw new Error('Accounts aren’t set up in this copy of the app.')
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { learner_name: name.trim() }, emailRedirectTo: location.origin + location.pathname },
  })
  if (error) throw new Error(friendly(error.message))
  if (data.session) {
    useSettings.getState().set({ learnerName: name.trim() })
    useAuth.setState({ welcome: true })
    return true
  }
  return false
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: location.origin + location.pathname,
  })
  if (error) throw new Error(friendly(error.message))
}

export async function signOut(): Promise<void> {
  // Save first, then empty this device so the next person to sign in starts with their own progress.
  const { syncNow } = await import('./cloud')
  await syncNow()
  await supabase?.auth.signOut()
  useProgress.getState().clearLocal()
}

/** Saves the learner's name on their account so it shows on every device. */
export async function saveLearnerName(name: string): Promise<void> {
  if (!supabase || !isSignedIn()) return
  await supabase.auth.updateUser({ data: { learner_name: name.trim() } })
}

export async function changePassword(password: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(friendly(error.message))
}

export const dismissWelcome = () => useAuth.setState({ welcome: false })
