import { createBrowserClient } from "@supabase/ssr"

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** null when Supabase env vars are missing (the app still runs in demo mode). */
export const supabase = url && key ? createBrowserClient(url, key) : null

export function requireSupabase() {
  if (!supabase)
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.",
    )
  return supabase
}
