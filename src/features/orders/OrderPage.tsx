import { useCallback, useEffect, useState, type ReactNode } from "react"
import {
  ArrowLeft,
  Check,
  Copy,
  CreditCard,
  Landmark,
  Mail,
  Package,
  Phone,
  ShieldCheck,
  Truck,
} from "lucide-react"
import { Button, Card, Input, Textarea } from "../../components/ui"
import { RowsSkeleton } from "../../components/layout/PageSkeletons"
import { errorMessage, notify } from "../../lib/notify"
import { useI18n, type MessageKey } from "../../lib/i18n"
import { useAuth } from "../auth/auth-context"
import { AdminOrderActions } from "./AdminOrderActions"
import {
  confirmDelivered,
  getOrder,
  getOrderContacts,
  getSettings,
  markShipped,
  money,
  PAYMENTS_TEST_MODE,
  simulateCardPayment,
  submitPayment,
  type Order,
  type OrderContact,
  type PlatformSettings,
} from "./api"
import { PayCountdown, StatusPill } from "./components"
import { DeliveryCard, PayoutAccount, ReportProblem, useShipping } from "./OrderExtras"

type Props = { orderId: string; onBack: () => void; onArtwork: (id: string) => void }

/** One page for everyone involved in a sale; what you see depends on who you are. */
export default function OrderPage({ orderId, onBack, onArtwork }: Props) {
  const { user, role } = useAuth()
  const { t } = useI18n()
  const [order, setOrder] = useState<Order | null | undefined>()
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [contacts, setContacts] = useState<OrderContact[]>([])
  const [error, setError] = useState<string | null>(null)
  const { shipping, reload: reloadShipping } = useShipping(orderId)

  const load = useCallback(async () => {
    try {
      const next = await getOrder(orderId)
      setOrder(next)
      setError(null)
      if (next && ["paid", "shipped", "delivered", "completed"].includes(next.status))
        setContacts(await getOrderContacts(orderId).catch(() => []))
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [orderId])

  useEffect(() => {
    if (!user) return
    void load()
    void getSettings().then(setSettings, () => undefined)
  }, [user, load])

  // While we wait on someone else (payment check, shipping), refresh quietly.
  const waiting = order && ["awaiting_payment", "payment_submitted", "paid", "shipped"].includes(order.status)
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => void load(), 20_000)
    return () => clearInterval(timer)
  }, [waiting, load])

  if (!user)
    return <Centered>{t("orders.signInToSee")}</Centered>
  if (error)
    return (
      <Centered>
        {error}
        <Button variant="outline" className="mt-3" onClick={() => void load()}>
          {t("common.tryAgainShort")}
        </Button>
      </Centered>
    )
  if (order === undefined)
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 pt-10">
        <RowsSkeleton rows={4} />
      </main>
    )
  if (!order) return <Centered>{t("orders.notFound")}</Centered>

  const perspective =
    order.buyerId === user.id ? "buyer" : order.sellerId === user.id ? "seller" : "admin"

  return (
    <main className="min-h-screen bg-bg pb-20">
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:px-10">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text"
        >
          <ArrowLeft className="size-4" /> {t("common.back")}
        </button>

        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center gap-5">
          <button onClick={() => onArtwork(order.artworkId)} className="shrink-0">
            {order.image ? (
              <img src={order.image} alt="" className="size-20 rounded-2xl object-cover" />
            ) : (
              <div className="size-20 rounded-2xl bg-surface-2" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-amber">
              {t("orders.orderNumber", { reference: order.reference })}
              {order.secondChance && t("orders.secondChance")}
            </p>
            <h1 className="mt-1 truncate font-display text-2xl font-bold text-text sm:text-3xl">
              {order.title}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {perspective === "seller"
                ? t("orders.soldTo", { name: order.buyerName })
                : perspective === "buyer"
                  ? t("orders.by", { name: order.sellerName })
                  : t("orders.boughtFrom", { buyer: order.buyerName, seller: order.sellerName })}
            </p>
          </div>
          <StatusPill status={order.status} />
        </div>

        <Timeline order={order} />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-6">
            {perspective === "buyer" && (
              <BuyerPanel order={order} settings={settings} onChange={load} deliveryReady={Boolean(shipping)} />
            )}
            {perspective === "buyer" && (
              <DeliveryCard order={order} perspective="buyer" shipping={shipping} onSaved={reloadShipping} />
            )}
            {perspective === "seller" && (
              <SellerPanel order={order} settings={settings} onChange={load} />
            )}
            {role === "admin" && (
              <Section title={t("orders.admin.title")}>
                <AdminOrderActions order={order} onDone={() => void load()} />
                {order.paymentReference && (
                  <p className="mt-3 text-xs text-text-muted">
                    {t("orders.admin.buyerNote")} <span className="text-text-secondary">{order.paymentReference}</span>
                  </p>
                )}
                {["delivered", "completed"].includes(order.status) && <PayoutAccount order={order} />}
              </Section>
            )}
            {perspective !== "buyer" && (
              <DeliveryCard order={order} perspective={perspective} shipping={shipping} onSaved={reloadShipping} />
            )}
            {contacts.length > 0 && <Contacts contacts={contacts} />}
            {perspective !== "admin" && <ReportProblem order={order} />}
          </div>

          <aside className="flex flex-col gap-6">
            <Breakdown order={order} perspective={perspective} />
            <Card className="border border-border bg-surface p-5 text-sm leading-6 text-text-secondary ring-0">
              <p className="flex items-center gap-2 font-display font-semibold text-text">
                <ShieldCheck className="size-4 text-emerald-400" /> {t("orders.protected.title")}
              </p>
              <p className="mt-2">
                {t("orders.protected.body")}
                {settings ? t("orders.protected.auto", { days: settings.autoReleaseDays }) : ""}
                {t("orders.protected.end")}
              </p>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  )
}

// ── Buyer ────────────────────────────────────────────────────────────────────
function BuyerPanel({
  order,
  settings,
  onChange,
  deliveryReady,
}: {
  order: Order
  settings: PlatformSettings | null
  onChange: () => Promise<void>
  /** Payment waits until the buyer has said how the work should reach them. */
  deliveryReady: boolean
}) {
  const { t } = useI18n()
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  async function act(label: string, action: () => Promise<unknown>, title: string, detail: string) {
    setBusy(label)
    try {
      await action()
      notify(title, detail)
      await onChange()
    } catch (error) {
      notify(t("common.somethingWrong"), errorMessage(error), "error")
    } finally {
      setBusy(null)
    }
  }

  switch (order.status) {
    case "awaiting_payment": {
      const bankReady = Boolean(settings?.bankIban)
      return (
        <Section
          title={t("orders.pay.title")}
          aside={
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[.1em] text-text-muted">{t("orders.pay.timeLeft")}</p>
              <PayCountdown payBy={order.payBy} />
            </div>
          }
        >
          <p className="text-sm leading-6 text-text-secondary">
            {t("orders.pay.bodyBefore")} <strong className="text-text">{money(order.totalDue)}</strong>
            {t("orders.pay.bodyAfter", { hours: settings?.paymentWindowHours ?? 24 })}
          </p>

          <div className="mt-5 rounded-2xl border border-border bg-bg/60 p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
              <Landmark className="size-4 text-amber" /> {t("orders.pay.bankTransfer")}
            </p>
            {bankReady && settings ? (
              <dl className="grid gap-2 text-sm">
                <CopyRow label={t("orders.pay.bank")} value={settings.bankName} />
                <CopyRow label={t("orders.pay.accountHolder")} value={settings.bankAccountHolder} />
                <CopyRow label={t("orders.pay.iban")} value={settings.bankIban} mono />
                <CopyRow label={t("orders.pay.amount")} value={order.totalDue.toFixed(2)} mono display={money(order.totalDue)} />
                <CopyRow label={t("orders.pay.description")} value={`TSISKARI ${order.reference}`} mono highlight />
              </dl>
            ) : (
              <p className="text-sm text-text-muted">
                {t("orders.pay.bankNotReady")}
              </p>
            )}
            <p className="mt-3 text-xs text-text-muted">
              {t("orders.pay.descriptionHint")}
            </p>
          </div>

          {!deliveryReady && (
            <p className="mt-5 rounded-xl bg-amber/10 px-3 py-2 text-xs text-amber">{t("pilot.delivery.needed")}</p>
          )}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("orders.pay.txPlaceholder")}
              aria-label={t("orders.pay.txLabel")}
              maxLength={120}
              className="h-11 sm:flex-1"
            />
            <Button
              className="h-11 px-5 font-semibold"
              disabled={Boolean(busy) || !bankReady || !deliveryReady}
              onClick={() =>
                void act(
                  "submit",
                  () => submitPayment(order.id, note.trim() || undefined),
                  t("orders.pay.submittedTitle"),
                  t("orders.pay.submittedDetail"),
                )
              }
            >
              {busy === "submit" ? t("orders.pay.sending") : t("orders.pay.iSent")}
            </Button>
          </div>

          {PAYMENTS_TEST_MODE && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-sky-500/40 bg-sky-500/[.05] p-4">
              <p className="text-xs leading-5 text-sky-200/80">
                <strong className="text-sky-200">{t("orders.pay.testMode")}</strong>
                {t("orders.pay.testModeBody")}
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={Boolean(busy) || !deliveryReady}
                onClick={() =>
                  void act(
                    "card",
                    () => simulateCardPayment(order.id),
                    t("orders.pay.received"),
                    t("orders.pay.confirmedAuto", { amount: money(order.totalDue) }),
                  )
                }
              >
                <CreditCard className="size-4" />
                {busy === "card" ? t("orders.pay.processing") : t("orders.pay.simulate")}
              </Button>
            </div>
          )}
        </Section>
      )
    }
    case "payment_submitted":
      return (
        <Section title={t("orders.checking.title")}>
          <p className="text-sm leading-6 text-text-secondary">
            {t("orders.checking.body")}
          </p>
        </Section>
      )
    case "paid":
      return (
        <Section title={t("orders.buyerPaid.title")}>
          <p className="text-sm leading-6 text-text-secondary">
            {t("orders.buyerPaid.body")}
          </p>
          <ReceivedButton order={order} busy={busy} act={act} />
        </Section>
      )
    case "shipped":
      return (
        <Section title={t("orders.onItsWay.title")}>
          {order.shippingNote && (
            <p className="mb-3 rounded-xl bg-white/[.04] p-3 text-sm text-text">
              <Truck className="mr-2 inline size-4 text-amber" />
              {order.shippingNote}
            </p>
          )}
          <p className="text-sm leading-6 text-text-secondary">
            {t("orders.onItsWay.body")}
            {settings && t("orders.onItsWay.auto", { days: settings.autoReleaseDays })}
          </p>
          <ReceivedButton order={order} busy={busy} act={act} />
        </Section>
      )
    case "delivered":
    case "completed":
      return (
        <Section title={t("orders.enjoy.title")}>
          <p className="text-sm leading-6 text-text-secondary">
            {t("orders.enjoy.body")}
          </p>
        </Section>
      )
    case "expired":
      return (
        <Section title={t("orders.expired.title")}>
          <p className="text-sm leading-6 text-text-secondary">
            {t("orders.expired.body")}
          </p>
        </Section>
      )
    case "cancelled":
      return (
        <Section title={t("orders.cancelled.title")}>
          <p className="text-sm leading-6 text-text-secondary">
            {t("orders.cancelled.buyerBody")}
          </p>
        </Section>
      )
  }
}

