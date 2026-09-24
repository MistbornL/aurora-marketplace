import { cn } from "../../lib/utils"

/**
 * Round avatar: the uploaded photo, or initials on a warm gradient.
 * Used by the navbar and account menu.
 */
export function UserAvatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string
  src?: string | null
  size?: number
  className?: string
}) {
  const initials =
    name
      .trim()
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-amber to-[#b8862f] font-display font-bold text-bg select-none",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  )
}
