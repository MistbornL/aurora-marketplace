import { ArrowRight, Radio } from "lucide-react"
import { EndingSoonPill, LivePill, UpcomingPill } from "../../components/artwork/badges"
import { Button } from "../../components/ui"
import { formatLeft, useCountdown } from "../../lib/clock"
import { useI18n } from "../../lib/i18n"
import type { Artwork } from "../../types"
import { useLiveRooms } from "./api"
import { EventBanner } from "../events/EventBanner"

/**
 * /live — the lobby. Every live auction has its own room (own chat, own bids),
 * so several auctions running at once never mix.
 */
export default function LiveLobbyPage({
  onJoin,
  onDiscover,
  onEvent,
}: {
  onJoin: (id: string) => void
  onDiscover: () => void
  onEvent: (id: string) => void
}) {
  const { t } = useI18n()
  const all = useLiveRooms()
  const rooms = all.filter((art) => art.status !== "upcoming")
  const upcoming = all.filter((art) => art.status === "upcoming")

  return (
    <main className="min-h-screen bg-bg pb-24">
      <section className="border-b border-white/[.06] bg-gradient-to-b from-red-500/[.06] to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-10">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-red-400">
            <Radio className="size-4" /> {t("live.lobby.eyebrow")}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-text">
            {rooms.length
              ? t("live.lobby.liveNow", { count: rooms.length })
              : t("live.lobby.noneLive")}
          </h1>
          <p className="mt-3 max-w-2xl text-text-secondary">
            {t("live.lobby.intro")}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-10">
        <EventBanner onOpen={onEvent} className="mb-10" />
        {rooms.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((art, index) => (
              <RoomCard key={art.id} art={art} featured={index === 0} onJoin={() => onJoin(art.id)} />
            ))}
          </div>
        ) : upcoming.length ? null : (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-white/10 py-20 text-center">
            <p className="text-text-secondary">{t("live.lobby.empty")}</p>
            <Button onClick={onDiscover} className="h-11 rounded-full px-6">
              {t("live.lobby.browse")}
            </Button>
          </div>
        )}

        {upcoming.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-text">{t("live.lobby.startingSoon")}</h2>
            <p className="mt-1 text-sm text-text-muted">
              {t("live.lobby.startingSoonText")}
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((art) => (
                <RoomCard key={art.id} art={art} featured={false} onJoin={() => onJoin(art.id)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function RoomCard({
  art,
  featured,
  onJoin,
}: {
  art: Artwork
  featured: boolean
  onJoin: () => void
}) {
  const { t } = useI18n()
  const upcoming = art.status === "upcoming"
  const liveFormat = art.format === "live"
  const { secs } = useCountdown(upcoming ? art.startsInSecs : art.timeLeftSecs)
  const endingSoon = !upcoming && !liveFormat && secs <= 2 * 3600
  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-3xl border bg-surface transition-colors ${
        featured ? "border-amber/40" : "border-white/[.08] hover:border-white/20"
      }`}
    >
      <button onClick={onJoin} className="relative aspect-[4/3] overflow-hidden" aria-label={t("live.card.join", { title: art.title })}>
        <img
          src={art.image}
          alt={art.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
        <div className="absolute left-3 top-3">
          {upcoming ? (
            <UpcomingPill small label={t("live.card.upcoming")} />
          ) : endingSoon ? (
            <EndingSoonPill small />
          ) : (
            <LivePill small />
          )}
        </div>
        {featured && (
          <span className="absolute right-3 top-3 rounded-full bg-amber px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-bg">
            {t("live.card.closingFirst")}
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="font-display text-lg font-semibold text-text">{art.title}</h2>
        <p className="text-sm text-text-muted">{t("live.card.by", { artist: art.artist })}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-black/20 p-3">
          <div>
            <p className="text-[11px] text-text-muted">{art.bids > 0 ? t("live.card.currentBid") : t("live.card.openingBid")}</p>
            <p className="font-display text-xl font-bold text-amber">{art.currentBid}₾</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-text-muted">{upcoming ? t("live.card.startsIn") : liveFormat ? t("live.card.format") : t("live.card.endsIn")}</p>
            <p className={`font-mono text-lg font-semibold ${endingSoon ? "text-red-400" : "text-text"}`}>
              {upcoming || !liveFormat ? formatLeft(secs) : t("live.card.timer")}
            </p>
          </div>
        </div>
        <Button onClick={onJoin} className="mt-4 h-11 gap-2 rounded-xl font-semibold">
          {upcoming ? t("live.card.waitingRoom") : t("live.card.joinRoom")} <ArrowRight className="size-4" />
        </Button>
        <p className="mt-2 text-center text-[11px] text-text-muted">{t("live.card.bidsSoFar", { count: art.bids })}</p>
      </div>
    </article>
  )
}
