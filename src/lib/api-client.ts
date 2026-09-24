import { supabase } from "./supabase"

export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api"

/** fetch() against the Node API, sending the Supabase session token when signed in. */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { signal?: AbortSignal } = {},
): Promise<T> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string
    }
    throw new Error(body.error || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}
