import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "../../lib/api-client"
import { requireSupabase } from "../../lib/supabase"
import { tr, type MessageKey } from "../../lib/i18n"

/**
 * Orders are created by the database when an auction ends (settle_auctions).
 * Every write goes through a security-definer RPC; the table itself is read-only.
 *   awaiting_payment → payment_submitted → paid → shipped → delivered → completed
 *   (side exits: expired — buyer didn’t pay in time; cancelled — by an admin)
 */
export type OrderStatus =
  | "awaiting_payment"
  | "payment_submitted"
  | "paid"
  | "shipped"
  | "delivered"
  | "completed"
  | "expired"
  | "cancelled"

export type Order = {
  id: string
  reference: string
  auctionId: string
  artworkId: string
  buyerId: string
  sellerId: string
  buyerName: string
  sellerName: string
  title: string
  image: string
  hammerPrice: number
  buyerPremium: number
  totalDue: number
  sellerCommission: number
  sellerPayout: number
  status: OrderStatus
  secondChance: boolean
  payBy: string
  paymentMethod: string | null
  paymentReference: string | null
  paymentSubmittedAt: string | null
  paidAt: string | null
  shippingNote: string | null
  shippedAt: string | null
  deliveredAt: string | null
  payoutReference: string | null
  paidOutAt: string | null
  createdAt: string
}

export type PlatformSettings = {
  sellerCommissionPct: number
  buyerPremiumPct: number
  paymentWindowHours: number
  autoReleaseDays: number
  maxPaymentStrikes: number
  liveBidSeconds: number
  liveOpeningSeconds: number
  sellerDecisionHours: number
  bankName: string
  bankAccountHolder: string
  bankIban: string
}

export type OrderContact = {
  role: "buyer" | "seller"
  name: string
  email: string
  phone: string | null
}

export const PAYMENTS_TEST_MODE = import.meta.env.VITE_PAYMENTS_TEST_MODE === "true"

/** Statuses where the order still needs someone to act. */
export const OPEN_STATUSES: OrderStatus[] = [
  "awaiting_payment",
  "payment_submitted",
  "paid",
  "shipped",
  "delivered",
]

const SELECT =
  "*, artwork:artworks(title, image_url), buyer:profiles!orders_buyer_id_fkey(username, display_name), seller:profiles!orders_seller_id_fkey(username, display_name)"

type Row = Record<string, unknown> & {
  artwork: { title: string; image_url: string } | null
  buyer: { username: string; display_name: string | null } | null
  seller: { username: string; display_name: string | null } | null
}

const num = (value: unknown) => Number(value ?? 0)
const str = (value: unknown) => (value == null ? null : String(value))

function toOrder(row: Row): Order {
  return {
    id: String(row.id),
    reference: String(row.reference),
    auctionId: String(row.auction_id),
    artworkId: String(row.artwork_id),
    buyerId: String(row.buyer_id),
    sellerId: String(row.seller_id),
    buyerName: row.buyer?.display_name || row.buyer?.username || tr("orders.fallback.collector"),
    sellerName: row.seller?.display_name || row.seller?.username || tr("orders.fallback.artist"),
    title: row.artwork?.title ?? tr("orders.fallback.untitled"),
    image: row.artwork?.image_url ?? "",
    hammerPrice: num(row.hammer_price),
    buyerPremium: num(row.buyer_premium),
    totalDue: num(row.total_due),
    sellerCommission: num(row.seller_commission),
    sellerPayout: num(row.seller_payout),
    status: row.status as OrderStatus,
    secondChance: Boolean(row.second_chance),
    payBy: String(row.pay_by),
    paymentMethod: str(row.payment_method),
    paymentReference: str(row.payment_reference),
    paymentSubmittedAt: str(row.payment_submitted_at),
    paidAt: str(row.paid_at),
    shippingNote: str(row.shipping_note),
    shippedAt: str(row.shipped_at),
    deliveredAt: str(row.delivered_at),
    payoutReference: str(row.payout_reference),
    paidOutAt: str(row.paid_out_at),
    createdAt: String(row.created_at),
  }
}

async function run<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

// ── Reads ────────────────────────────────────────────────────────────────────
export async function listOrders(filter: { buyerId?: string; sellerId?: string } = {}) {
  let query = requireSupabase().from("orders").select(SELECT).order("created_at", { ascending: false })
  if (filter.buyerId) query = query.eq("buyer_id", filter.buyerId)
  if (filter.sellerId) query = query.eq("seller_id", filter.sellerId)
  const rows = await run(query.limit(200))
  return (rows as unknown as Row[]).map(toOrder)
}

