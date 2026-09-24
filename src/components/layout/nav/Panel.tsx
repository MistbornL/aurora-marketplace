import type { ReactNode } from "react"
import { cn } from "../../../lib/utils"

/** Dropdown surface used by every navbar panel, so they look and animate the same. */
export function Panel({
  children,
  className,
  label,
}: {
  children: ReactNode
  className?: string
  label: string
}) {
  return (
    <div
      role="dialog"
      aria-label={label}
      className={cn(
        "absolute right-0 top-[calc(100%+10px)] z-[60] origin-top-right rounded-2xl border border-white/10 bg-[#16161d] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl",
        "animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150",
        className,
      )}
    >
      {children}
    </div>
  )
}
