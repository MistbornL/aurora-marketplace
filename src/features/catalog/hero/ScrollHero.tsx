// The cinematic landing hero: one continuous film (curtain → the room → the
// gavel → into the painting → dawn) scrubbed by scroll. Scrolling down plays
// it forward, scrolling up plays it back.
//
// Engineering (proven pattern, keep all of it):
// - The video is fetched whole as a Blob, so seeking works on any host.
// - The displayed time eases toward the scroll target in a rAF loop that
//   rests when converged or off-screen, and seeks are gated (one in flight).
// - Captions are "bands" of scroll progress; each writes --k (0..1 assembly)
//   and opacity, delta-gated so converged bands cost nothing.
// - Phones, portrait tablets, landscape phones and reduced motion get a
//   composed still instead (same five queries in CSS and JS, decided live).
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { ArrowRight, Palette, Volume2, VolumeX } from "lucide-react"
import { isSoundOn, playChime, playGavel, setRoomLevel, setSound } from "./hero-sound"
import { useI18n } from "../../../lib/i18n"
import { setOverHero } from "../../../lib/hero-state"
import type { Artwork } from "../../../types"
import "./scroll-hero.css"

const ASSETS = "/hero"
// The film in three weights. A light copy plays almost at once on the first
// visit; the HD copy follows in the background and swaps in at the same frame.
// File names carry a version so they can be cached forever (vercel.json).
// bytes = real sizes, used for the ring when Content-Length is missing.
const FILMS = {
  light: { url: `${ASSETS}/film-v3-960.mp4`, bytes: 4556579 },
  hd: { url: `${ASSETS}/film-v3-1600.mp4`, bytes: 18673666 },
  av1: { url: `${ASSETS}/film-v3-1920-av1.mp4`, bytes: 12019273 },
}
type Film = (typeof FILMS)[keyof typeof FILMS]
const AV1_TYPE = 'video/mp4; codecs="av01.0.08M.08"'
const HD_CACHED_KEY = "tsiskari.heroFilm"
/** The film is encoded at 24fps with every frame a keyframe, so any frame seeks instantly. */
const FPS = 24
const STILLS = [`${ASSETS}/still-curtain.jpg`, `${ASSETS}/still-hall.jpg`, `${ASSETS}/still-gavel.jpg`, `${ASSETS}/still-dawn.jpg`]

/** Must match the @media list in scroll-hero.css character for character. */
const GATES = [
  "(max-width: 720px)",
  "(orientation: portrait) and (max-width: 1024px)",
  "(orientation: portrait) and (pointer: coarse)",
  "(orientation: landscape) and (pointer: coarse) and (max-height: 560px)",
  "(prefers-reduced-motion: reduce)",
]

