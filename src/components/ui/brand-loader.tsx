import { useI18n } from "../../lib/i18n"

/** A small ring spinner for buttons and inline waits. Inherits the text colour. */
export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/**
 * TSISKARI means "dawn": a sun rising over a horizon line, with the wordmark
 * underneath. Use it anywhere a whole page or panel is waiting.
 * The same artwork is inlined in index.html for the very first paint.
 */
export function BrandLoader({
  label,
  fullscreen = false,
  className = "",
}: {
  label?: string
  /** Covers the viewport instead of filling its parent. */
  fullscreen?: boolean
  className?: string
}) {
  const { t } = useI18n()
  const text = label ?? t("common.loading")
  return (
    <div
      role="status"
      aria-live="polite"
      className={`brand-loader ${fullscreen ? "brand-loader--full" : ""} ${className}`}
    >
      <div className="brand-loader__mark">
        <svg viewBox="0 0 120 64" aria-hidden="true">
          <defs>
            <linearGradient id="bl-sun" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffd2b0" />
              <stop offset="1" stopColor="#f6a87b" />
            </linearGradient>
            <linearGradient id="bl-line" x1="0" x2="1">
              <stop offset="0" stopColor="#f6a87b" stopOpacity="0" />
              <stop offset=".5" stopColor="#f6a87b" />
              <stop offset="1" stopColor="#f6a87b" stopOpacity="0" />
            </linearGradient>
            <clipPath id="bl-clip">
              <rect x="0" y="0" width="120" height="44" />
            </clipPath>
          </defs>
          <circle className="brand-loader__glow" cx="60" cy="44" r="34" fill="#f6a87b" />
          <g clipPath="url(#bl-clip)">
            <circle className="brand-loader__sun" cx="60" cy="44" r="22" fill="url(#bl-sun)" />
          </g>
          <rect x="6" y="44" width="108" height="2" rx="1" fill="url(#bl-line)" />
        </svg>
      </div>
      <p className="brand-loader__word">TSISKARI</p>
      <p className="brand-loader__label">{text}</p>
    </div>
  )
}
