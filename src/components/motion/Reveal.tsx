import { useRef, type ElementType, type ReactNode } from "react"
import { useInView } from "../../lib/motion"

/**
 * Fades and lifts its content in the first time it scrolls into view.
 * `delay` staggers siblings (keep it small: 60-80ms steps).
 * Styles live in globals.css (`.reveal`), including the reduced-motion fallback.
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className = "",
  children,
}: {
  as?: ElementType
  delay?: number
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref)
  return (
    <Tag
      ref={ref}
      data-in={inView || undefined}
      className={`reveal ${className}`}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  )
}
