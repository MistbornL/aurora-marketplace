import { useEffect, useRef, useState } from "react"
import { Bell, BellRing, ChevronLeft, Share2 } from "lucide-react"
import { VerifiedBadge } from "../../components/artwork/badges"
import { HeartButton } from "../../components/artwork/HeartButton"
import { Button } from "../../components/ui"
import { formatLeft, useRemaining } from "../../lib/clock"
import { notify } from "../../lib/notify"
import { categoryLabel, useI18n } from "../../lib/i18n"
import type { Artwork } from "../../types"
import { useCatalog } from "../catalog/catalog-context"
import { useAuth } from "../auth/auth-context"
import { money, useArtworkOrder } from "../orders/api"
import { useNavigate } from "react-router-dom"
import { getArtwork } from "./api"
import { ArtworkGallery } from "./components/ArtworkGallery"
import { BidderAvatar, BidHistoryList } from "./components/BidHistoryList"
import { BidPanel } from "./components/BidPanel"
import { useBidding } from "./use-bidding"
import { useLiveArtwork } from "./use-live-artwork"

type Props = {
  artworkId: string
  onBack: () => void
  onArtistClick: (id: string) => void
}

export default function ArtworkDetailPage({
  artworkId,
  onBack,
  onArtistClick,
}: Props) {
  const { artworks } = useCatalog()
  const cached = artworks.find((a) => a.id === artworkId)
  // A brand-new auction may not be in the cached catalogue yet: fetch it.
  const [fetched, setFetched] = useState<Artwork | null | undefined>(
    cached ? null : undefined,
  )
  useEffect(() => {
    if (cached) return
    const controller = new AbortController()
    void getArtwork(artworkId, controller.signal)
      .then(setFetched)
      .catch(() => setFetched(null))
    return () => controller.abort()
  }, [artworkId, cached])

  const { t } = useI18n()
  const art = cached ?? fetched
  if (fetched === undefined && !cached)
    return <div className="min-h-[60vh] bg-bg" />
  if (!art)
    return (
      <div className="grid min-h-[60vh] place-items-center gap-3 bg-bg text-sm text-text-secondary">
        <p>{t("artwork.notFound")}</p>
        <Button variant="outline" onClick={onBack}>
          {t("artwork.goBack")}
        </Button>
      </div>
    )
  return (
    <ArtworkDetailView
      key={art.id}
      initial={art}
      onBack={onBack}
      onArtistClick={onArtistClick}
    />
  )
}

