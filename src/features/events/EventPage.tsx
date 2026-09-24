import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarPlus, ChevronLeft, Radio, Share2 } from "lucide-react"
import { Button } from "../../components/ui"
import { RowsSkeleton } from "../../components/layout/PageSkeletons"
import { formatLeft, useCountdown } from "../../lib/clock"
import { useI18n } from "../../lib/i18n"
import { notify } from "../../lib/notify"
import type { Artwork } from "../../types"
import { useCatalog } from "../catalog/catalog-context"
import { downloadIcs, getEvent, type AuctionEvent } from "./api"

/** /events/:id — one curated live-auction evening and its lots in order. */
export default function EventPage({
  eventId,
  onBack,
  onRoom,
  onArtwork,
}: {
  eventId: string
  onBack: () => void
  onRoom: (id: string) => void
  onArtwork: (id: string) => void
}) {
  const { t, formatDate } = useI18n()
  const { artworks, refresh } = useCatalog()
  const [event, setEvent] = useState<AuctionEvent | null | undefined>()

  useEffect(() => {
    void getEvent(eventId).then(setEvent, () => setEvent(null))
    // Lots change state during the evening: keep the list current.
    void refresh({ silent: true })
    const id = setInterval(() => void refresh({ silent: true }), 15_000)
    return () => clearInterval(id)
  }, [eventId, refresh])

  const lots = useMemo(
    () =>
      artworks
        .filter((art) => art.eventId === eventId)
        .sort((a, b) => (a.lotNumber ?? 0) - (b.lotNumber ?? 0)),
    [artworks, eventId],
  )

  if (event === undefined)
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 pt-10">
        <RowsSkeleton rows={3} />
      </main>
    )
  if (!event)
    return (
      <main className="grid min-h-[60vh] place-items-center px-4 text-center text-sm text-text-secondary">
        <div>
          <p>{t("events.notFound")}</p>
          <Button variant="outline" className="mt-4" onClick={onBack}>
            {t("common.back")}
          </Button>
        </div>
      </main>
    )

  const url = window.location.href
  return (
    <main className="min-h-screen bg-bg pb-24">
      <section className="border-b border-white/[.06] bg-gradient-to-b from-red-500/[.07] via-amber/[.03] to-transparent">
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6">
          <button
            onClick={onBack}
            className="mb-8 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text"
          >
            <ChevronLeft className="size-4" /> {t("common.back")}
          </button>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-red-400">
            <Radio className="size-4" /> {t("events.eyebrow")}
            {!event.published && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-text-secondary">
                {t("events.draft")}
              </span>
            )}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">{event.title}</h1>
          <p className="mt-3 text-lg text-amber">
            {formatDate(event.startsAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </p>
          {event.description && (
            <p className="mt-4 max-w-2xl whitespace-pre-line leading-7 text-text-secondary">{event.description}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <StartCountdown startsAt={event.startsAt} />
            <Button variant="outline" className="h-10 rounded-full" onClick={() => downloadIcs(event, url)}>
              <CalendarPlus className="size-4" /> {t("events.addToCalendar")}
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-full"
              onClick={async () => {
                try {
                  if (navigator.share) await navigator.share({ title: event.title, url })
                  else {
                    await navigator.clipboard.writeText(url)
                    notify(t("events.linkCopied"), t("events.linkCopiedText"))
                  }
                } catch {
                  /* dismissed */
                }
              }}
            >
              <Share2 className="size-4" /> {t("events.share")}
            </Button>
          </div>
          <p className="mt-6 max-w-2xl text-sm text-text-muted">
            {t("events.howItWorks", { gap: event.lotGapMinutes })}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        <h2 className="font-display text-2xl font-semibold text-text">
          {t("events.lots", { count: lots.length })}
        </h2>
        {lots.length ? (
          <ol className="mt-5 flex flex-col gap-3">
            {lots.map((art) => (
              <LotRow key={art.id} art={art} onRoom={() => onRoom(art.id)} onArtwork={() => onArtwork(art.id)} />
            ))}
          </ol>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-text-muted">
            {t("events.noLots")}
          </p>
        )}
      </div>
    </main>
  )
}

function StartCountdown({ startsAt }: { startsAt: string }) {
  const { t } = useI18n()
  const secs = Math.max(0, Math.round((new Date(startsAt).getTime() - Date.now()) / 1000))
  const left = useCountdown(secs)
  if (left.secs <= 0)
    return (
      <span className="inline-flex h-10 items-center gap-2 rounded-full bg-red-500 px-4 text-sm font-semibold text-white">
        <span className="size-2 animate-pulse rounded-full bg-white" /> {t("events.liveNow")}
      </span>
    )
  return (
    <span className="inline-flex h-10 items-center gap-2 rounded-full bg-white/[.06] px-4 text-sm text-text">
      {t("events.startsIn")} <span className="font-mono font-semibold text-amber">{formatLeft(left.secs)}</span>
    </span>
  )
}

function LotRow({ art, onRoom, onArtwork }: { art: Artwork; onRoom: () => void; onArtwork: () => void }) {
  const { t, formatDate } = useI18n()
  const ended = art.status === "ended" || art.status === "awaiting_seller"
  const statusLabel =
    art.status === "live"
      ? t("events.status.live")
      : art.status === "upcoming"
        ? art.startsAt
          ? formatDate(art.startsAt, { hour: "2-digit", minute: "2-digit" })
          : t("events.status.upcoming")
        : art.status === "awaiting_seller"
          ? t("events.status.onApproval")
          : art.bids > 0 && !["rejected", "expired", "counter_declined"].includes(art.sellerDecision ?? "")
            ? t("events.status.sold", { amount: art.currentBid })
            : t("events.status.unsold")
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/[.08] bg-surface p-3 sm:p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[.05] font-display text-lg font-bold text-amber">
        {art.lotNumber}
      </span>
      <button onClick={onArtwork} className="flex min-w-0 flex-1 items-center gap-4 text-left">
        <img src={art.image} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl object-cover" />
        <span className="min-w-0">
          <span className="block truncate font-display font-semibold text-text">{art.title}</span>
          <span className="block truncate text-xs text-text-muted">
            {art.artist} · {t("events.opening", { amount: art.startingBid })}
            {art.buyNowPrice != null && art.bids === 0 ? ` · ${t("events.buyNow", { amount: art.buyNowPrice })}` : ""}
          </span>
        </span>
      </button>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          art.status === "live" ? "bg-red-500 text-white" : ended ? "bg-white/[.06] text-text-secondary" : "bg-sky-500/15 text-sky-200"
        }`}
      >
        {statusLabel}
      </span>
      {!ended && (
        <Button size="sm" onClick={onRoom} className="gap-1.5 rounded-full">
          {art.status === "live" ? t("events.joinRoom") : t("events.waitingRoom")} <ArrowRight className="size-3.5" />
        </Button>
      )}
    </li>
  )
}
