import { useLayoutEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"

/**
 * On every page change a dusk curtain is already down and lifts to reveal the
 * new page — the same feel as the hero's closing shot. It never blocks input
 * (pointer-events: none) and is skipped for reduced motion and the first load.
 */
export function RouteCurtain() {
  const { pathname } = useLocation()
  const previous = useRef(pathname)
  const [run, setRun] = useState(0)

  useLayoutEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    setRun((n) => n + 1)
  }, [pathname])

  if (run === 0) return null
  return <div key={run} aria-hidden className="route-curtain" />
}
