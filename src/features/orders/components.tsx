import { Clock } from "lucide-react"
import { formatLeft, useCountdown } from "../../lib/clock"
import { useI18n } from "../../lib/i18n"
import { money, STATUS_LABEL_KEY, STATUS_TONE, type Order, type OrderStatus } from "./api"

export function StatusPill({ status }: { status: OrderStatus }) {
  const { t } = useI18n()
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[status]}`}
    >
      {t(STATUS_LABEL_KEY[status])}
    </span>
  )
}

const secsUntil = (iso: string) =>
  Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000))

/** Live "time left to pay" — keyed by deadline so it resets if the order changes. */
export function PayCountdown({ payBy, compact }: { payBy: string; compact?: boolean }) {
  return <Countdown key={payBy} secs={secsUntil(payBy)} compact={compact} />
}

function Countdown({ secs, compact }: { secs: number; compact?: boolean }) {
  const { t } = useI18n()
  const left = useCountdown(secs)
  const urgent = left.secs < 3 * 3600
  if (compact)
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono text-xs ${urgent ? "text-red-400" : "text-amber"}`}
      >
        <Clock className="size-3" />
        {left.secs > 0 ? formatLeft(left.secs) : t("orders.timesUp")}
      </span>
    )
  return (
    <span className={`font-mono text-3xl font-bold tabular-nums ${urgent ? "text-red-400" : "text-amber"}`}>
      {left.secs > 0 ? formatLeft(left.secs) : "00:00:00"}
    </span>
  )
}

/** One compact line in a list of orders (dashboards, admin). */
export function OrderRow({
  order,
  perspective,
  onOpen,
  action,
  bare,
}: {
  order: Order
  perspective: "buyer" | "seller" | "admin"
  onOpen: () => void
  action?: React.ReactNode
  /** No bottom border (when the parent draws it). */
  bare?: boolean
}) {
  const { t } = useI18n()
  const amount =
    perspective === "seller" ? order.sellerPayout : order.totalDue
  const amountLabel =
    perspective === "seller"
      ? t("orders.row.yourPayout")
      : perspective === "buyer"
        ? t("orders.row.total")
        : t("orders.row.buyerPays")
  const who =
    perspective === "buyer"
      ? t("orders.row.by", { name: order.sellerName })
      : perspective === "seller"
        ? t("orders.row.to", { name: order.buyerName })
        : `${order.buyerName} → ${order.sellerName}`
  return (
    <div
      className={`flex flex-wrap items-center gap-4 p-4 hover:bg-white/[.025] ${bare ? "" : "border-b border-border last:border-b-0"}`}
    >
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-4 text-left">
        {order.image ? (
          <img src={order.image} alt="" loading="lazy" className="size-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="size-14 shrink-0 rounded-xl bg-surface-2" />
        )}
        <div className="min-w-0">
          <p className="truncate font-display font-semibold text-text">{order.title}</p>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            #{order.reference} · {who}
          </p>
          {order.status === "awaiting_payment" && perspective !== "seller" && (
            <div className="mt-1">
              <PayCountdown payBy={order.payBy} compact />
            </div>
          )}
        </div>
      </button>
      <div className="text-right">
        <p className="text-[10px] uppercase tracking-[.08em] text-text-muted">{amountLabel}</p>
        <p className="font-mono font-bold text-text">{money(amount)}</p>
      </div>
      <StatusPill status={order.status} />
      {action}
    </div>
  )
}
