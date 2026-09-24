// Payment confirmation — provider-agnostic.
//
// A real provider (BOG / TBC-Flitt / …) calls POST /api/payments/webhook after a
// successful card payment. We verify the HMAC signature with a shared secret,
// then mark the order paid through the database function confirm_order_payment()
// using the service-role key (never exposed to browsers). The DB checks the
// amount matches and ignores duplicate deliveries.
//
// PAYMENTS_TEST_MODE=true adds POST /api/orders/:id/test-pay, which builds and
// signs the same webhook payload a provider would send — so the automatic path
// can be exercised end-to-end before a provider exists.
import "./env.mjs"
import { createHmac, timingSafeEqual } from "node:crypto"
import { httpError } from "./demo-store.mjs"

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const webhookSecret = process.env.PAYMENTS_WEBHOOK_SECRET || ""
export const paymentsTestMode = process.env.PAYMENTS_TEST_MODE === "true"
export const paymentsConfigured = Boolean(url && serviceKey && webhookSecret)

export function sign(rawBody) {
  return createHmac("sha256", webhookSecret).update(rawBody).digest("hex")
}

function validSignature(rawBody, signature) {
  if (!signature || !webhookSecret) return false
  const expected = Buffer.from(sign(rawBody), "hex")
  const given = Buffer.from(String(signature), "hex")
  return expected.length === given.length && timingSafeEqual(expected, given)
}

function serviceHeaders() {
  // New-style secret keys (sb_secret_…) go in `apikey` only; legacy
  // service_role JWTs also work as a Bearer token.
  return serviceKey.startsWith("sb_secret_")
    ? { apikey: serviceKey }
    : { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
}

/** Handle a provider webhook. `rawBody` must be the exact bytes received. */
export async function handleWebhook(rawBody, signature) {
  if (!paymentsConfigured) throw httpError(503, "Payments are not configured")
  if (!validSignature(rawBody, signature)) throw httpError(401, "Invalid signature")
  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    throw httpError(400, "Invalid JSON")
  }
  if (event.status !== "paid") return { received: true, ignored: event.status }
  const response = await fetch(`${url}/rest/v1/rpc/confirm_order_payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...serviceHeaders() },
    body: JSON.stringify({
      p_order_id: event.orderId,
      p_method: String(event.method || "card").slice(0, 40),
      p_reference: String(event.reference || "").slice(0, 120),
      p_amount: Number(event.amount),
    }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw httpError(422, data?.message || "Could not confirm payment")
  return { received: true, order: { id: data.id, status: data.status } }
}

/** Test mode: act like a provider for the buyer's own order. */
export async function simulateProviderPayment(order) {
  if (!paymentsTestMode) throw httpError(404, "Route not found")
  const rawBody = JSON.stringify({
    orderId: order.id,
    status: "paid",
    amount: Number(order.total_due),
    method: "card (test)",
    reference: `TEST-${Date.now()}`,
  })
  return handleWebhook(rawBody, sign(rawBody))
}
