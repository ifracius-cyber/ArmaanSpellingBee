import { CLOUD_ENABLED } from '../config'
import { syncNow, useCloud } from '../lib/cloud'
import { useSettings } from '../lib/store'
import { go } from './hooks'

const LABEL = {
  off: '☁️ Turn on cloud save',
  syncing: '☁️ Saving…',
  saved: '☁️ Saved',
  offline: '☁️ Offline — will save later',
  error: '⚠️ Not saved',
} as const

/** Small header pill showing whether progress is backed up. */
export default function CloudBadge() {
  const { status, message } = useCloud()
  const code = useSettings((s) => s.syncCode)
  if (!CLOUD_ENABLED) return null
  const shown = code ? status : 'off'
  return (
    <button
      type="button"
      title={message || undefined}
      onClick={() => (shown === 'error' || shown === 'offline' ? void syncNow() : go('settings'))}
      className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
        shown === 'error' ? 'bg-rose-400/20 text-rose-200' : shown === 'off' ? 'bg-honey-400 text-night-900' : 'bg-white/10 text-honey-100'
      }`}
    >
      {LABEL[shown]}
    </button>
  )
}