type Act = (label: string, action: () => Promise<unknown>, title: string, detail: string) => Promise<void>

function ReceivedButton({ order, busy, act }: { order: Order; busy: string | null; act: Act }) {
  const { t } = useI18n()
  return (
    <Button
      className="mt-4 h-11 font-semibold"
      disabled={Boolean(busy)}
      onClick={() =>
        void act(
          "received",
          () => confirmDelivered(order.id),
          t("orders.delivery.confirmed"),
          t("orders.delivery.releasePayout"),
        )
      }
    >
      <Package className="size-4" />
      {busy === "received" ? t("common.saving") : t("orders.delivery.received")}
    </Button>
  )
}

// ── Seller ───────────────────────────────────────────────────────────────────
function SellerPanel({
  order,
  settings,
  onChange,
}: {
  order: Order
  settings: PlatformSettings | null
  onChange: () => Promise<void>
}) {
  const { t, formatDate } = useI18n()
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  switch (order.status) {
    case "awaiting_payment":
    case "payment_submitted":
      return (
        <Section title={t("orders.seller.waitingTitle")}>
          <p className="text-sm leading-6 text-text-secondary">
            {order.status === "payment_submitted"
              ? t("orders.seller.waitingSubmitted")
              : t("orders.seller.waitingUntil", { date: formatDate(order.payBy) })}{" "}
            <strong className="text-text">{t("orders.seller.dontShip")}</strong>
            {t("orders.seller.waitingAfter")}
          </p>
        </Section>
      )
    case "paid":
      return (
        <Section title={t("orders.seller.paidTitle")}>
          <p className="text-sm leading-6 text-text-secondary">
            {t("orders.seller.paidBody")}
          </p>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("orders.seller.shipPlaceholder")}
            aria-label={t("orders.seller.shipLabel")}
            maxLength={300}
            className="mt-4 min-h-20"
          />
          <Button
            className="mt-3 h-11 font-semibold"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await markShipped(order.id, note.trim() || undefined)
                notify(t("orders.seller.markedShipped"), t("orders.seller.markedShippedDetail"))
                await onChange()
              } catch (error) {
                notify(t("orders.updateFailed"), errorMessage(error), "error")
              } finally {
                setBusy(false)
              }
            }}
          >
            <Truck className="size-4" />
            {busy ? t("common.saving") : t("orders.seller.markShipped")}
          </Button>
        </Section>
      )
    case "shipped":
      return (
        <Section title={t("orders.seller.shippedTitle")}>
          <p className="text-sm leading-6 text-text-secondary">
            {t("orders.seller.shippedBefore")} <strong className="text-text">{money(order.sellerPayout)}</strong>
            {t("orders.seller.shippedAfter")}
            {settings && t("orders.seller.shippedAuto", { days: settings.autoReleaseDays })}.
          </p>
        </Section>
      )
    case "delivered":
      return (
        <Section title={t("orders.seller.deliveredTitle")}>
          <p className="text-sm leading-6 text-text-secondary">
            {t("orders.seller.deliveredBefore")} <strong className="text-text">{money(order.sellerPayout)}</strong>
            {t("orders.seller.deliveredAfter")}
          </p>
        </Section>
      )
    case "completed":
      return (
        <Section title={t("orders.seller.completedTitle")}>
          <p className="text-sm leading-6 text-text-secondary">
            {t("orders.seller.completedSent", { amount: money(order.sellerPayout) })}
            {order.paidOutAt
              ? t("orders.seller.completedOn", {
                  date: formatDate(order.paidOutAt, { year: "numeric", month: "numeric", day: "numeric" }),
                })
              : ""}
            {order.payoutReference ? t("orders.seller.completedRef", { ref: order.payoutReference }) : ""}
            {t("orders.seller.completedCongrats")}
          </p>
        </Section>
      )
    case "expired":
      return (
        <Section title={t("orders.seller.expiredTitle")}>
          <p className="text-sm leading-6 text-text-secondary">
            {t("orders.seller.expiredBody")}
          </p>
        </Section>
      )
    case "cancelled":
      return (
        <Section title={t("orders.cancelled.title")}>
          <p className="text-sm leading-6 text-text-secondary">{t("orders.cancelled.sellerBody")}</p>
        </Section>
      )
  }
}

