import { formatLeft, useCountdown } from "../../lib/clock"
import { useI18n } from "../../lib/i18n"
import type { Artwork } from "../../types"
import { Button, Card, CardContent, Separator } from "../ui"
import { EndingSoonPill, LivePill, OnApprovalPill, UpcomingPill } from "./badges"
import { HeartButton } from "./HeartButton"

export function ArtworkCard({
  art,
  onClick,
  onArtistClick,
}: {
  art: {
    id: string
    title: string
    artist: string
    image: string
    category: string
    currentBid: number
    bids: number
    timeLeftSecs: number
    isLive: boolean
  } & Partial<Pick<Artwork, "status" | "format" | "startsInSecs" | "buyNowPrice">>
  onClick: () => void
  onArtistClick: () => void
}) {
  const { t, lang } = useI18n()
  // Card only shows hours + minutes, so re-render once a minute, not every second.
  const { secs, h, m } = useCountdown(art.timeLeftSecs, 60)
  const starts = useCountdown(art.startsInSecs ?? 0, 60)
  const upcoming = art.status === "upcoming" && starts.secs > 0
  const onApproval = art.status === "awaiting_seller"
  const ended = !upcoming && (!art.isLive || secs <= 0)
  const liveFormat = art.format === "live"

  return (
    <Card
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick()
      }}
      className="group flex cursor-pointer flex-col overflow-hidden border border-border bg-surface ring-0 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-[3px] hover:border-amber/40 hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
      onClick={onClick}
    >
      <div className="relative overflow-hidden bg-surface-2">
        <img
          src={art.image}
          alt={art.title}
          loading="lazy"
          decoding="async"
          className="block h-[230px] w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-2.5 top-2.5">
          {upcoming ? (
            <UpcomingPill small label={`${liveFormat ? "LIVE · " : ""}${t("layout.card.startsIn", {
                // Georgian has no casing we want here (toUpperCase would give Mtavruli).
                time: lang === "ka" ? formatLeft(starts.secs) : formatLeft(starts.secs).toUpperCase(),
              })}`} />
          ) : onApproval ? (
            <OnApprovalPill small />
          ) : (
            !ended &&
            (liveFormat ? (
              <LivePill small />
            ) : secs <= 5 * 60 ? (
              <EndingSoonPill small />
            ) : null)
          )}
        </div>
        <div
          className="absolute right-2.5 top-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <HeartButton artworkId={art.id} artworkTitle={art.title} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface/85 to-transparent to-55%" />
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-base font-semibold text-text">
            {art.title}
          </h3>
          <button
            className="mt-0.5 text-xs text-text-secondary hover:text-text"
            onClick={(e) => {
              e.stopPropagation()
              onArtistClick()
            }}
          >
            {art.artist}
          </button>
        </div>
        <div className="relative mt-auto flex items-end justify-between pt-3">
          <Separator className="absolute inset-x-0 top-0" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-text-muted">
              {t("layout.card.currentBid")}
            </p>
            <p className="font-display text-xl font-bold text-amber">
              {art.currentBid}₾
            </p>
            <p className="text-[11px] text-text-muted">
              {upcoming
                ? liveFormat
                  ? t("layout.card.liveAuction")
                  : t("layout.card.upcoming")
                : `${t("common.bids", { count: art.bids })} · ${
                    ended
                      ? t("common.ended")
                      : liveFormat
                        ? t("layout.card.liveNow")
                        : t("layout.card.timeLeft", { h, m })
                  }`}
            </p>
            {art.buyNowPrice != null && art.bids === 0 && !ended && (
              <p className="mt-0.5 text-[11px] font-medium text-emerald-400">
                {t("layout.card.buyNow", { amount: art.buyNowPrice })}
              </p>
            )}
          </div>
          {!ended || upcoming ? (
            <Button
              className="h-9 rounded-lg bg-amber px-4 font-display text-[12px] text-bg shadow-md shadow-amber/10 hover:bg-[#f3ca6b]"
              onClick={(e) => {
                e.stopPropagation()
                onClick()
              }}
            >
              {upcoming ? t("common.view") : t("layout.card.bid")}
            </Button>
          ) : (
            <span className="rounded-xl border border-border px-3 py-2 text-[11px] text-text-muted">
              {onApproval ? t("layout.card.onApproval") : t("common.ended")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
