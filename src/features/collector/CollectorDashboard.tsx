import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArtworkCard } from "../../components/artwork/ArtworkCard"
import { Button, Card, Tabs, TabsList, TabsTrigger } from "../../components/ui"
import { errorMessage, notify } from "../../lib/notify"
import type { Artwork, MyBid } from "../../types"
import { useAuth } from "../auth/auth-context"
import { useCatalog } from "../catalog/catalog-context"
import { useSavedIds } from "../catalog/saved"
import type { Profile } from "../profile/api"
import { ReadinessCard } from "../profile/ReadinessCard"
import { useMyBids } from "./api"
import { useOrders } from "../orders/api"
import { OrderRow, PayCountdown } from "../orders/components"
import { money } from "../orders/api"
import { RowsSkeleton } from "../../components/layout/PageSkeletons"
import { useI18n, type MessageKey } from "../../lib/i18n"

type Tab = "bids" | "saved" | "won"

const tabs: Array<{ key: Tab; label: MessageKey }> = [
  { key: "bids", label: "dashboard.collector.tab.bids" },
  { key: "saved", label: "dashboard.collector.tab.saved" },
  { key: "won", label: "dashboard.collector.tab.won" },
]

type Props = {
  profile: Profile
  avatar?: string | null
  onEditProfile: () => void
}