export async function getOrder(id: string) {
  const row = await run(requireSupabase().from("orders").select(SELECT).eq("id", id).maybeSingle())
  return row ? toOrder(row as unknown as Row) : null
}

export async function getOrderContacts(id: string) {
  return (await run(requireSupabase().rpc("order_contacts", { p_order_id: id }))) as OrderContact[]
}

export async function getSettings(): Promise<PlatformSettings> {
  const row = (await run(
    requireSupabase().from("platform_settings").select("*").eq("id", 1).single(),
  )) as Record<string, unknown>
  return {
    sellerCommissionPct: num(row.seller_commission_pct),
    buyerPremiumPct: num(row.buyer_premium_pct),
    paymentWindowHours: num(row.payment_window_hours),
    autoReleaseDays: num(row.auto_release_days),
    maxPaymentStrikes: num(row.max_payment_strikes),
    liveBidSeconds: num(row.live_bid_seconds) || 30,
    liveOpeningSeconds: num(row.live_opening_seconds) || 60,
    sellerDecisionHours: num(row.seller_decision_hours) || 12,
    bankName: String(row.bank_name ?? ""),
    bankAccountHolder: String(row.bank_account_holder ?? ""),
    bankIban: String(row.bank_iban ?? ""),
  }
}

// ── Actions (each RPC checks who may call it) ────────────────────────────────
const rpc = (name: string, args: Record<string, unknown>) =>
  run(requireSupabase().rpc(name, args))

export const submitPayment = (id: string, note?: string) =>
  rpc("submit_order_payment", { p_order_id: id, p_note: note ?? null })
export const markShipped = (id: string, note?: string) =>
  rpc("mark_order_shipped", { p_order_id: id, p_note: note ?? null })
export const confirmDelivered = (id: string) => rpc("confirm_order_delivered", { p_order_id: id })

// Admin
export const confirmPayment = (id: string, reference: string, amount: number) =>
  rpc("confirm_order_payment", {
    p_order_id: id,
    p_method: "bank_transfer",
    p_reference: reference || null,
    p_amount: amount,
  })
export const markPayoutSent = (id: string, reference?: string) =>
  rpc("mark_payout_sent", { p_order_id: id, p_reference: reference || null })
export const cancelOrder = (id: string) => rpc("cancel_order", { p_order_id: id })