function ArtworkDetailView({
  initial,
  onBack,
  onArtistClick,
}: {
  initial: Artwork
  onBack: () => void
  onArtistClick: (id: string) => void
}) {
  const { artists } = useCatalog()
  const { user } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const { artwork: art, history, historyLoading, applyBid, replace } =
    useLiveArtwork(initial)
  const artist = artists.find((item) => item.id === art.artistId)
  // Live lots move their end time on every bid; re-anchor when it changes.
  const secs = useRemaining(art.timeLeftSecs, art.endsAt)
  const startsIn = useRemaining(art.startsInSecs, art.startsAt)
  const bidding = useBidding({ art, history, secsLeft: secs, startsIn, applyBid, replace })
  const { state, isLive, submitting, justPlaced } = bidding
  const [reminderSet, setReminderSet] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const status = bidding.upcoming
    ? "upcoming"
    : art.status === "awaiting_seller"
      ? "approval"
      : !isLive
        ? "ended"
        : art.format !== "live" && secs <= 2 * 3600
          ? "ending"
          : "live"
  const order = useArtworkOrder(art.id, user?.id, !isLive)

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: art.title, url })
      else {
        await navigator.clipboard.writeText(url)
        notify(t("artwork.linkCopied"), t("artwork.linkCopiedText"))
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  function toggleReminder() {
    const next = !reminderSet
    setReminderSet(next)
    if (next)
      notify(t("artwork.reminderSet"), t("artwork.reminderSetText", { title: art.title }))
  }

  const details = [
    { label: t("artwork.detail.medium"), value: art.medium },
    { label: t("artwork.detail.size"), value: art.dimensions },
    { label: t("artwork.detail.year"), value: art.year ? String(art.year) : "" },
    { label: t("artwork.detail.category"), value: art.category ? categoryLabel(t, art.category) : "" },
    { label: t("artwork.detail.startingBid"), value: `${art.startingBid}₾` },
    { label: t("artwork.detail.bidStep"), value: `${art.bidIncrement}₾` },
  ].filter((row) => row.value)

  return (
    <main className="min-h-screen bg-bg pb-28 lg:pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        {/* Breadcrumb */}
        <nav aria-label={t("artwork.breadcrumb")} className="flex items-center gap-2 py-5 text-[13px] text-text-muted">
          <button onClick={onBack} className="flex items-center gap-1 text-text-secondary hover:text-text">
            <ChevronLeft className="size-4" /> {t("common.back")}
          </button>
          <span>/</span>
          <span>{art.category ? categoryLabel(t, art.category) : t("artwork.fallbackCategory")}</span>
          <span>/</span>
          <span className="truncate text-text-secondary">{art.title}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
          {/* Gallery */}
          <ArtworkGallery
            title={art.title}
            images={[art.image, ...art.thumbs.slice(1)].filter(Boolean)}
            status={status}
          />

          {/* Right column: title, bid panel, actions (sticky on desktop) */}
          <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="flex flex-col gap-5 lg:sticky lg:top-24">
              <div>
                <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-text sm:text-4xl">
                  {art.title}
                </h1>
                <button
                  onClick={() => onArtistClick(art.artistId)}
                  className="mt-3 flex items-center gap-2.5 rounded-full py-1 pr-3 text-left transition-colors hover:bg-white/[.04]"
                >
                  <BidderAvatar name={art.artist} src={artist?.avatar ?? null} size={30} />
                  <span className="text-sm text-text-secondary">
                    {t("artwork.by")} <span className="font-medium text-text">{art.artist}</span>
                  </span>
                  {artist?.verified && <VerifiedBadge />}
                </button>
              </div>

              <div ref={panelRef} className="scroll-mt-24">
                <BidPanel
                  art={art}
                  secsLeft={secs}
                  startsIn={startsIn}
                  canBuyNow={bidding.canBuyNow}
                  onBuyNow={bidding.handleBuyNow}
                  viewerId={user?.id ?? null}
                  onArtworkChange={replace}
                  state={state}
                  history={history}
                  historyLoading={historyLoading}
                  submitting={submitting}
                  justPlaced={justPlaced}
                  onBid={bidding.handleBid}
                  onSignIn={bidding.openSignIn}
                  onSeeAllBids={() =>
                    historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                />
              </div>

              {order && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber/40 bg-amber/[.07] p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text">
                      {order.buyerId === user?.id
                        ? order.status === "awaiting_payment"
                          ? t("artwork.order.wonPay", { amount: money(order.totalDue) })
                          : t("artwork.order.won")
                        : t("artwork.order.sold", { amount: money(order.sellerPayout) })}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">{t("artwork.order.reference", { reference: order.reference })}</p>
                  </div>
                  <Button onClick={() => navigate(`/orders/${order.id}`)} className="font-semibold">
                    {order.buyerId === user?.id && order.status === "awaiting_payment" ? t("artwork.order.payNow") : t("artwork.order.view")}
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-white/10 py-1 pl-1 pr-3.5 text-[13px] text-text-secondary">
                  <HeartButton size={28} artworkId={art.id} artworkTitle={art.title} />
                  {t("artwork.save")}
                </div>
                {(isLive || bidding.upcoming) && (
                  <button
                    onClick={toggleReminder}
                    className={`flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors ${
                      reminderSet
                        ? "border-amber/40 bg-amber/10 text-amber"
                        : "border-white/10 text-text-secondary hover:text-text"
                    }`}
                  >
                    {reminderSet ? <BellRing className="size-4" /> : <Bell className="size-4" />}
                    {reminderSet ? t("artwork.reminderOn") : t("artwork.remindMe")}
                  </button>
                )}
                <button
                  onClick={() => void share()}
                  className="flex h-9 items-center gap-2 rounded-full border border-white/10 px-3.5 text-[13px] text-text-secondary transition-colors hover:text-text"
                >
                  <Share2 className="size-4" /> {t("artwork.share")}
                </button>
              </div>
            </div>
          </aside>

          {/* Details, artist, full history */}
          <div className="flex flex-col gap-10 lg:col-start-1">
            <section>
              <h2 className="font-display text-xl font-semibold text-text">{t("artwork.about")}</h2>
              {art.description && (
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-text-secondary">
                  {art.description}
                </p>
              )}
              <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {details.map((row) => (
                  <div key={row.label} className="rounded-2xl border border-white/[.06] bg-surface/60 px-4 py-3.5">
                    <dt className="text-xs text-text-muted">{row.label}</dt>
                    <dd className="mt-1 text-sm font-medium text-text">{row.value}</dd>
                  </div>
                ))}
              </dl>
              {art.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {art.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/[.08] px-3 py-1 text-xs text-text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-4 rounded-3xl border border-white/[.06] bg-surface/60 p-5 sm:flex-row sm:items-center">
              <BidderAvatar name={art.artist} src={artist?.avatar ?? null} size={56} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-display text-lg font-semibold text-text">
                  {art.artist} {artist?.verified && <VerifiedBadge />}
                </p>
                {artist?.location && <p className="text-xs text-text-muted">{artist.location}</p>}
                {artist?.bio && (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-secondary">{artist.bio}</p>
                )}
              </div>
              <Button variant="outline" onClick={() => onArtistClick(art.artistId)} className="h-10 rounded-full px-4">
                {t("artwork.viewArtist")}
              </Button>
            </section>

            <section ref={historyRef} className="scroll-mt-24">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-semibold text-text">{t("artwork.bidHistory")}</h2>
                <span className="text-xs text-text-muted">
                  {t("common.bids", { count: art.bids })} · {t("artwork.updatesLive")}
                </span>
              </div>
              <div className="mt-3 rounded-3xl border border-white/[.06] bg-surface/60 px-5 py-2">
                <BidHistoryList bids={history} loading={historyLoading} total={art.bids} />
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Mobile: sticky bid bar */}
      {(state === "open" || state === "outbid" || state === "signed-out") && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[.08] bg-[#0d0d10]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold text-amber">{art.currentBid}₾</p>
              <p className="text-[11px] text-text-muted">
                {art.format === "live" ? t("artwork.mobile.live", { time: `0:${String(Math.min(secs, 59)).padStart(2, "0")}` }) : t("artwork.mobile.endsIn", { time: formatLeft(secs) })}
              </p>
            </div>
            <Button
              onClick={() =>
                state === "signed-out"
                  ? bidding.openSignIn()
                  : panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="h-11 rounded-full bg-amber px-6 font-semibold text-bg hover:bg-[#f3ca6b]"
            >
              {state === "signed-out" ? t("artwork.signInToBid") : t("artwork.placeABid")}
            </Button>
          </div>
        </div>
      )}

      {bidding.dialogs}
    </main>
  )
}