/** Buyer-focused dashboard: what am I bidding on, am I winning, what did I win. */
export function CollectorDashboard({ profile, avatar, onEditProfile }: Props) {
  const { user, becomeArtist } = useAuth()
  const { t } = useI18n()
  const { artworks } = useCatalog()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("bids")
  const savedIds = useSavedIds()
  const [upgrading, setUpgrading] = useState(false)
  const { bids: myBids, loading: bidsLoading } = useMyBids(user?.id)
  const { orders, loading: ordersLoading } = useOrders({ buyerId: user?.id })
  const liveOrders = orders.filter((o) => o.status !== "expired" && o.status !== "cancelled")
  const toPay = orders.filter((o) => o.status === "awaiting_payment")

  const byId = useMemo(
    () => new Map(artworks.map((art) => [art.id, art])),
    [artworks],
  )
  const me = user?.id ?? ""
  const bidRows = myBids
    .map((bid) => ({ bid, art: byId.get(bid.artworkId) }))
    .filter((row): row is { bid: MyBid; art: Artwork } => Boolean(row.art))
  const active = bidRows.filter(({ art }) => art.isLive)
  const winning = active.filter(({ art }) => art.highestBidderId === me)
  const demoWon = bidRows.filter(
    ({ art }) => !art.isLive && art.highestBidderId === me && !/^[0-9a-f-]{36}$/i.test(art.id),
  )
  const saved = artworks.filter((art) => savedIds.includes(art.id))
  const offers = bidRows.filter(
    ({ art }) =>
      art.status === "awaiting_seller" && art.highestBidderId === me && art.sellerDecision === "countered",
  )
  const initials = profile.username.slice(0, 2).toUpperCase() || "U"

  async function upgrade() {
    setUpgrading(true)
    try {
      await becomeArtist()
      notify(t("dashboard.collector.upgradedTitle"), t("dashboard.collector.upgradedDetail"))
    } catch (error) {
      notify(t("dashboard.collector.upgradeFailed"), errorMessage(error), "error")
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <main className="min-h-screen bg-bg pb-20">
      <div className="mx-auto max-w-6xl px-6 pt-10 lg:px-10">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-amber/40 bg-surface-2 font-display text-xl font-bold text-amber">
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-amber">
                {t("dashboard.collector.eyebrow")}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-text">
                {profile.display_name || profile.username || t("dashboard.collector.welcomeBack")}
              </h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/discover")}>
              {t("dashboard.collector.browseAuctions")}
            </Button>
            <Button onClick={onEditProfile}>{t("dashboard.collector.editProfile")}</Button>
          </div>
        </div>

        <ReadinessCard purpose="bid" onFix={onEditProfile} />

        {offers.map(({ art }) => (
          <div
            key={art.id}
            className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-violet-400/40 bg-violet-500/[.08] p-4"
          >
            <img src={art.image} alt="" className="size-12 rounded-xl object-cover" />
            <p className="min-w-0 flex-1 text-sm text-text">
              <strong>{t("dashboard.collector.offer.strong", { title: art.title, amount: art.counterOffer })}</strong>{" "}
              <span className="text-text-secondary">{t("dashboard.collector.offer.detail")}</span>
            </p>
            <Button onClick={() => navigate(`/artworks/${art.id}`)}>{t("dashboard.collector.offer.see")}</Button>
          </div>
        ))}

        {toPay.map((order) => (
          <div
            key={order.id}
            className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-amber/40 bg-amber/[.07] p-4"
          >
            {order.image && <img src={order.image} alt="" className="size-12 rounded-xl object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold text-text">
                {t("dashboard.collector.pay.title", { title: order.title, amount: money(order.totalDue) })}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-text-secondary">
                {t("dashboard.collector.pay.timeLeft")} <PayCountdown payBy={order.payBy} compact />
              </p>
            </div>
            <Button onClick={() => navigate(`/orders/${order.id}`)} className="font-semibold">
              {t("dashboard.collector.pay.now")}
            </Button>
          </div>
        ))}

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={t("dashboard.collector.stat.activeBids")} value={active.length} />
          <StatCard label={t("dashboard.collector.stat.winningNow")} value={winning.length} accent />
          <StatCard label={t("dashboard.collector.stat.watchlist")} value={saved.length} />
          <StatCard label={t("dashboard.collector.stat.won")} value={liveOrders.length + demoWon.length} />
        </div>

        {/* Tabs */}
        <Tabs className="border-b border-border">
          <TabsList className="h-auto gap-6 rounded-none bg-transparent p-0">
            {tabs.map((item) => (
              <TabsTrigger
                key={item.key}
                active={tab === item.key}
                onClick={() => setTab(item.key)}
                className={`rounded-none border-b-2 px-0 pb-3 text-[13px] ${
                  tab === item.key ? "border-amber" : "border-transparent"
                }`}
              >
                {t(item.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="py-6">
          {tab === "bids" &&
            (bidsLoading ? (
              <RowsSkeleton />
            ) : bidRows.length ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                {bidRows.map(({ bid, art }) => (
                  <BidRow
                    key={art.id}
                    bid={bid}
                    art={art}
                    winning={art.highestBidderId === me}
                    onOpen={() => navigate(`/artworks/${art.id}`)}
                  />
                ))}
              </div>
            ) : (
              <Empty
                text={t("dashboard.collector.empty.bids")}
                action={t("dashboard.collector.empty.bidsAction")}
                onAction={() => navigate("/discover")}
              />
            ))}

          {tab === "saved" &&
            (saved.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {saved.map((art) => (
                  <ArtworkCard
                    key={art.id}
                    art={art}
                    onClick={() => navigate(`/artworks/${art.id}`)}
                    onArtistClick={() => navigate(`/artists/${art.artistId}`)}
                  />
                ))}
              </div>
            ) : (
              <Empty
                text={t("dashboard.collector.empty.saved")}
                action={t("dashboard.collector.empty.savedAction")}
                onAction={() => navigate("/discover")}
              />
            ))}

          {tab === "won" &&
            (ordersLoading ? (
              <RowsSkeleton />
            ) : orders.length || demoWon.length ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                {orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    perspective="buyer"
                    onOpen={() => navigate(`/orders/${order.id}`)}
                  />
                ))}
                {demoWon.map(({ bid, art }) => (
                  <BidRow
                    key={art.id}
                    bid={bid}
                    art={art}
                    winning
                    onOpen={() => navigate(`/artworks/${art.id}`)}
                  />
                ))}
              </div>
            ) : (
              <Empty text={t("dashboard.collector.empty.won")} />
            ))}
        </div>

        {/* Upgrade path: one account, can become an artist */}
        <Card className="mt-4 flex-row flex-wrap items-center justify-between gap-4 border border-amber/25 bg-amber/[.06] p-5 ring-0">
          <div>
            <p className="font-display font-semibold text-text">
              {t("dashboard.collector.artist.title")}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {t("dashboard.collector.artist.text")}
            </p>
          </div>
          <Button onClick={() => void upgrade()} disabled={upgrading}>
            {upgrading ? t("dashboard.collector.artist.unlocking") : t("dashboard.collector.artist.open")}
          </Button>
        </Card>
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <Card className="border border-border bg-surface p-4 ring-0">
      <p className="text-[11px] uppercase tracking-[.08em] text-text-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-2xl font-bold ${
          accent ? "text-amber" : "text-text"
        }`}
      >
        {value}
      </p>
    </Card>
  )
}

function BidRow({
  bid,
  art,
  winning,
  onOpen,
}: {
  bid: MyBid
  art: Artwork
  winning: boolean
  onOpen: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-4 border-b border-border p-4 last:border-b-0 hover:bg-white/[.025]">
      <img
        src={art.image}
        alt=""
        loading="lazy"
        className="size-14 shrink-0 rounded-xl object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-semibold text-text">
          {art.title}
        </p>
        <p className="mt-0.5 text-xs text-text-secondary">
          {t("dashboard.bid.amounts", { amount: bid.amount, current: art.currentBid })}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          winning ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
        }`}
      >
        {art.status === "awaiting_seller"
          ? winning
            ? art.sellerDecision === "countered"
              ? t("dashboard.bid.status.offerForYou")
              : t("dashboard.bid.status.onApproval")
            : t("dashboard.bid.status.lost")
          : !art.isLive
            ? winning && !["rejected", "expired", "counter_declined"].includes(art.sellerDecision ?? "")
              ? t("dashboard.bid.status.won")
              : t("dashboard.bid.status.lost")
            : winning
              ? t("dashboard.bid.status.winning")
              : t("dashboard.bid.status.outbid")}
      </span>
      <Button size="sm" variant={winning ? "outline" : "default"} onClick={onOpen}>
        {art.isLive && !winning ? t("dashboard.bid.bidAgain") : t("common.view")}
      </Button>
    </div>
  )
}

function Empty({
  text,
  action,
  onAction,
}: {
  text: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <p className="text-sm text-text-muted">{text}</p>
      {action && (
        <Button variant="outline" className="mt-4" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  )
}
