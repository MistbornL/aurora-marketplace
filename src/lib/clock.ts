import { useState, useSyncExternalStore } from "react"
import { currentLang, tr } from "./i18n"

// One shared 1s ticker for the whole app instead of one setInterval per
// component. Components subscribe with a resolution (1s, 60s…) and only
// re-render when their visible value actually changes.
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer)
    timer = setInterval(() => listeners.forEach((notify) => notify()), 1000)
  return () => {
    listeners.delete(listener)
    if (!listeners.size && timer) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

/** Seconds remaining from `initialSecs`, counted from first mount. */
export function useCountdown(initialSecs: number, resolutionSecs = 1) {
  const [deadline] = useState(() => Date.now() + initialSecs * 1000)
  const remaining = useSyncExternalStore(subscribe, () => {
    const secs = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
    // Round up to the requested resolution so the snapshot is stable
    // between ticks that don't change what's on screen.
    return resolutionSecs > 1
      ? Math.ceil(secs / resolutionSecs) * resolutionSecs
      : secs
  })
  return {
    secs: remaining,
    h: Math.floor(remaining / 3600),
    m: Math.floor((remaining % 3600) / 60),
    s: remaining % 60,
  }
}

/**
 * Seconds left until a deadline the server told us about. Re-anchors whenever
 * `key` changes (e.g. a live lot's end moves after each bid) and is immune to
 * the device clock being off, because it counts from the server's `secs`.
 */
export function useRemaining(secs: number, key: string | null | undefined) {
  const [anchor, setAnchor] = useState(() => ({ key, deadline: Date.now() + secs * 1000 }))
  if (anchor.key !== key) setAnchor({ key, deadline: Date.now() + secs * 1000 })
  return useSyncExternalStore(subscribe, () =>
    Math.max(0, Math.ceil((anchor.deadline - Date.now()) / 1000)),
  )
}

export const pad = (n: number) => String(n).padStart(2, "0")

/** "2d 4h 10m" for long waits, "01:02:03" under a day, "Ended" at zero. */
export function formatLeft(secs: number) {
  if (secs <= 0) return tr("common.ended")
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (d > 0) return currentLang() === "ka" ? `${d}დ ${h}სთ ${m}წთ` : `${d}d ${h}h ${m}m`
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}
