import type { ReactNode } from "react"
import { CountUp } from "../../components/motion/CountUp"
import { Reveal } from "../../components/motion/Reveal"
import { useI18n, type MessageKey } from "../../lib/i18n"

/**
 * "How it works" + the live numbers, staged like a gallery wall: three framed
 * pictures lit by picture lights, each with a museum label, and a plaque with
 * the real counts. Generative art is inline SVG so nothing extra loads.
 */
export function GalleryWall({ live, artists, bids }: { live: number; artists: number; bids: number }) {
  const { t, locale } = useI18n()

  const frames: Array<{ art: ReactNode; title: string; text: string; raise: string; sold?: boolean }> = [
    { art: <Dawn />, title: t("catalog.how.discoverTitle"), text: t("catalog.how.discoverText"), raise: "lg:translate-y-6" },
    { art: <Ripples />, title: t("catalog.how.bidTitle"), text: t("catalog.how.bidText"), raise: "lg:-translate-y-4" },
    { art: <Sunburst />, title: t("catalog.how.winTitle"), text: t("catalog.how.winText"), raise: "lg:translate-y-6", sold: true },
  ]

  return (
    <section className="gallery-wall relative overflow-hidden border-y border-white/[.06]">
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 lg:px-10 lg:pb-24 lg:pt-28">
        <div className="grid gap-14 md:grid-cols-3 md:gap-8 lg:gap-14">
          {frames.map((frame, index) => (
            <Reveal key={frame.title} delay={index * 90} className={`gw-piece ${frame.raise}`}>
              <div className="gw-light" aria-hidden />
              <div className="gw-frame">
                <div className="gw-mat">
                  <div className="gw-canvas">{frame.art}</div>
                </div>
                {frame.sold && <span className="gw-dot" aria-hidden title="Sold" />}
              </div>
              <div className="gw-label">
                <p className="gw-no">{String(index + 1).padStart(2, "0")}</p>
                <p className="font-display text-lg font-semibold text-text">{frame.title}</p>
                <p className="mt-1.5 text-[13px] leading-6 text-text-secondary">{frame.text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* The plaque: real numbers, counted up once in view. */}
        <Reveal className="mx-auto mt-20 max-w-3xl lg:mt-24">
          <div className="gw-plaque grid grid-cols-3 divide-x divide-white/10">
            {([
              { value: live, label: "catalog.hero.statLive" },
              { value: artists, label: "catalog.hero.statArtists" },
              { value: bids, label: "catalog.hero.statBids" },
            ] satisfies Array<{ value: number; label: MessageKey }>).map((item) => (
              <div key={item.label} className="px-3 py-6 text-center sm:py-7">
                <CountUp
                  value={item.value}
                  format={(n) => n.toLocaleString(locale)}
                  className="block font-display text-3xl font-bold tabular-nums text-amber sm:text-4xl"
                />
                <p className="mt-1.5 text-[11px] uppercase tracking-[0.16em] text-text-muted sm:text-xs">{t(item.label)}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ── Generative "paintings" (peach/dusk palette) ───────────────────────── */

function Dawn() {
  return (
    <svg viewBox="0 0 200 250" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden>
      <defs>
        <linearGradient id="gw-sky1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2748" />
          <stop offset="0.55" stopColor="#c0627a" />
          <stop offset="1" stopColor="#f6a87b" />
        </linearGradient>
        <radialGradient id="gw-sun1" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff1dc" />
          <stop offset="1" stopColor="#fff1dc" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="250" fill="url(#gw-sky1)" />
      <circle cx="100" cy="150" r="70" fill="url(#gw-sun1)" opacity="0.65" />
      <circle cx="100" cy="152" r="26" fill="#ffe3bf" />
      <path d="M0 175 L45 138 L72 162 L118 120 L160 158 L200 140 V250 H0Z" fill="#4a2f4f" />
      <path d="M0 200 L38 176 L82 198 L130 170 L200 205 V250 H0Z" fill="#2c1c36" />
      <path d="M0 226 Q60 210 120 224 T200 218 V250 H0Z" fill="#1b1220" />
      {/* the looking glass */}
      <circle cx="150" cy="80" r="21" fill="none" stroke="#fff1dc" strokeOpacity="0.85" strokeWidth="2.4" />
      <path d="M165 96 L180 113" stroke="#fff1dc" strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function Ripples() {
  return (
    <svg viewBox="0 0 200 250" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden>
      <defs>
        <radialGradient id="gw-bg2" cx="0.5" cy="0.45" r="0.8">
          <stop offset="0" stopColor="#5a2f5e" />
          <stop offset="1" stopColor="#1d1424" />
        </radialGradient>
      </defs>
      <rect width="200" height="250" fill="url(#gw-bg2)" />
      {[18, 34, 52, 72, 94, 118].map((r, i) => (
        <circle
          key={r}
          cx="100"
          cy="112"
          r={r}
          fill="none"
          stroke="#f6a87b"
          strokeWidth={2.2 - i * 0.25}
          className="gw-ring"
          style={{ animationDelay: `${i * 0.35}s`, opacity: 0.9 - i * 0.12 }}
        />
      ))}
      <circle cx="100" cy="112" r="7" fill="#ff4d4d" />
      <circle cx="100" cy="112" r="7" fill="#ff4d4d" className="gw-ping" />
      {/* the gavel */}
      <g transform="rotate(-28 110 196)" fill="#f6dcc0">
        <rect x="80" y="176" width="34" height="46" rx="7" />
        <rect x="76" y="184" width="42" height="6" rx="3" fill="#d9b99c" />
        <rect x="76" y="208" width="42" height="6" rx="3" fill="#d9b99c" />
        <rect x="112" y="195" width="58" height="8" rx="4" />
      </g>
      <rect x="62" y="222" width="76" height="6" rx="3" fill="#f6dcc0" fillOpacity="0.55" />
    </svg>
  )
}

function Sunburst() {
  const rays = Array.from({ length: 24 }, (_, i) => i)
  return (
    <svg viewBox="0 0 200 250" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden>
      <defs>
        <linearGradient id="gw-bg3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6a87b" />
          <stop offset="1" stopColor="#7a3a5a" />
        </linearGradient>
      </defs>
      <rect width="200" height="250" fill="url(#gw-bg3)" />
      <g transform="translate(100 118)" className="gw-spin">
        {rays.map((i) => (
          <path key={i} d="M0 0 L-5 -150 L5 -150Z" fill="#fff1dc" fillOpacity={i % 2 ? 0.22 : 0.4} transform={`rotate(${i * 15})`} />
        ))}
      </g>
      {/* laurel wreath around the winner's cup */}
      <g fill="none" stroke="#fff1dc" strokeWidth="2.2" strokeLinecap="round" opacity="0.95">
        <path d="M58 150 Q44 118 62 84" />
        <path d="M142 150 Q156 118 138 84" />
      </g>
      <g fill="#fff1dc">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <ellipse cx={55 + i * 1.5} cy={140 - i * 13} rx="3.2" ry="7" transform={`rotate(-28 ${55 + i * 1.5} ${140 - i * 13})`} />
            <ellipse cx={145 - i * 1.5} cy={140 - i * 13} rx="3.2" ry="7" transform={`rotate(28 ${145 - i * 1.5} ${140 - i * 13})`} />
          </g>
        ))}
      </g>
      <path d="M82 84 h36 v22 a18 18 0 0 1 -36 0Z M100 124 v18 M86 146 h28" fill="#fff1dc" stroke="#fff1dc" strokeWidth="3" strokeLinecap="round" />
      <path d="M82 92 h-10 a10 10 0 0 0 10 14 M118 92 h10 a10 10 0 0 1 -10 14" fill="none" stroke="#fff1dc" strokeWidth="3" />
    </svg>
  )
}
