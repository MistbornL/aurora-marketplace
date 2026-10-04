import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Gavel, X } from "lucide-react"
import { onSold, type SoldMoment } from "../../lib/celebrate"
import { useI18n } from "../../lib/i18n"
import { playGavel, soundMuted } from "../../features/catalog/hero/hero-sound"

const COLOURS = ["#f6a87b", "#ffd9c2", "#e88fa0", "#c9a6f0", "#fff1e6"]

type Mote = { x: number; y: number; vx: number; vy: number; r: number; life: number; c: string }

/** Warm dusk-coloured dust that bursts from the card and drifts down. */
function Dust({ origin }: { origin: { x: number; y: number } }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = innerWidth * dpr
      canvas.height = innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const motes: Mote[] = Array.from({ length: 140 }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 1.5 + Math.random() * 6
      return {
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        r: 1 + Math.random() * 2.6,
        life: 0.6 + Math.random() * 0.8,
        c: COLOURS[Math.floor(Math.random() * COLOURS.length)],
      }
    })
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16.7, 3)
      last = now
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      let alive = 0
      for (const m of motes) {
        if (m.life <= 0) continue
        alive++
        m.vx *= 0.985
        m.vy = m.vy * 0.985 + 0.05 * dt
        m.x += m.vx * dt
        m.y += m.vy * dt
        m.life -= 0.0075 * dt
        ctx.globalAlpha = Math.max(0, Math.min(1, m.life))
        ctx.fillStyle = m.c
        ctx.shadowColor = m.c
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
      }
      if (alive) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [origin.x, origin.y])
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[101] size-full" />
}

export function SoldCelebration() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [moment, setMoment] = useState<SoldMoment | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [origin, setOrigin] = useState({ x: 0, y: 0 })
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

  useEffect(
    () =>
      onSold((next) => {
        setMoment(next)
        if (!soundMuted()) window.setTimeout(() => playGavel(true), 250)
      }),
    [],
  )

  useEffect(() => {
    if (!moment) return
    const box = cardRef.current?.getBoundingClientRect()
    setOrigin({
      x: box ? box.left + box.width / 2 : innerWidth / 2,
      y: box ? box.top + box.height / 2 : innerHeight / 2,
    })
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMoment(null)
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [moment])

  if (!moment) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("common.sold.title")}
      className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in-0"
      onClick={(event) => event.target === event.currentTarget && setMoment(null)}
    >
      {!reduced && <Dust origin={origin} />}
      <div
        ref={cardRef}
        className="relative z-[102] w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#1b171d] p-6 text-center shadow-[0_40px_120px_rgba(0,0,0,.6)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500"
      >
        <button
          onClick={() => setMoment(null)}
          aria-label={t("common.close")}
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-text-secondary hover:bg-white/10 hover:text-text"
        >
          <X className="size-4" />
        </button>
        {moment.image && (
          <img
            src={moment.image}
            alt=""
            className="mx-auto mb-4 h-40 w-auto rounded-xl object-cover shadow-[0_20px_50px_rgba(0,0,0,.5)]"
          />
        )}
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-amber text-bg shadow-[0_0_40px_rgba(246,168,123,.55)]">
          <Gavel className="size-5" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[.3em] text-amber">
          {t("common.sold.eyebrow")}
        </p>
        <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-text">
          {t("common.sold.title")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {t("common.sold.text", { title: moment.title, amount: moment.amount })}
        </p>
        <div className="mt-5 grid gap-2">
          {moment.href && (
            <button
              onClick={() => {
                const href = moment.href!
                setMoment(null)
                navigate(href)
              }}
              className="h-11 rounded-full bg-amber text-sm font-semibold text-bg transition-colors hover:bg-amber-dark"
            >
              {t("common.sold.pay")}
            </button>
          )}
          <button
            onClick={() => setMoment(null)}
            className="h-10 rounded-full text-sm text-text-secondary hover:text-text"
          >
            {t("common.sold.later")}
          </button>
        </div>
      </div>
    </div>
  )
}
