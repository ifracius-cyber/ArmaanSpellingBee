import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { CLOUD_ENABLED, SUPABASE_KEY, SUPABASE_URL } from '../config'

/** Shared Supabase client, or null when cloud features aren't configured for this build. */
export const supabase: SupabaseClient | null = CLOUD_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'spelling-hive-auth' },
    })
  : null
