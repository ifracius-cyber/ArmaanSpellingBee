/**
 * Cloud save (Supabase). These are public values — a project URL and its publishable/anon key —
 * and are safe to ship in the page: the database only exposes two functions that need a save code.
 * Set them in `.env.local` (see .env.example) before `npm run build:single`.
 */
export const SUPABASE_URL = ((import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? '').replace(/\/+$/, '')
export const SUPABASE_KEY = (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? ''
export const CLOUD_ENABLED = Boolean(SUPABASE_URL && SUPABASE_KEY)