// The film is 22.96s: curtain 0–6.04s, aisle 6.04–12.08s, gavel 12.08–16.93s,
// dive into the painting 16.93–22.96s. Everything below is in progress units
// (seconds ÷ 22.96), so re-timing the film only means editing these numbers.
/** Where each shot starts. */
const SHOTS = [0, 0.263, 0.526, 0.737]
/** The frame where the gavel meets the block (16.45s). */
const STRIKE = 0.716
/** The dive starts pulling hard here; the gavel beat and the lot chip leave by then. */
const DIVE = 0.8
// Igloo-style: the film follows the scroll continuously. The page scroll is
// already inertial (lib/smooth-scroll), so one light ease here just turns it
// into whole-frame seeks without ever lagging behind the glide.
const FOLLOW = 0.22

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const smoothstep = (p: number, e0: number, e1: number) => {
  const t = clamp((p - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Splits a line into word spans with a reading-order threshold (--th). */
function Words({ text, spread = 0.5, className }: { text: string; spread?: number; className?: string }) {
  const words = text.split(" ")
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden className={className}>
        {words.map((word, i) => (
          <span key={i} className="sh-w" style={{ "--th": ((i / Math.max(1, words.length)) * spread).toFixed(3) } as CSSProperties}>
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </>
  )
}

// Phones get the dawn as a gentle 4 s loop (about 200 KB) instead of a still. It
// is only fetched when the phone layout is active and motion is allowed.
const LOOP_QUERY =
  "(prefers-reduced-motion: no-preference) and ((max-width: 720px) or ((orientation: portrait) and (max-width: 1024px)) or ((orientation: portrait) and (pointer: coarse)))"

function PhoneLoop() {
  const [src, setSrc] = useState<string | undefined>()
  useEffect(() => {
    const mq = window.matchMedia(LOOP_QUERY)
    const sync = () => setSrc(mq.matches ? `${ASSETS}/still-dawn-loop.mp4` : undefined)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  if (!src) return null
  return (
    <video
      className="sh-loop"
      src={src}
      poster={`${ASSETS}/still-dawn-tall.webp`}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden
      tabIndex={-1}
    />
  )
}

export function ScrollHero({
  liveCount,
  lead,
  topLot,
  onDiscover,
  onSell,
  onLot,
}: {
  liveCount: number
  lead: string
  topLot: Artwork | null
  onDiscover: () => void
  onSell: () => void
  onLot: (id: string) => void
}) {
  const { t, locale } = useI18n()
  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const cueRef = useRef<HTMLDivElement>(null)
  const lotRef = useRef<HTMLButtonElement>(null)
  const bidRef = useRef<HTMLElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const [soundOn, setSoundOn] = useState(isSoundOn)

  // The lot chip's numbers live in a ref so the scroll loop can read the
  // latest values without re-running the effect.
  const lotNumbers = useRef({ from: 0, to: 0, locale })
  lotNumbers.current = {
    from: topLot ? Math.min(topLot.startingBid, topLot.currentBid) : 0,
    to: topLot?.currentBid ?? 0,
    locale,
  }

  useEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    let video = videoRef.current
    if (!root || !stage || !video) return
    let unmounted = false
    let scrubOn = false

    const bands = [...root.querySelectorAll<HTMLElement>("[data-band]")].map((el) => ({
      el,
      a: Number(el.dataset.a),
      b: Number(el.dataset.b),
      first: el.dataset.first === "1",
      last: el.dataset.last === "1",
      ramp: el.dataset.ramp ? Number(el.dataset.ramp) : 0,
      exit: el.dataset.exit === "1",
      op: -1,
      k: -1,
      on: false,
    }))

    // ── progress through the pinned hero ──────────────────────────
    const rawProgress = () => {
      const r = root.getBoundingClientRect()
      const range = r.height - window.innerHeight
      return range > 0 ? clamp(-r.top / range, 0, 1) : 0
    }
    // ── gated seeks: never write currentTime while a seek is in flight ──
    let seekBusy = false
    let pendingTime: number | null = null
    const requestSeek = (time: number) => {
      if (!video.duration || !Number.isFinite(video.duration)) return
      const target = clamp(time, 0, video.duration - 0.04)
      if (seekBusy || swapping) {
        pendingTime = target
        return
      }
      seekBusy = true
      video.currentTime = target
    }
    const onSeeked = () => {
      seekBusy = false
      if (pendingTime !== null) {
        const next = pendingTime
        pendingTime = null
        requestSeek(next)
      }
    }
    const onVideoError = () => {
      seekBusy = false
      pendingTime = null
      failVideo()
    }
    video.addEventListener("seeked", onSeeked)
    video.addEventListener("error", onVideoError)

    // ── captions, stills and the lot chip, all delta-gated ─────────
    let loadK = 0 // band one's one-time entrance on load
    let lastStill = -1
    let lastLotK = -1
    let lastLotOn = false
    let lastStruck = false
    let lastBidText = ""
    let lastBidAt = 0
    let cueHidden = false
    let lastFlash = ""
    let lastRoom = -1
    let lastP = 0

    const updateCaptions = (p: number, now: number) => {
      // Room tone: present in the hall, fading as the film dives into the dawn.
      const room = heroOnScreen ? Math.round((1 - smoothstep(p, DIVE - 0.04, 0.96)) * 20) / 20 : 0
      if (room !== lastRoom) {
        lastRoom = room
        setRoomLevel(room)
      }
      for (const band of bands) {
        const { a, b } = band
        const f = Math.min(0.02, (b - a) / 3)
        const fadeIn = band.first ? 1 : smoothstep(p, a, a + f)
        const fadeOut = band.last ? 1 : 1 - smoothstep(p, b - f, b)
        const op = Math.round(fadeIn * fadeOut * 1000) / 1000
        let k: number
        if (band.exit) {
          // The curtain line doesn't assemble, it parts: --o is progress through the band.
          k = Math.round(clamp((p - a) / (b - a), 0, 1) * 1000) / 1000
        } else {
          const ramp = band.ramp || Math.min(0.025, (b - a) * 0.35)
          k = clamp((p - a) / ramp, 0, 1)
          if (band.first) k = Math.max(k, loadK)
          k = Math.round(k * 125) / 125 // 0.008 steps
        }
        if (op !== band.op) {
          band.op = op
          band.el.style.opacity = String(op)
          const on = op > 0.5
          if (on !== band.on) {
            band.on = on
            band.el.classList.toggle("is-on", on)
          }
        }
        if (k !== band.k) {
          band.k = k
          band.el.style.setProperty(band.exit ? "--o" : "--k", String(k))
        }
      }

      // The gavel lands: a warm flash in the spotlight and a spray of gold dust.
      const flash = flashRef.current
      if (flash) {
        const f = clamp((p - STRIKE) / 0.032, 0, 1)
        const glow = p >= STRIKE - 0.001 && f < 1 ? (1 - f) * (1 - f) : 0
        const key = `${Math.round(f * 200)}:${Math.round(glow * 200)}`
        if (key !== lastFlash) {
          lastFlash = key
          flash.style.setProperty("--f", f.toFixed(3))
          flash.style.setProperty("--g", glow.toFixed(3))
        }
      }

      // Still frames stand in for the film until it's ready (or if it never arrives).
      const still = p < SHOTS[1] ? 0 : p < SHOTS[2] ? 1 : p < SHOTS[3] ? 2 : 3
      if (still !== lastStill) {
        lastStill = still
        stage.dataset.still = String(still)
      }

      if (!cueHidden && p > 0.015) {
        cueHidden = true
        cueRef.current?.classList.add("is-hidden")
      } else if (cueHidden && p <= 0.015) {
        cueHidden = false
        cueRef.current?.classList.remove("is-hidden")
      }

      // The lot chip walks in with us, its bid climbing toward the real current bid.
      const lot = lotRef.current
      if (lot) {
        const lotOp = smoothstep(p, SHOTS[1] + 0.01, SHOTS[1] + 0.03) * (1 - smoothstep(p, DIVE - 0.02, DIVE))
        const lotK = Math.round(lotOp * 125) / 125
        if (lotK !== lastLotK) {
          lastLotK = lotK
          lot.style.opacity = String(lotK)
          lot.style.setProperty("--k", String(lotK))
          const on = lotK > 0.5
          if (on !== lastLotOn) {
            if (on && p > lastP) playChime()
            lastLotOn = on
            lot.classList.toggle("is-on", on)
            lot.tabIndex = on ? 0 : -1
          }
        }
        const struck = p >= STRIKE
        if (struck !== lastStruck) {
          if (struck && p > lastP) playGavel()
          lastStruck = struck
          lot.classList.toggle("is-struck", struck)
        }
        const { from, to, locale: loc } = lotNumbers.current
        const climb = smoothstep(p, SHOTS[1] + 0.03, STRIKE)
        const text = `${Math.round(from + (to - from) * climb).toLocaleString(loc)}₾`
        if (text !== lastBidText && (now - lastBidAt > 90 || struck || climb === 0)) {
          lastBidText = text
          lastBidAt = now
          if (bidRef.current) bidRef.current.textContent = text
        }
      }
    }

    // ── the follow loop (rests when the film has caught up with the scroll) ──
    let target = 0
    let shown = 0
    let lastFrame = -1
    let rafId: number | null = null
    let lastTick = 0
    let heroOnScreen = true

    const tick = (now: number) => {
      const dt = Math.min(100, now - (lastTick || now))
      lastTick = now
      if (loadK < 1) loadK = Math.min(1, loadK + dt / 1100)
      shown += (target - shown) * (1 - Math.pow(1 - FOLLOW, dt / 16.667))
      const settled = Math.abs(target - shown) < 0.0002
      if (settled) shown = target
      if (videoReady) {
        const frame = Math.round(shown * video.duration * FPS)
        if (frame !== lastFrame) {
          lastFrame = frame
          requestSeek(frame / FPS)
        }
      }
      updateCaptions(shown, now)
      lastP = shown
      if (settled && loadK >= 1) {
        rafId = null
        lastTick = 0
      } else {
        rafId = requestAnimationFrame(tick)
      }
    }
    const kick = () => {
      if (scrubOn && rafId === null && heroOnScreen) rafId = requestAnimationFrame(tick)
    }
    const onScroll = () => {
      target = rawProgress()
      const r = root.getBoundingClientRect()
      setOverHero(r.top <= 1 && r.bottom > window.innerHeight * 0.5)
      kick()
    }

    const io = new IntersectionObserver(([entry]) => {
      heroOnScreen = entry.isIntersecting
      if (!heroOnScreen) {
        lastRoom = 0
        setRoomLevel(0)
      }
      if (heroOnScreen) kick()
    })
    io.observe(root)

    // ── the film: poster first, then stream the blob behind a ring ──
    let videoReady = false
    let initStarted = false
    let blobUrl: string | null = null
    const abort = new AbortController()

    const failVideo = () => {
      root.classList.add("video-failed")
      root.classList.remove("video-ready")
      setRing(1)
    }
    const setRing = (frac: number) => {
      ringRef.current?.style.setProperty("stroke-dashoffset", String(Math.round(126 * (1 - frac))))
      if (frac >= 1) root.classList.add("ring-done")
    }

    // Best HD copy for this machine: AV1 at 1920 (sharper, and 12 MB instead
    // of 19) only where the GPU decodes AV1 (powerEfficient = hardware), since
    // scrubbing is many quick seeks; everyone else gets the H.264 1600 copy.
    const pickHD = async (): Promise<Film> => {
      try {
        if (video.canPlayType(AV1_TYPE) !== "probably" || !navigator.mediaCapabilities) return FILMS.hd
        const info = await navigator.mediaCapabilities.decodingInfo({
          type: "file",
          video: { contentType: AV1_TYPE, width: 1920, height: 1080, bitrate: 6_000_000, framerate: 24 },
        })
        return info.supported && info.smooth && info.powerEfficient ? FILMS.av1 : FILMS.hd
      } catch {
        return FILMS.hd
      }
    }
    const remembered = () => {
      try {
        return localStorage.getItem(HD_CACHED_KEY)
      } catch {
        return null
      }
    }

    const download = async (film: Film, onProgress?: (frac: number) => void) => {
      let watchdog = window.setTimeout(() => abort.abort(), 20000)
      const res = await fetch(film.url, { priority: onProgress ? "high" : "low", signal: abort.signal } as RequestInit)
      if (!res.ok || !res.body) throw new Error(`hero video ${res.status}`)
      const total = Number(res.headers.get("Content-Length")) || film.bytes
      const reader = res.body.getReader()
      const chunks: BlobPart[] = []
      let got = 0
      let lastRing = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        window.clearTimeout(watchdog)
        watchdog = window.setTimeout(() => abort.abort(), 20000)
        chunks.push(value)
        got += value.length
        const now = performance.now()
        if (onProgress && total && now - lastRing > 100) {
          lastRing = now
          onProgress(Math.min(0.98, got / total))
        }
      }
      window.clearTimeout(watchdog)
      // A real film is megabytes; a tiny body is an error page or a Git LFS
      // pointer that was deployed instead of the video.
      if (got < 500_000) throw new Error("hero video is not a video")
      return URL.createObjectURL(new Blob(chunks, { type: "video/mp4" }))
    }

    const once = (el: HTMLElement, type: string) =>
      new Promise<void>((resolve, reject) => {
        el.addEventListener(type, () => resolve(), { once: true })
        el.addEventListener("error", () => reject(new Error(`video ${type} failed`)), { once: true })
      })

    // HD arrives: freeze the current frame on a canvas, swap the source, seek
    // the new copy to the same frame, then lift the canvas. No visible jump.
    let swapping = false
    const swapTo = async (url: string) => {
      const cover = document.createElement("canvas")
      cover.className = "sh-video sh-swap"
      cover.width = video.videoWidth
      cover.height = video.videoHeight
      cover.getContext("2d")?.drawImage(video, 0, 0)
      video.after(cover)
      swapping = true
      seekBusy = false
      const old = blobUrl
      let ok = false
      try {
        video.src = url
        video.load()
        await once(video, "loadeddata")
        const at = lastFrame >= 0 ? lastFrame / FPS : shown * video.duration
        video.currentTime = clamp(at, 0, video.duration - 0.04)
        await once(video, "seeked")
        ok = true
      } catch {
        // HD didn't take: go back to the light copy that was already working.
        if (old) {
          video.src = old
          video.load()
          await once(video, "loadeddata").catch(() => {})
        }
      } finally {
        swapping = false
        if (ok) {
          blobUrl = url
          if (old) URL.revokeObjectURL(old)
        } else URL.revokeObjectURL(url)
        cover.remove()
        lastFrame = -1
        kick()
      }
      return ok
    }

    const loadHeroBlob = async () => {
      const hd = await pickHD()
      let saveData = false
      try {
        const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection
        saveData = !!c && (c.saveData === true || /(^|-)2g|3g/.test(c.effectiveType ?? ""))
      } catch {
        /* no Network Information API */
      }
      // Seen this HD copy before? It is in the browser cache, so go straight to it.
      const first = remembered() === hd.url ? hd : FILMS.light
      const url = await download(first, setRing)
      setRing(1)
      blobUrl = url
      video.src = url
      video.load()
      video.addEventListener(
        "canplay",
        () => {
          videoReady = true
          root.classList.add("video-ready")
          lastFrame = -1
          requestSeek(Math.round(shown * video.duration * FPS) / FPS)
          kick()
        },
        { once: true },
      )
      if (first === hd || saveData) return
      // Let the light copy settle, then fetch HD quietly. Any failure here
      // just leaves the light copy playing.
      try {
        await new Promise((r) => window.setTimeout(r, 1200))
        const hdUrl = await download(hd)
        if (unmounted) {
          URL.revokeObjectURL(hdUrl)
          return
        }
        if (!videoReady) await once(video, "canplay")
        if (await swapTo(hdUrl)) localStorage.setItem(HD_CACHED_KEY, hd.url)
      } catch {
        /* keep the light copy */
      }
    }

    const initHeroOnce = () => {
      if (initStarted) return
      initStarted = true
      stage.querySelectorAll<HTMLElement>("[data-still-src]").forEach((el) => {
        el.style.backgroundImage = `url('${el.dataset.stillSrc}')`
      })
      // The first still wins the bandwidth race; the film follows.
      let started = false
      const startBlob = () => {
        if (started) return
        started = true
        loadHeroBlob().catch(() => {
          if (!unmounted) failVideo()
        })
      }
      const first = new Image()
      first.onload = startBlob
      first.onerror = startBlob
      first.src = STILLS[0]
      window.setTimeout(startBlob, 4000)
    }

    // ── scrub on/off, decided live from the five gates ────────────
    const enableScrub = () => {
      if (scrubOn) return
      scrubOn = true
      initHeroOnce()
      window.addEventListener("scroll", onScroll, { passive: true })
      window.addEventListener("resize", onScroll)
      bands.forEach((band) => {
        band.op = -1
        band.k = -1
      })
      lastLotK = -1
      // Start where the visitor already is (e.g. after a reload mid-hero), no sweep.
      target = shown = rawProgress()
      lastFrame = -1
      onScroll()
    }
    const disableScrub = () => {
      if (!scrubOn) return
      scrubOn = false
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = null
      setOverHero(false)
      // Hand the caption styles back to CSS (the static layout).
      bands.forEach((band) => {
        band.el.style.removeProperty("opacity")
        band.el.style.removeProperty("--k")
        band.el.style.removeProperty("--o")
        band.el.classList.remove("is-on")
      })
      const lot = lotRef.current
      if (lot) {
        lot.style.removeProperty("opacity")
        lot.style.removeProperty("--k")
        lot.tabIndex = 0
      }
      if (bidRef.current) bidRef.current.textContent = `${lotNumbers.current.to.toLocaleString(lotNumbers.current.locale)}₾`
    }
    const queries = GATES.map((q) => window.matchMedia(q))
    const applyMode = () => (queries.some((q) => q.matches) ? disableScrub() : enableScrub())
    queries.forEach((q) => q.addEventListener("change", applyMode))
    applyMode()

    return () => {
      unmounted = true
      setRoomLevel(0)
      queries.forEach((q) => q.removeEventListener("change", applyMode))
      disableScrub()
      io.disconnect()
      abort.abort()
      video.removeEventListener("seeked", onSeeked)
      video.removeEventListener("error", onVideoError)
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      setOverHero(false)
    }
  }, [])

  return (
    <section ref={rootRef} className="sh" aria-label={t("catalog.stage.eyebrow")}>
      <div ref={stageRef} className="sh-stage" data-still="0">
        <div
          className="sh-static"
          style={{ "--still-wide": `url('${STILLS[3]}')`, "--still-tall": `url('${ASSETS}/still-dawn-tall.webp')` } as CSSProperties}
          aria-hidden
        />
        <PhoneLoop />
        {STILLS.map((src, i) => (
          <div key={src} className={`sh-still sh-still-${i}`} data-still-src={src} aria-hidden />
        ))}
        <video ref={videoRef} className="sh-video" muted playsInline preload="none" aria-hidden tabIndex={-1} />
        <div ref={flashRef} className="sh-flash" aria-hidden />
        <div className="sh-scrim" aria-hidden />

        {/* 1 · The curtain */}
        <div className="sh-band sh-b1" data-band data-a="0" data-b={SHOTS[1] - 0.09} data-first="1" data-exit="1">
          <p className="sh-eyebrow">{t("catalog.stage.eyebrow")}</p>
          <p className="sh-line">
            <span className="sh-half-l">{t("catalog.stage.curtainLeft")}</span>
            <span className="sh-half-r">
              <em>{t("catalog.stage.curtainRight")}</em>
            </span>
          </p>
        </div>

        {/* 2 · The room */}
        <div className="sh-band sh-b2" data-band data-a={SHOTS[1] + 0.02} data-b={SHOTS[2] - 0.01} data-ramp="0.06">
          <p className="sh-kicker">
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
            {t("catalog.stage.aisleKicker")}
          </p>
          <h2>
            {t("catalog.stage.aisleTitle")
              .split(/(?<=\.)\s+/)
              .map((sentence, i) => (
                <span key={i} className="block">
                  <Words text={sentence} spread={0.3} />
                </span>
              ))}
          </h2>
          <p>{t("catalog.stage.aisleText")}</p>
        </div>

        {/* 3 · Going once, going twice */}
        <div className="sh-band sh-b3" data-band data-a={SHOTS[2] + 0.005} data-b={STRIKE + 0.006} data-ramp="0.06">
          <Words text={t("catalog.stage.going")} spread={0.35} />
        </div>

        {/* 4 · The gavel lands */}
        <div className="sh-band sh-b4" data-band data-a={STRIKE - 0.003} data-b={DIVE + 0.035} data-ramp="0.04">
          <Words text={t("catalog.stage.sold")} />
        </div>

        {/* 5 · Dawn: the page settles here */}
        <div className="sh-band sh-b5" data-band data-a="0.9" data-b="1" data-last="1" data-ramp="0.07">
          <p className="sh-eyebrow">{t("catalog.stage.dawn")}</p>
          <h1>
            <Words text={t("catalog.hero.titleLine1")} spread={0.4} />{" "}
            <Words text={t("catalog.hero.titleLine2")} spread={0.4} className="sh-amber" />
          </h1>
          <p className="sh-lede">{lead}</p>
          <div className="sh-actions">
            <button type="button" className="sh-btn sh-btn-primary" onClick={onDiscover}>
              {t("catalog.hero.explore")}
              <ArrowRight className="size-4" />
            </button>
            <button type="button" className="sh-btn sh-btn-ghost" onClick={onSell}>
              <Palette className="size-4 text-amber" />
              {t("catalog.hero.sell")}
            </button>
            {liveCount > 0 && (
              <button type="button" className="sh-pill" onClick={onDiscover}>
                <span className="ping-dot size-[7px] rounded-full bg-red-500 text-red-500" />
                {t("catalog.hero.liveCount", { count: liveCount })}
              </button>
            )}
          </div>
        </div>

        {/* The real top lot, its bid climbing as we walk the aisle */}
        {topLot && (
          <button
            ref={lotRef}
            type="button"
            className="sh-lot"
            onClick={() => onLot(topLot.id)}
            aria-label={t("catalog.stage.lotOpen", { title: topLot.title })}
          >
            <img src={topLot.image} alt="" loading="lazy" />
            <span className="min-w-0">
              <span className="sh-lot-label block">{t("catalog.stage.lotLabel")}</span>
              <span className="sh-lot-title block">{topLot.title}</span>
              <span className="sh-lot-bid">
                {t("catalog.stage.lotBid")}
                <strong ref={bidRef}>{topLot.currentBid.toLocaleString(locale)}₾</strong>
              </span>
            </span>
          </button>
        )}

        <button
          type="button"
          className="sh-sound"
          aria-pressed={soundOn}
          aria-label={soundOn ? t("catalog.stage.soundOff") : t("catalog.stage.soundOn")}
          title={soundOn ? t("catalog.stage.soundOff") : t("catalog.stage.soundOn")}
          onClick={() => {
            const next = !soundOn
            setSoundOn(next)
            void setSound(next).then(() => window.dispatchEvent(new Event("scroll")))
          }}
        >
          {soundOn ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
          <span>{soundOn ? t("catalog.stage.soundOnLabel") : t("catalog.stage.soundOffLabel")}</span>
        </button>

        <div ref={cueRef} className="sh-cue" aria-hidden>
          <svg className="sh-ring" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="2.5" />
            <circle ref={ringRef} cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="126" strokeDashoffset="126" />
          </svg>
          <span className="sh-chevron" />
          <span className="sh-cue-text">{t("catalog.stage.scroll")}</span>
        </div>
      </div>
    </section>
  )
}
