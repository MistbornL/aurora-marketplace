// Bank of Georgia (BOG) card payments — iPay / "Payments API v1".
//
//   POST /api/orders/:id/card-pay   buyer → returns { url } to BOG's hosted card page
//   POST /api/orders/:id/card-sync  buyer came back from BOG → we ask BOG for the status
//   POST /api/payments/bog/callback BOG → us (RSA-signed). We verify the signature, then
//                                   ask BOG for the receipt (never trust the body alone)
//                                   and confirm the order through confirm_order_payment().
//   startBogReconciler()            every 2 minutes re-checks orders that are still unpaid.
//
// Secrets live only in the server env (never VITE_*):
//   BOG_CLIENT_ID, BOG_CLIENT_SECRET   – from the BOG business portal (sandbox first)
//   BOG_CALLBACK_PUBLIC_KEY            – PEM public key from BOG's docs, to verify callbacks
//   BOG_CALLBACK_URL                   – public URL of POST /api/payments/bog/callback
//   PUBLIC_SITE_URL                    – where buyers return (default https://tsiskariart.ge)
// Optional: BOG_API_BASE, BOG_OAUTH_URL (override for sandbox), BOG_CAPTURE=automatic|manual.
import "./env.mjs"
import { createVerify, randomUUID } from "node:crypto"
import { httpError } from "./demo-store.mjs"

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const clientId = process.env.BOG_CLIENT_ID || ""
const clientSecret = process.env.BOG_CLIENT_SECRET || ""
const publicKey = (process.env.BOG_CALLBACK_PUBLIC_KEY || "").replace(/\\n/g, "\n")
const callbackUrl = process.env.BOG_CALLBACK_URL || ""
const siteUrl = (process.env.PUBLIC_SITE_URL || "https://tsiskariart.ge").replace(/\/$/, "")
const apiBase = (process.env.BOG_API_BASE || "https://api.bog.ge/payments/v1").replace(/\/$/, "")
const oauthUrl =
  process.env.BOG_OAUTH_URL || "https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token"
const capture = process.env.BOG_CAPTURE === "manual" ? "manual" : "automatic"

export const bogConfigured = Boolean(clientId && clientSecret && callbackUrl && publicKey && supabaseUrl && serviceKey)

const serviceHeaders = () =>
  serviceKey.startsWith("sb_secret_")
    ? { apikey: serviceKey }
    : { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }

async function db(path, { method = "GET", body } = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...serviceHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) throw httpError(502, data?.message || `Database request failed (${response.status})`)
  return data
}

// ── BOG API ──────────────────────────────────────────────────────────────────
let token = { value: "", expires: 0 }

async function accessToken() {
  if (token.value && token.expires > Date.now() + 30_000) return token.value
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const response = await fetch(oauthUrl, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.access_token) {
    console.error("BOG token request failed:", response.status)
    throw httpError(502, "Card payments are temporarily unavailable")
  }
  token = { value: data.access_token, expires: Date.now() + Number(data.expires_in || 600) * 1000 }
  return token.value
}

async function bog(path, { method = "GET", body, headers } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    console.error(`BOG ${method} ${path} failed:`, response.status, JSON.stringify(data)?.slice(0, 300))
    throw httpError(502, "The bank could not process this request")
  }
  return data
}

// ── Signature (callbacks) ────────────────────────────────────────────────────
/** SHA256withRSA over the exact request bytes; signature is base64 in `Callback-Signature`. */
export function validCallbackSignature(rawBody, signature) {
  if (!signature || !publicKey) return false
  try {
    return createVerify("RSA-SHA256").update(rawBody).verify(publicKey, String(signature), "base64")
  } catch {
    return false
  }
}

// ── Orders ───────────────────────────────────────────────────────────────────
const ORDER_SELECT = "id,reference,buyer_id,status,total_due,bog_order_id,artwork:artworks(title)"

async function loadOrder(id) {
  const [order] = await db(`orders?id=eq.${id}&select=${ORDER_SELECT}`)
  return order ?? null
}

/** Buyer clicks "Pay by card": create a BOG order and return the hosted page URL. */
export async function startCardPayment(orderId, user, locale = "ka") {
  if (!bogConfigured) throw httpError(503, "Card payments are not available yet")
  const order = await loadOrder(orderId)
  if (!order || order.buyer_id !== user.id) throw httpError(404, "Order not found")
  if (!["awaiting_payment", "payment_submitted"].includes(order.status))
    throw httpError(409, "This order doesn’t need a payment")

  const amount = Number(order.total_due)
  const title = String(order.artwork?.title || "Artwork").slice(0, 120)
  const created = await bog("/ecommerce/orders", {
    method: "POST",
    headers: { "Idempotency-Key": randomUUID(), "Accept-Language": locale === "en" ? "en" : "ka" },
    body: {
      callback_url: callbackUrl,
      external_order_id: order.id,
      capture,
      purchase_units: {
        currency: "GEL",
        total_amount: amount,
        basket: [{ product_id: order.id, description: `TSISKARI ${order.reference} — ${title}`, quantity: 1, unit_price: amount }],
      },
      redirect_urls: {
        success: `${siteUrl}/orders/${order.id}?pay=success`,
        fail: `${siteUrl}/orders/${order.id}?pay=fail`,
      },
      ttl: 30,
    },
  })
  const redirect = created?._links?.redirect?.href
  if (!created?.id || !redirect) throw httpError(502, "The bank did not return a payment page")
  await db(`orders?id=eq.${order.id}`, { method: "PATCH", body: { bog_order_id: String(created.id) } })
  return { url: redirect }
}

