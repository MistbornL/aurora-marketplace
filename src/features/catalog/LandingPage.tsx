import { useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  BadgeCheck,
  Check,
  Gavel,
  Search,
  Trophy,
} from "lucide-react"
import { EndingSoonPill, LivePill } from "../../components/artwork/badges"
import { CountUp } from "../../components/motion/CountUp"
import { Reveal } from "../../components/motion/Reveal"
import { Button } from "../../components/ui"
import { formatLeft, useCountdown } from "../../lib/clock"
import { useI18n, type MessageKey } from "../../lib/i18n"
import { useTilt } from "../../lib/motion"
import type { Artwork } from "../../types"
import { AuthDialog } from "../auth/AuthDialog"
import { useAuth } from "../auth/auth-context"
import { useCatalog } from "./catalog-context"
import { EventBanner } from "../events/EventBanner"
import { DiscoverSection } from "./DiscoverSection"
import { ScrollHero } from "./hero/ScrollHero"

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

  // The lot chip in the film: the live lot with the highest bid right now.
  const topLot = useMemo(() => {
    const pool = stats.live.length ? stats.live : artworks
    return pool.filter((art) => art.image).sort((a, b) => b.currentBid - a.currentBid)[0] ?? null
  }, [stats.live, artworks])

  const tiltRef = useRef<HTMLDivElement>(null)
  useTilt(tiltRef)

  function sell() {
    if (user) navigate("/dashboard")
    else setJoinAsArtist(true)
  }

  return (
    <div className="bg-bg">
      <div className="grain" aria-hidden />

      {/* ── Hero: the cinematic scroll film ───────────────────────────── */}
      <ScrollHero
        liveCount={stats.live.length}
        lead={stats.lowestOpening ? t("catalog.hero.leadFrom", { amount: stats.lowestOpening }) : t("catalog.hero.lead")}
        topLot={topLot}
        onDiscover={onDiscover}
        onSell={sell}
        onLot={onArtwork}
      />

      {/* ── On the block now: the live lot closing soonest ────────────── */}
      {lead && (
        <section className="relative px-4 pt-6 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_440px] lg:gap-16">
            <Reveal className="max-w-xl">
              <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-amber">
                <span className="ping-dot size-[7px] rounded-full bg-red-500 text-red-500" />
                {t("catalog.stage.nextKicker")}
              </p>
              <h2 className="mt-3 font-display text-[clamp(32px,3.6vw,52px)] font-semibold leading-[1.05] tracking-[-0.03em] text-text">
                {t("catalog.stage.nextTitle")}
              </h2>
              <p className="mt-4 text-[17px] leading-8 text-text-secondary">{t("catalog.stage.nextText")}</p>
              <ul className="mt-7 grid gap-3 text-sm text-text-secondary">
                {(["catalog.hero.pointFree", "catalog.hero.pointPublic", "catalog.hero.pointPrices"] as const).map((point) => (
                  <li key={point} className="flex items-center gap-2.5">
                    <span className="grid size-5 place-items-center rounded-full bg-amber/15">
                      <Check className="size-3 text-amber" />
                    </span>
                    {t(point)}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={80} className="mx-auto w-full max-w-[440px] lg:mx-0 lg:justify-self-end">
              <div ref={tiltRef} className="will-change-transform [transform-style:preserve-3d]">
                <FeaturedLot art={lead} onOpen={() => onArtwork(lead.id)} onArtist={() => onArtist(lead.artistId)} />
              </div>
            </Reveal>
          </div>
        </section>
      )}

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
              <Button onClick={sell} className="h-12 rounded-full px-7 text-[15px] font-semibold hover:bg-amber-dark">
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
        <Button onClick={onOpen} className="mt-3 h-11 w-full gap-2 rounded-xl text-[15px] font-semibold hover:bg-amber-dark">
          <Gavel className="size-4" /> {t("catalog.featured.bidNow", { amount: art.minNextBid })}
        </Button>
        <p className="mt-2 text-center text-[11px] text-text-muted">
          {t("catalog.featured.bidsSoFar", { count: art.bids })}
        </p>
      </div>
    </article>
  )
}
