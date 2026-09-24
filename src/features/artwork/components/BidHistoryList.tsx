import { Skeleton } from "../../../components/ui"
import { timeAgo } from "../../../lib/notify"
import { useI18n } from "../../../lib/i18n"
import type { BidEntry } from "../../../types"

export function BidderAvatar({
  name,
  src,
  size = 32,
}: {
  name: string
  src: string | null
  size?: number
}) {
  return src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-surface-2 font-bold text-amber"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  )
}

/** Newest first. The top row is the current highest bid; your bids are marked. */
export function BidHistoryList({
  bids,
  loading,
  total,
  limit,
}: {
  bids: BidEntry[]
  loading: boolean
  total: number
  limit?: number
}) {
  const { t } = useI18n()
  if (loading && !bids.length)
    return (
      <div className="space-y-3 py-3" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    )
  if (!bids.length)
    return (
      <p className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-text-muted">
        {t("artwork.history.empty")}
      </p>
    )
  const shown = limit ? bids.slice(0, limit) : bids
  return (
    <ol className="flex flex-col">
      {shown.map((bid, index) => {
        const top = index === 0
        return (
          <li
            key={bid.id}
            className={`flex items-center gap-3 border-b border-white/[.05] py-3 last:border-b-0 ${
              top ? "animate-in fade-in-0 slide-in-from-top-1" : ""
            }`}
          >
            <BidderAvatar name={bid.bidder} src={bid.avatar} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-medium text-text">
                {bid.isYou ? t("artwork.history.you") : bid.bidder}
                {top && (
                  <span className="rounded-full bg-amber/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber">
                    {t("artwork.history.highest")}
                  </span>
                )}
              </p>
              <p className="text-xs text-text-muted">{timeAgo(bid.createdAt)}</p>
            </div>
            <p
              className={`font-mono text-[15px] font-semibold ${
                top ? "text-amber" : bid.isYou ? "text-text" : "text-text-secondary"
              }`}
            >
              {bid.amount}₾
            </p>
          </li>
        )
      })}
      {!limit && total > bids.length && (
        <li className="pt-3 text-center text-xs text-text-muted">
          {t("artwork.history.showing", { shown: bids.length, total })}
        </li>
      )}
    </ol>
  )
}