/** Ask BOG what happened to a payment and confirm our order if it was completed. */
async function settleFromReceipt(bogOrderId, expectedOrderId) {
  const receipt = await bog(`/receipt/${encodeURIComponent(bogOrderId)}`)
  const state = receipt?.order_status?.key
  const orderId = receipt?.external_order_id
  if (!orderId || (expectedOrderId && orderId !== expectedOrderId)) {
    console.error("BOG receipt does not match order", bogOrderId)
    return { state: "mismatch" }
  }
  if (state !== "completed") return { state: state || "unknown" }

  const order = await loadOrder(orderId)
  if (!order) return { state: "no_order" }
  if (order.bog_order_id && order.bog_order_id !== String(bogOrderId)) {
    // A different (older/newer) BOG attempt for this order: accept it only if the money is real.
    console.warn("Order", orderId, "paid via BOG attempt", bogOrderId, "not", order.bog_order_id)
  }
  const paid = Number(
    receipt?.purchase_units?.transfer_amount ??
      receipt?.purchase_units?.request_amount ??
      receipt?.purchase_units?.total_amount,
  )
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/confirm_order_payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...serviceHeaders() },
    body: JSON.stringify({
      p_order_id: orderId,
      p_method: "card (BOG)",
      p_reference: String(bogOrderId).slice(0, 120),
      p_amount: Number.isFinite(paid) ? paid : Number(order.total_due),
    }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    console.error("confirm_order_payment failed:", data?.message)
    throw httpError(422, data?.message || "Could not confirm payment")
  }
  return { state: "completed", status: data?.status }
}

/** Buyer returned from BOG (success or fail page): check the real status now. */
export async function syncCardPayment(orderId, user) {
  if (!bogConfigured) throw httpError(503, "Card payments are not available yet")
  const order = await loadOrder(orderId)
  if (!order || order.buyer_id !== user.id) throw httpError(404, "Order not found")
  if (order.status === "paid" || !order.bog_order_id) return { status: order.status, state: order.bog_order_id ? "paid" : "none" }
  const result = await settleFromReceipt(order.bog_order_id, order.id)
  const fresh = await loadOrder(orderId)
  return { status: fresh?.status ?? order.status, state: result.state }
}

/** BOG → us. `rawBody` is the exact bytes received. */
export async function handleBogCallback(rawBody, signature) {
  if (!bogConfigured) throw httpError(503, "Card payments are not configured")
  if (!validCallbackSignature(rawBody, signature)) throw httpError(401, "Invalid signature")
  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    throw httpError(400, "Invalid JSON")
  }
  const body = event?.body ?? event
  const bogOrderId = body?.order_id ?? body?.id
  if (event?.event && event.event !== "order_payment") return { received: true, ignored: event.event }
  if (!bogOrderId) return { received: true, ignored: "no order id" }
  const result = await settleFromReceipt(bogOrderId, body?.external_order_id)
  return { received: true, state: result.state }
}

/** Safety net: callbacks can be lost, so re-check unpaid orders that have a BOG attempt. */
export function startBogReconciler() {
  if (!bogConfigured) return
  const tick = async () => {
    try {
      const rows = await db("orders?status=in.(awaiting_payment,payment_submitted)&bog_order_id=not.is.null&select=id,bog_order_id&limit=50")
      for (const row of rows ?? []) await settleFromReceipt(row.bog_order_id, row.id).catch((e) => console.error("reconcile", row.id, e.message))
    } catch (error) {
      console.error("BOG reconcile failed:", error.message)
    }
  }
  setInterval(tick, 120_000).unref()
}

/** Admin: refund a card payment (full unless an amount is given). */
export async function refundCardPayment(orderId, amount) {
  if (!bogConfigured) throw httpError(503, "Card payments are not available yet")
  const order = await loadOrder(orderId)
  if (!order?.bog_order_id) throw httpError(404, "This order was not paid by card")
  const body = amount ? { amount: Number(amount) } : {}
  const result = await bog(`/payment/refund/${encodeURIComponent(order.bog_order_id)}`, { method: "POST", body, headers: { "Idempotency-Key": randomUUID() } })
  return { requested: true, result }
}
