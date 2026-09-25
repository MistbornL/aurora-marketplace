import { useMemo, useRef, useState, type CSSProperties } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Gavel,
  Palette,
  Search,
  Trophy,
} from "lucide-react"
import { EndingSoonPill, LivePill } from "../../components/artwork/badges"
import { CountUp } from "../../components/motion/CountUp"
import { Reveal } from "../../components/motion/Reveal"
import { Button } from "../../components/ui"
import { formatLeft, useCountdown } from "../../lib/clock"
import { useI18n, type MessageKey } from "../../lib/i18n"
import { useMagnetic, useSpotlight, useTilt } from "../../lib/motion"
import type { Artwork } from "../../types"
import { AuthDialog } from "../auth/AuthDialog"
import { useAuth } from "../auth/auth-context"
import { useCatalog } from "./catalog-context"
import { EventBanner } from "../events/EventBanner"
import { DiscoverSection } from "./DiscoverSection"

export default function LandingPage({
  onArtwork,
  onArtist,
  onLive,
  onDiscover,
  onEvent,
}: {
  onArtwork: (id: string) => void
  onArtist: (id: string) => void
  onLive: () => void
  onDiscover: () => void
  onEvent: (id: string) => void
}) {
  const { t, locale } = useI18n()
  const { artworks, artists } = useCatalog()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [joinAsArtist, setJoinAsArtist] = useState(false)

  // Real numbers from the catalogue — no made-up social proof.
  const stats = useMemo(() => {
    const live = artworks.filter((art) => art.isLive && art.timeLeftSecs > 0)
    return {
      live,
      artists: artists.length,
      bids: artworks.reduce((sum, art) => sum + art.bids, 0),
      lowestOpening: live.length ? Math.min(...live.map((art) => art.startingBid)) : null,
    }
  }, [artworks, artists])
  // Headline lot: the live auction closing soonest.
  const featured = [...stats.live].sort((a, b) => a.timeLeftSecs - b.timeLeftSecs)
  const [lead] = featured
  // Repeat short artist lists so the strip is always wider than the screen.
  const marqueeArtists = useMemo(() => {
    if (!artists.length) return []
    const out = [...artists]
    while (out.length < 8) out.push(...artists)
    return out
  }, [artists])

  const heroRef = useRef<HTMLElement>(null)
  const spotRef = useRef<HTMLDivElement>(null)
  const magnetRef = useRef<HTMLSpanElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  useSpotlight(heroRef, spotRef)
  useMagnetic(magnetRef)
  useTilt(tiltRef)

  function sell() {
    if (user) navigate("/dashboard")
    else setJoinAsArtist(true)
  }

  return (
    <div className="bg-bg">
      <div className="grain" aria-hidden />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative -mt-16 overflow-hidden pt-16">
        <div className="absolute inset-0" aria-hidden>
          <div className="aurora"><span /><span /><span /></div>
          <div ref={spotRef} className="spotlight" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.25fr_0.75fr] lg:px-10 lg:py-20">
          {/* Copy */}
          <div className="max-w-2xl">
            {stats.live.length > 0 && (
              <button
                onClick={onDiscover}
                style={{ "--i": 0 } as CSSProperties}
                className="hero-enter press mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[.05] py-1.5 pl-3 pr-3.5 text-[13px] text-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-md transition-colors hover:border-white/20 hover:text-text"
              >
                <span className="ping-dot size-[7px] rounded-full bg-red-500 text-red-500" />
                {t("catalog.hero.liveCount", { count: stats.live.length })}
                <ArrowRight className="size-3.5" />
              </button>
            )}

            <h1 className="hero-title font-display text-[clamp(42px,5vw,74px)] font-semibold leading-[1.02] tracking-[-0.03em] text-text">
              <span className="line-mask" style={{ "--i": 0 } as CSSProperties}>
                <span>{t("catalog.hero.titleLine1")}</span>
              </span>
              <span className="line-mask" style={{ "--i": 1 } as CSSProperties}>
                <span className="shimmer-text">{t("catalog.hero.titleLine2")}</span>
              </span>
            </h1>
            <p
              style={{ "--i": 3 } as CSSProperties}
              className="hero-enter mt-6 max-w-md text-[17px] leading-8 text-text-secondary"
            >
              {stats.lowestOpening
                ? t("catalog.hero.leadFrom", { amount: stats.lowestOpening })
                : t("catalog.hero.lead")}
            </p>

            <div style={{ "--i": 4 } as CSSProperties} className="hero-enter mt-8 flex flex-wrap items-center gap-3">
              <span ref={magnetRef} className="inline-block">
                <Button
                  onClick={onDiscover}
                  className="press h-12 gap-2 rounded-full px-7 text-[15px] font-semibold shadow-[0_10px_40px_-8px_rgba(232,184,75,0.55)] hover:bg-[#f3ca6b]"
                >
                  {t("catalog.hero.explore")}
                  <ArrowRight className="size-4" />
                </Button>
              </span>
              <Button
                variant="outline"
                onClick={sell}
                className="press h-12 gap-2 rounded-full border-white/15 bg-white/[.03] px-6 text-[15px] text-text backdrop-blur-sm hover:bg-white/[.08]"
              >
                <Palette className="size-4 text-amber" />
                {t("catalog.hero.sell")}
              </Button>
            </div>

            <ul
              style={{ "--i": 5 } as CSSProperties}
              className="hero-enter mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary"
            >
              {(["catalog.hero.pointFree", "catalog.hero.pointPublic", "catalog.hero.pointPrices"] as const).map(
                (point) => (
                  <li key={point} className="flex items-center gap-2">
                    <span className="grid size-4 place-items-center rounded-full bg-amber/15">
                      <Check className="size-3 text-amber" />
                    </span>
                    {t(point)}
                  </li>
                ),
              )}
            </ul>
          </div>

          {/* Featured lot: tilts toward the pointer (mouse only) */}
          {lead && (
            <div
              style={{ "--i": 3 } as CSSProperties}
              className="hero-enter relative mx-auto w-full max-w-[440px] lg:mx-0 lg:justify-self-end"
            >
              <div ref={tiltRef} className="will-change-transform [transform-style:preserve-3d]">
                <FeaturedLot art={lead} onOpen={() => onArtwork(lead.id)} onArtist={() => onArtist(lead.artistId)} />
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="px-4 pt-2 sm:px-6 lg:px-10">
        <EventBanner onOpen={onEvent} className="mx-auto max-w-7xl" />
      </div>

      {/* ── Artists strip ─────────────────────────────────────────────── */}
      {artists.length > 0 && (
        <section aria-label={t("catalog.marquee.label")} className="marquee mt-10 overflow-hidden border-y border-white/[.06] py-5 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0 items-center gap-14 pr-14">
                {marqueeArtists.map((artist, i) => (
                  <li key={`${artist.id}-${i}`}>
                    <button
                      tabIndex={copy === 1 ? -1 : undefined}
                      onClick={() => onArtist(artist.id)}
                      className="whitespace-nowrap font-display text-lg italic text-text-muted transition-colors hover:text-text"
                    >
                      {artist.name}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>
      )}

      {/* ── Stats (count up once in view) ─────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
        <Reveal className="mx-auto grid max-w-7xl grid-cols-3 gap-px overflow-hidden rounded-3xl border border-white/[.08] bg-white/[.08]">
          {([
            { value: stats.live.length, label: "catalog.hero.statLive" },
            { value: stats.artists, label: "catalog.hero.statArtists" },
            { value: stats.bids, label: "catalog.hero.statBids" },
          ] satisfies Array<{ value: number; label: MessageKey }>).map((item) => (
            <div key={item.label} className="bg-surface px-3 py-8 text-center sm:py-11">
              <CountUp
                value={item.value}
                format={(n) => n.toLocaleString(locale)}
                className="block font-display text-4xl font-bold text-amber tabular-nums sm:text-5xl"
              />
              <p className="mt-2 text-xs text-text-muted sm:text-[13px]">{t(item.label)}</p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section className="border-y border-white/[.06] bg-white/[.015]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-10">
          {[
            {
              icon: <Search />,
              title: t("catalog.how.discoverTitle"),
              text: t("catalog.how.discoverText"),
            },
            {
              icon: <Gavel />,
              title: t("catalog.how.bidTitle"),
              text: t("catalog.how.bidText"),
            },
            {
              icon: <Trophy />,
              title: t("catalog.how.winTitle"),
              text: t("catalog.how.winText"),
            },
          ].map((step, index) => (
            <Reveal key={step.title} delay={index * 80} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber/10 text-amber [&_svg]:size-5">
                {step.icon}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("catalog.how.step", { n: index + 1 })}
                </p>
                <p className="mt-1 font-display text-lg font-semibold text-text">{step.title}</p>
                <p className="mt-1.5 text-sm leading-6 text-text-secondary">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Catalogue ─────────────────────────────────────────────────── */}
      <section className="px-4 pb-16 pt-14 sm:px-6 lg:px-10">
        <Reveal className="mx-auto max-w-7xl">
          <DiscoverSection onArtwork={onArtwork} onArtist={onArtist} />
        </Reveal>
      </section>

      {/* ── Artist CTA ────────────────────────────────────────────────── */}
      <section className="px-4 pb-24 sm:px-6 lg:px-10">
        <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-amber/20 bg-gradient-to-br from-amber/[.14] via-surface to-surface p-8 sm:p-12">
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-amber/10 blur-3xl" aria-hidden />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-amber">
                <BadgeCheck className="size-4" /> {t("catalog.cta.eyebrow")}
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
                {t("catalog.cta.title")}
              </h2>
              <p className="mt-3 text-base leading-7 text-text-secondary">
                {t("catalog.cta.text")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={sell} className="h-12 rounded-full px-7 text-[15px] font-semibold hover:bg-[#f3ca6b]">
                {t("catalog.cta.start")}
              </Button>
              <Button
                variant="outline"
                onClick={onLive}
                className="h-12 rounded-full border-white/15 bg-transparent px-6 text-[15px] text-text hover:bg-white/[.06]"
              >
                {t("catalog.cta.watch")}
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      {joinAsArtist && (
        <AuthDialog
          initialMode="sign-up"
          initialRole="artist"
          onClose={() => setJoinAsArtist(false)}
        />
      )}
    </div>
  )
}

function FeaturedLot({
  art,
  onOpen,
  onArtist,
}: {
  art: Artwork
  onOpen: () => void
  onArtist: () => void
}) {
  const { t } = useI18n()
  const { secs } = useCountdown(art.timeLeftSecs)
  const liveFormat = art.format === "live"
  const endingSoon = !liveFormat && secs <= 5 * 60
  return (
    <article className="relative overflow-hidden rounded-[28px] border border-white/10 bg-surface shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]">
      <button onClick={onOpen} className="group relative block aspect-[4/5] w-full overflow-hidden" aria-label={t("catalog.featured.open", { title: art.title })}>
        <img
          src={art.image}
          alt={art.title}
          fetchPriority="high"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" />
        <div className="absolute left-4 top-4 flex gap-2">
          {liveFormat ? <LivePill /> : endingSoon ? <EndingSoonPill /> : null}
        </div>
        <span className="absolute right-4 top-4 rounded-full bg-black/55 px-3 py-1 text-[11px] font-medium text-text backdrop-blur">
          {t("catalog.featured.badge")}
        </span>
      </button>
      <div className="relative -mt-20 px-5 pb-5">
        <h3 className="font-display text-2xl font-bold text-text">{art.title}</h3>
        <button onClick={onArtist} className="mt-0.5 text-sm text-text-secondary hover:text-text">
          {t("catalog.featured.by", { artist: art.artist })}
        </button>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-white/[.08] bg-black/30 p-3.5 backdrop-blur">
          <div>
            <p className="text-[11px] text-text-muted">{t("catalog.featured.currentBid")}</p>
            <p className="font-display text-2xl font-bold text-amber">{art.currentBid}₾</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-text-muted">{t("catalog.featured.endsIn")}</p>
            <p className={`font-mono text-xl font-semibold ${endingSoon ? "text-red-400" : "text-text"}`}>
              {formatLeft(secs)}
            </p>
          </div>
        </div>
        <Button onClick={onOpen} className="mt-3 h-11 w-full gap-2 rounded-xl text-[15px] font-semibold hover:bg-[#f3ca6b]">
          <Gavel className="size-4" /> {t("catalog.featured.bidNow", { amount: art.minNextBid })}
        </Button>
        <p className="mt-2 text-center text-[11px] text-text-muted">
          {t("catalog.featured.bidsSoFar", { count: art.bids })}
        </p>
      </div>
    </article>
  )
}
