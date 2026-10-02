// Tiny shared flag: "the cinematic landing hero is filling the screen right
// now". The Nav reads it to stay see-through over the footage instead of
// frosting the moment the page scrolls.
import { useSyncExternalStore } from "react"

let overHero = false
const listeners = new Set<() => void>()

export function setOverHero(value: boolean) {
  if (value === overHero) return
  overHero = value
  listeners.forEach((listener) => listener())
}

export function useOverHero() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => overHero,
    () => false,
  )
}
