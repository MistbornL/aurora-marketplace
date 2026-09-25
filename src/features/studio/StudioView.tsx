import { EndingSoonPill, LivePill, UpcomingPill } from "../../components/artwork/badges"
import { Button, Card, Tabs, TabsList, TabsTrigger } from "../../components/ui"
import type { Profile } from "../profile/api"
import { ReadinessCard } from "../profile/ReadinessCard"
import { PayoutCard } from "./PayoutCard"
import { RowsSkeleton } from "../../components/layout/PageSkeletons"
import type { ManagedAuction, StudioTab } from "./types"
import { useNavigate } from "react-router-dom"
import { money, useOrders, type Order } from "../orders/api"
import { OrderRow } from "../orders/components"
import { useI18n, type MessageKey } from "../../lib/i18n"

const tabs: Array<{ key: StudioTab; label: MessageKey }> = [
  { key: "auctions", label: "studio.tab.auctions" },
  { key: "artworks", label: "studio.tab.artworks" },
  { key: "sales", label: "studio.tab.sales" },
  { key: "about", label: "studio.tab.about" },
]

type Props = {
  profile: Profile
  userId: string
  avatar?: string | null
  cover?: string | null
  auctions: ManagedAuction[]
  loading: boolean
  error: string | null
  onRetry: () => void
  tab: StudioTab
  onTabChange: (tab: StudioTab) => void
  onEditProfile: () => void
  onCreateAuction: () => void
  onEditAuction: (auction: ManagedAuction) => void
  onDeleteAuction: (auction: ManagedAuction) => void
}

