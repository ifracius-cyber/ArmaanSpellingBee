import { CLOUD_ENABLED } from '../config'
import { useAuth } from '../lib/auth'
import { syncNow, useCloud } from '../lib/cloud'
import { useSettings } from '../lib/store'

const LABEL = {
  off: '☁️ Sign in to save',
  syncing: '☁️ Saving…',
  saved: '☁️ Saved',
  offline: '☁️ Offline, will save later',
  error: '⚠️ Not saved',
} as const

/** Small header pill showing whether progress is backed up to the learner's account. */
export default function CloudBadge() {
  const { status, message } = useCloud()
  const signedIn = useAuth((s) => Boolean(s.session))
  if (!CLOUD_ENABLED) return null
  const shown = signedIn ? (status === 'off' ? 'syncing' : status) : 'off'
  return (
    <button
      type="button"
      title={message || undefined}
      onClick={() => (signedIn ? void syncNow() : useSettings.getState().set({ guest: false }))}
      className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
        shown === 'error'
          ? 'bg-rose-400/20 text-rose-200'
          : shown === 'off'
            ? 'bg-honey-400 text-night-900'
            : 'bg-white/10 text-honey-100'
      }`}
    >
      {LABEL[shown]}
    </button>
  )
}
