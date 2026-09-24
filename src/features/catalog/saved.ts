import { useEffect, useState } from "react"
import { tr } from "../../lib/i18n"
import { notify } from "../../lib/notify"

// Saved artworks (watchlist) are a per-browser convenience kept in localStorage.
const KEY = "aurora:saved-artworks"
const EVENT = "aurora:saved-updated"

export function getSavedIds(): string[] {
  try {
    // String() keeps older saves (numeric ids) working.
    return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown[]).map(
      String,
    )
  } catch {
    return []
  }
}

export function setSaved(id: string, saved: boolean, title?: string) {
  const current = getSavedIds()
  const next = saved
    ? [...new Set([...current, id])]
    : current.filter((item) => item !== id)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable (private mode) */
  }
  window.dispatchEvent(new Event(EVENT))
  if (saved)
    notify(tr("catalog.saved.title"), tr("catalog.saved.detail", { title: title ?? tr("catalog.saved.artwork") }))
}

export function useSavedIds() {
  const [ids, setIds] = useState<string[]>(getSavedIds)
  useEffect(() => {
    const sync = () => setIds(getSavedIds())
    window.addEventListener(EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])
  return ids
}
