import { useEffect, useRef, useState } from "react"
import { prefersReducedMotion, useInView } from "../../lib/motion"

/** Counts from 0 to `value` once, when it scrolls into view. */
export function CountUp({
  value,
  duration = 1200,
  format = (n: number) => String(n),
  className,
}: {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, "0px 0px -40px 0px")
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (prefersReducedMotion() || value === 0) { setShown(value); return }
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      setShown(Math.round((1 - Math.pow(1 - p, 4)) * value)) // ease-out quart
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration])

  return (
    <span ref={ref} className={className} aria-label={format(value)}>
      <span aria-hidden>{format(shown)}</span>
    </span>
  )
}