export async function saveSettings(settings: PlatformSettings) {
  await run(
    requireSupabase()
      .from("platform_settings")
      .update({
        seller_commission_pct: settings.sellerCommissionPct,
        buyer_premium_pct: settings.buyerPremiumPct,
        payment_window_hours: settings.paymentWindowHours,
        auto_release_days: settings.autoReleaseDays,
        max_payment_strikes: settings.maxPaymentStrikes,
        live_bid_seconds: settings.liveBidSeconds,
        live_opening_seconds: settings.liveOpeningSeconds,
        seller_decision_hours: settings.sellerDecisionHours,
        bank_name: settings.bankName.trim(),
        bank_account_holder: settings.bankAccountHolder.trim(),
        bank_iban: settings.bankIban.replace(/\s+/g, "").toUpperCase(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1),
  )
}

/** Test mode: the API server signs a fake provider webhook for this order. */
export const simulateCardPayment = (id: string) =>
  apiFetch<unknown>(`/orders/${encodeURIComponent(id)}/test-pay`, { method: "POST" })

/** Settles ended auctions now (normally pg_cron does it every minute). */
export const settleNow = () => rpc("settle_auctions", {}).catch(() => 0)

// ── Hooks ────────────────────────────────────────────────────────────────────
export function useOrders(filter: { buyerId?: string; sellerId?: string; all?: boolean }) {
  const { buyerId, sellerId, all } = filter
  const enabled = Boolean(buyerId || sellerId || all)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) return
    try {
      await settleNow()
      setOrders(await listOrders({ buyerId, sellerId }))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("orders.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [enabled, buyerId, sellerId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { orders, loading, error, reload }
}

/** The signed-in user's active order for an artwork (RLS: only parties see it). */
export function useArtworkOrder(artworkId: string, userId: string | undefined, ended: boolean) {
  const [order, setOrder] = useState<Order | null>(null)
  useEffect(() => {
    if (!userId || !ended || !/^[0-9a-f-]{36}$/i.test(artworkId)) return
    let cancelled = false
    void (async () => {
      await settleNow()
      const rows = await run(
        requireSupabase()
          .from("orders")
          .select(SELECT)
          .eq("artwork_id", artworkId)
          .not("status", "in", "(expired,cancelled)")
          .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
          .limit(1),
      ).catch(() => [])
      const row = (rows as unknown as Row[])[0]
      if (!cancelled) setOrder(row ? toOrder(row) : null)
    })()
    return () => {
      cancelled = true
    }
  }, [artworkId, userId, ended])
  return order
}

// ── Formatting ───────────────────────────────────────────────────────────────
export const money = (value: number) =>
  `${value.toLocaleString("en-US", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}₾`

/** Message keys for status labels — translate with t() at render time. */
export const STATUS_LABEL_KEY: Record<OrderStatus, MessageKey> = {
  awaiting_payment: "orders.status.awaiting_payment",
  payment_submitted: "orders.status.payment_submitted",
  paid: "orders.status.paid",
  shipped: "orders.status.shipped",
  delivered: "orders.status.delivered",
  completed: "orders.status.completed",
  expired: "orders.status.expired",
  cancelled: "orders.status.cancelled",
}

export const STATUS_TONE: Record<OrderStatus, string> = {
  awaiting_payment: "bg-amber/15 text-amber",
  payment_submitted: "bg-sky-500/15 text-sky-300",
  paid: "bg-emerald-500/15 text-emerald-400",
  shipped: "bg-violet-500/15 text-violet-300",
  delivered: "bg-emerald-500/15 text-emerald-400",
  completed: "bg-white/[.08] text-text-secondary",
  expired: "bg-red-500/15 text-red-400",
  cancelled: "bg-red-500/15 text-red-400",
}

// ── Delivery details ─────────────────────────────────────────────────────────
export type Shipping = {
  method: "courier" | "pickup"
  recipient: string
  phone: string
  city: string
  address: string
  notes: string
}

/** Buyer always; seller only once the order is paid (RLS). */
export async function getShipping(orderId: string): Promise<Shipping | null> {
  const { data } = await requireSupabase()
    .from("order_shipping")
    .select("method, recipient, phone, city, address, notes")
    .eq("order_id", orderId)
    .maybeSingle()
  return (data as Shipping | null) ?? null
}

export const saveShipping = (orderId: string, value: Shipping) =>
  rpc("set_order_shipping", {
    p_order_id: orderId,
    p_method: value.method,
    p_recipient: value.recipient,
    p_phone: value.phone,
    p_city: value.city,
    p_address: value.address,
    p_notes: value.notes,
  })

// ── Problem reports ─────────────────────────────────────────────────────────
export type ReportReason = "not_received" | "not_as_described" | "damaged" | "payment" | "other"
export type OrderReport = {
  id: string
  orderId: string
  reporterId: string
  reason: ReportReason
  message: string
  status: "open" | "resolved"
  adminNote: string
  createdAt: string
  orderReference?: string
  orderTitle?: string
}

type ReportRow = {
  id: string
  order_id: string
  reporter_id: string
  reason: ReportReason
  message: string
  status: "open" | "resolved"
  admin_note: string
  created_at: string
  order?: { reference: string; artwork: { title: string } | null } | null
}

const toReport = (row: ReportRow): OrderReport => ({
  id: row.id,
  orderId: row.order_id,
  reporterId: row.reporter_id,
  reason: row.reason,
  message: row.message,
  status: row.status,
  adminNote: row.admin_note,
  createdAt: row.created_at,
  orderReference: row.order?.reference,
  orderTitle: row.order?.artwork?.title,
})

export async function listReports(orderId?: string) {
  let query = requireSupabase()
    .from("order_reports")
    .select("*, order:orders(reference, artwork:artworks(title))")
    .order("created_at", { ascending: false })
    .limit(100)
  if (orderId) query = query.eq("order_id", orderId)
  const rows = await run(query)
  return (rows as unknown as ReportRow[]).map(toReport)
}

export const reportProblem = (orderId: string, reason: ReportReason, message: string) =>
  rpc("report_order_problem", { p_order_id: orderId, p_reason: reason, p_message: message })

export const resolveReport = (reportId: string, note: string) =>
  rpc("resolve_order_report", { p_report_id: reportId, p_note: note })

/** Admin: the artist's bank account for the payout. */
export async function getPayoutAccount(orderId: string) {
  const rows = (await run(requireSupabase().rpc("order_payout_account", { p_order_id: orderId }))) as Array<{
    holder: string
    iban: string
    bank: string
  }>
  return rows[0] ?? null
}