// ── Shared pieces ────────────────────────────────────────────────────────────
// Labels are message keys; they're translated at render time.
const STEPS = [
  { key: "won", label: "orders.step.won" },
  { key: "paid", label: "orders.step.paid" },
  { key: "shipped", label: "orders.step.shipped" },
  { key: "delivered", label: "orders.step.delivered" },
  { key: "completed", label: "orders.step.completed" },
] as const satisfies ReadonlyArray<{ key: string; label: MessageKey }>

function Timeline({ order }: { order: Order }) {
  const { t, formatDate } = useI18n()
  if (order.status === "expired" || order.status === "cancelled") return null
  const reached = {
    won: true,
    paid: Boolean(order.paidAt),
    shipped: Boolean(order.shippedAt),
    delivered: Boolean(order.deliveredAt),
    completed: Boolean(order.paidOutAt),
  }
  const dates = {
    won: order.createdAt,
    paid: order.paidAt,
    shipped: order.shippedAt,
    delivered: order.deliveredAt,
    completed: order.paidOutAt,
  }
  return (
    <ol className="grid grid-cols-5 gap-1">
      {STEPS.map((step, index) => {
        const done = reached[step.key]
        const date = dates[step.key]
        return (
          <li key={step.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  done ? "bg-amber text-bg" : "border border-border text-text-muted"
                }`}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              {index < STEPS.length - 1 && (
                <span className={`h-px flex-1 ${reached[STEPS[index + 1].key] ? "bg-amber" : "bg-border"}`} />
              )}
            </div>
            <div>
              <p className={`text-xs font-semibold ${done ? "text-text" : "text-text-muted"}`}>{t(step.label)}</p>
              {date && done && (
                <p className="hidden text-[11px] text-text-muted sm:block">
                  {formatDate(date, { month: "short", day: "numeric" })}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Breakdown({ order, perspective }: { order: Order; perspective: "buyer" | "seller" | "admin" }) {
  const { t } = useI18n()
  const lines: Array<[MessageKey, number, string?]> =
    perspective === "seller"
      ? [
          ["orders.line.winningBid", order.hammerPrice],
          ["orders.line.tsiskariCommission", -order.sellerCommission],
          ["orders.line.youReceive", order.sellerPayout, "total"],
        ]
      : perspective === "buyer"
        ? [
            ["orders.line.winningBid", order.hammerPrice],
            ["orders.line.buyersPremium", order.buyerPremium],
            ["orders.line.totalToPay", order.totalDue, "total"],
          ]
        : [
            ["orders.line.winningBid", order.hammerPrice],
            ["orders.line.buyersPremium", order.buyerPremium],
            ["orders.line.buyerPays", order.totalDue, "total"],
            ["orders.line.sellerCommission", order.sellerCommission],
            ["orders.line.artistPayout", order.sellerPayout],
            ["orders.line.tsiskariEarns", order.buyerPremium + order.sellerCommission, "total"],
          ]
  return (
    <Card className="border border-border bg-surface p-5 ring-0">
      <p className="mb-3 font-display font-semibold text-text">{t("orders.summary")}</p>
      <dl className="flex flex-col gap-2 text-sm">
        {lines.map(([label, value, kind]) => (
          <div
            key={label}
            className={`flex justify-between gap-4 ${
              kind === "total" ? "mt-1 border-t border-border pt-3 font-semibold text-text" : "text-text-secondary"
            }`}
          >
            <dt>{t(label)}</dt>
            <dd className={`font-mono ${kind === "total" ? "text-amber" : ""}`}>
              {value < 0 ? `−${money(-value)}` : money(value)}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function Contacts({ contacts }: { contacts: OrderContact[] }) {
  const { t } = useI18n()
  return (
    <Section title={t("orders.contacts.title")}>
      <div className="grid gap-3 sm:grid-cols-2">
        {contacts.map((contact) => (
          <div key={contact.role} className="rounded-2xl border border-border bg-bg/60 p-4 text-sm">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-text-muted">
              {contact.role === "buyer" ? t("orders.contacts.buyer") : t("orders.contacts.artist")}
            </p>
            <p className="mt-1 font-display font-semibold text-text">{contact.name || "—"}</p>
            <a href={`mailto:${contact.email}`} className="mt-2 flex items-center gap-2 text-text-secondary hover:text-text">
              <Mail className="size-3.5" /> {contact.email}
            </a>
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="mt-1 flex items-center gap-2 text-text-secondary hover:text-text">
                <Phone className="size-3.5" /> {contact.phone}
              </a>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}

function CopyRow({
  label,
  value,
  display,
  mono,
  highlight,
}: {
  label: string
  value: string
  display?: string
  mono?: boolean
  highlight?: boolean
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span className={`truncate ${mono ? "font-mono" : ""} ${highlight ? "font-semibold text-amber" : "text-text"}`}>
          {display ?? value}
        </span>
        <button
          aria-label={t("orders.copyLabel", { label })}
          title={t("orders.copy")}
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-white/[.06] hover:text-text"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
        </button>
      </dd>
    </div>
  )
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <Card className="border border-border bg-surface p-5 ring-0 sm:p-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-[60vh] place-items-center px-6 text-center text-sm text-text-secondary">
      <div className="flex flex-col items-center">{children}</div>
    </main>
  )
}