export function StudioView({
  profile,
  userId,
  avatar,
  cover,
  auctions,
  loading,
  error,
  onRetry,
  tab,
  onTabChange,
  onEditProfile,
  onCreateAuction,
  onEditAuction,
  onDeleteAuction,
}: Props) {
  const { t } = useI18n()
  const initials = profile.username.slice(0, 2).toUpperCase() || "U"
  const live = auctions.filter((item) => item.isLive)
  const navigate = useNavigate()
  const { orders, loading: ordersLoading } = useOrders({ sellerId: userId })
  const sales = orders.filter((o) => o.status !== "expired" && o.status !== "cancelled")
  // Earned = payouts for orders the buyer has actually paid for.
  const earned = sales
    .filter((o) => ["paid", "shipped", "delivered", "completed"].includes(o.status))
    .reduce((sum, o) => sum + o.sellerPayout, 0)
  const toShip = sales.filter((o) => o.status === "paid")
  const toDecide = auctions.filter((item) => item.status === "awaiting_seller" && !item.sellerDecision)

  return (
    <main className="min-h-screen bg-bg pb-20">
      <div className="relative h-60 overflow-hidden bg-surface-2">
        {cover && (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 lg:px-10">
        <div className="-mt-14 mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-bg bg-surface-2 font-display text-2xl font-bold text-amber">
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-text">
                {profile.display_name || profile.username || t("studio.yourName")}
              </h1>
              <p className="mt-1 text-xs font-bold uppercase tracking-[.18em] text-amber">
                {t("studio.artistStudio")}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                {profile.location || t("studio.addLocation")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onEditProfile}>
              {t("studio.editProfile")}
            </Button>
            <Button onClick={onCreateAuction}>{t("studio.newAuction")}</Button>
          </div>
        </div>

        <ReadinessCard purpose="sell" onFix={onEditProfile} />
        <PayoutCard userId={userId} />

        {toDecide.map((item) => (
          <div
            key={item.id}
            className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-violet-400/40 bg-violet-500/[.08] p-4"
          >
            {item.image && <img src={item.image} alt="" className="size-12 rounded-xl object-cover" />}
            <p className="min-w-0 flex-1 text-sm text-text">
              <strong>{t("studio.decide.banner", { title: item.title, amount: item.currentBid })}</strong>{" "}
              <span className="text-text-secondary">{t("studio.decide.hint")}</span>
            </p>
            <Button onClick={() => navigate(`/artworks/${item.id}`)}>{t("studio.decide.now")}</Button>
          </div>
        ))}

        {toShip.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/[.06] p-4">
            <p className="min-w-0 flex-1 text-sm text-text">
              <strong>{toShip.length === 1
                  ? t("studio.ship.one", { title: toShip[0].title })
                  : t("studio.ship.many", { count: toShip.length })}</strong>{" "}
              <span className="text-text-secondary">{t("studio.ship.hint")}</span>
            </p>
            <Button
              onClick={() =>
                toShip.length === 1 ? navigate(`/orders/${toShip[0].id}`) : onTabChange("sales")
              }
            >
              {toShip.length === 1 ? t("studio.ship.now") : t("studio.ship.viewSales")}
            </Button>
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-8">
          <Stat value={live.length} label={t("studio.stat.live")} />
          <Stat
            value={auctions.filter((item) => item.status === "draft").length}
            label={t("studio.stat.drafts")}
          />
          <Stat
            value={auctions.reduce((sum, item) => sum + item.bidCount, 0)}
            label={t("studio.stat.bids")}
          />
          <Stat value={money(earned)} label={t("studio.stat.earned")} />
        </div>

        <Tabs className="border-b border-border">
          <TabsList className="h-auto gap-6 rounded-none bg-transparent p-0">
            {tabs.map((item) => (
              <TabsTrigger
                key={item.key}
                active={tab === item.key}
                onClick={() => onTabChange(item.key)}
                className={`rounded-none border-b-2 px-0 pb-3 text-[13px] ${
                  tab === item.key ? "border-amber" : "border-transparent"
                }`}
              >
                {t(item.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {error ? (
          <div className="my-6 rounded-2xl border border-red-500/30 bg-red-500/[.06] p-6 text-center text-sm text-red-300">
            {error}
            <div>
              <Button variant="outline" className="mt-3" onClick={onRetry}>
                {t("common.tryAgainShort")}
              </Button>
            </div>
          </div>
        ) : loading ? (
          <div className="py-6">
            <RowsSkeleton />
          </div>
        ) : (
          <>
            {tab === "auctions" && (
              <AuctionList
                auctions={auctions}
                onOpen={(auction) => navigate(`/artworks/${auction.id}`)}
                onCreate={onCreateAuction}
                onEdit={onEditAuction}
                onDelete={onDeleteAuction}
              />
            )}
            {tab === "artworks" &&
              (auctions.length ? (
                <div className="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
                  {auctions.map((auction) => (
                    <AuctionTile key={auction.id} auction={auction} />
                  ))}
                </div>
              ) : (
                <EmptyState onCreate={onCreateAuction} />
              ))}
            {tab === "sales" &&
              (ordersLoading ? (
                <div className="py-6">
                  <RowsSkeleton />
                </div>
              ) : orders.length ? (
                <>
                  <SalesSummary orders={orders} />
                  <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
                    {orders.map((order) => (
                      <OrderRow
                        key={order.id}
                        order={order}
                        perspective="seller"
                        onOpen={() => navigate(`/orders/${order.id}`)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <p className="py-12 text-center text-sm text-text-muted">
                  {t("studio.sales.empty")}
                </p>
              ))}
            {tab === "about" && (
              <p className="max-w-xl py-6 text-sm leading-7 text-text-secondary">
                {profile.bio ||
                  t("studio.about.empty")}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function AuctionList({
  auctions,
  onCreate,
  onEdit,
  onDelete,
  onOpen,
}: {
  auctions: ManagedAuction[]
  onOpen: (auction: ManagedAuction) => void
  onCreate: () => void
  onEdit: (auction: ManagedAuction) => void
  onDelete: (auction: ManagedAuction) => void
}) {
  const { t } = useI18n()
  if (!auctions.length) return <EmptyState onCreate={onCreate} />
  return (
    <section className="py-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {auctions.map((auction) => (
          <div
            key={auction.id}
            className="flex flex-wrap items-center gap-4 border-b border-border p-4 last:border-b-0 hover:bg-white/[.025]"
          >
            <Thumb auction={auction} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display font-semibold text-text">
                {auction.title}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {auction.bidCount > 0
                  ? t("studio.list.current", { amount: auction.currentBid, count: auction.bidCount })
                  : t("studio.list.opening", { amount: auction.openingBid })}
                <span className="px-1 text-text-muted">•</span>
                {t("studio.list.increments", { amount: auction.bidIncrement })}
              </p>
            </div>
            <StatusPill auction={auction} />
            <div className="ml-auto flex shrink-0 gap-2">
              {auction.status === "awaiting_seller" ? (
                <Button size="sm" onClick={() => onOpen(auction)}>
                  {t("studio.list.decide")}
                </Button>
              ) : auction.status === "ended" ? (
                <Button variant="outline" size="sm" onClick={() => onOpen(auction)}>
                  {t("common.view")}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => onEdit(auction)}>
                  {t("common.edit")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={auction.bidCount > 0}
                title={
                  auction.bidCount > 0
                    ? t("studio.list.cantDelete")
                    : undefined
                }
                onClick={() => onDelete(auction)}
              >
                {t("common.delete")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function StatusPill({ auction }: { auction: ManagedAuction }) {
  const { t } = useI18n()
  if (auction.isLive)
    return auction.format === "live" ? (
      <LivePill small />
    ) : auction.timeLeftSecs <= 5 * 60 ? (
      <EndingSoonPill small />
    ) : null
  if (auction.status === "scheduled")
    return <UpcomingPill small label={auction.format === "live" ? t("studio.pill.liveScheduled") : t("studio.pill.scheduled")} />
  if (auction.status === "awaiting_seller")
    return (
      <span className="rounded-full bg-violet-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        {t("studio.pill.yourDecision")}
      </span>
    )
  const unsold = ["rejected", "expired", "counter_declined"].includes(auction.sellerDecision ?? "")
  const label =
    auction.status === "draft"
      ? t("studio.pill.draft")
      : auction.bidCount > 0 && !unsold
        ? t("studio.pill.sold")
        : auction.bidCount > 0
          ? t("studio.pill.notSold")
          : t("common.ended")
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
      {label}
    </span>
  )
}

function Thumb({ auction }: { auction: ManagedAuction }) {
  return (
    <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2">
      {auction.image ? (
        <img
          src={auction.image}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        "🎨"
      )}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useI18n()
  return (
    <div className="my-6 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <p className="text-sm text-text-muted">{t("studio.empty.title")}</p>
      <Button variant="outline" className="mt-4" onClick={onCreate}>
        {t("studio.empty.cta")}
      </Button>
    </div>
  )
}

function SalesSummary({ orders }: { orders: Order[] }) {
  const { t } = useI18n()
  const live = orders.filter((o) => o.status !== "expired" && o.status !== "cancelled")
  const completed = live.filter((o) => ["paid", "shipped", "delivered", "completed"].includes(o.status))
  const gmv = completed.reduce((sum, o) => sum + o.hammerPrice, 0)
  // Payout is released after delivery — "pending" is money already collected but not yet sent.
  const pendingPayout = live
    .filter((o) => ["paid", "shipped", "delivered"].includes(o.status))
    .reduce((sum, o) => sum + o.sellerPayout, 0)
  const awaitingPayment = live.filter((o) => ["awaiting_payment", "payment_submitted"].includes(o.status)).length

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card className="border border-border bg-surface p-4 ring-0">
        <p className="text-[11px] uppercase tracking-[.08em] text-text-muted">{t("studio.sales.gmv")}</p>
        <p className="mt-1 font-display text-xl font-bold text-text">{money(gmv)}</p>
      </Card>
      <Card className="border border-border bg-surface p-4 ring-0">
        <p className="text-[11px] uppercase tracking-[.08em] text-text-muted">{t("studio.sales.pendingPayout")}</p>
        <p className="mt-1 font-display text-xl font-bold text-amber">{money(pendingPayout)}</p>
      </Card>
      <Card className="border border-border bg-surface p-4 ring-0">
        <p className="text-[11px] uppercase tracking-[.08em] text-text-muted">{t("studio.sales.completed")}</p>
        <p className="mt-1 font-display text-xl font-bold text-text">{completed.length}</p>
      </Card>
      <Card className="border border-border bg-surface p-4 ring-0">
        <p className="text-[11px] uppercase tracking-[.08em] text-text-muted">{t("studio.sales.awaitingPayment")}</p>
        <p className="mt-1 font-display text-xl font-bold text-text">{awaitingPayment}</p>
      </Card>
    </div>
  )
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="font-display text-xl font-bold text-text">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  )
}

function AuctionTile({ auction }: { auction: ManagedAuction }) {
  return (
    <Card className="overflow-hidden border border-border bg-surface ring-0">
      <div className="relative grid aspect-square place-items-center bg-surface-2 text-3xl">
        {auction.image ? (
          <img
            src={auction.image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          "🎨"
        )}
        <div className="absolute left-3 top-3">
          <StatusPill auction={auction} />
        </div>
      </div>
      <div className="p-3">
        <p className="font-display font-semibold text-text">{auction.title}</p>
        <p className="mt-1 text-xs text-text-muted">
          {auction.currentBid}₾ · +{auction.bidIncrement}₾
        </p>
      </div>
    </Card>
  )
}
