// AURORA API — catalogue, bidding and bid history.
//  - Demo lots ("1".."n") live in memory (lib/demo-store.mjs).
//  - Real auctions (uuid ids) live in Supabase; bids go through the
//    `place_bid` RPC with the caller's JWT so RLS + DB rules apply.
import "./lib/env.mjs"
import { createServer } from "node:http"
import { emailConfigured, startEmailWorker } from "./lib/email.mjs"
import { pushConfigured, startPushWorker } from "./lib/push.mjs"
import { demo, httpError } from "./lib/demo-store.mjs"
import {
  handleWebhook,
  paymentsConfigured,
  paymentsTestMode,
  simulateProviderPayment,
} from "./lib/payments.mjs"
import {
  authenticate,
  freshReadiness,
  buyerRespondSupabase,
  buyNowSupabase,
  getOrderForUser,
  sellerRespondSupabase,
  getSupabaseArtwork,
  isUuid,
  listSupabaseCatalog,
  settleSoon,
  placeSupabaseBid,
  supabaseBidsFor,
  supabaseEnabled,
  supabaseHistory,
} from "./lib/supabase.mjs"

const port = Number(process.env.API_PORT || 3001)
const showDemoLots = process.env.SHOW_DEMO_LOTS !== "false"
const allowedOrigins = new Set(
  (process.env.API_ALLOWED_ORIGINS || "http://localhost:8443")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
)

function send(res, status, body, origin) {
  const cors =
    origin && allowedOrigins.has(origin)
      ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
      : {}
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
    ...cors,
  })
  res.end(status === 204 ? undefined : JSON.stringify(body))
}

/** Exact request bytes (webhook signatures are computed over these). */
const readRaw = (request) =>
  new Promise((resolve, reject) => {
    let body = ""
    request.on("data", (chunk) => {
      body += chunk
      if (body.length > 20_000) reject(httpError(413, "Request body is too large"))
    })
    request.on("end", () => resolve(body))
  })

const readBody = (request) =>
  new Promise((resolve, reject) => {
    let body = ""
    request.on("data", (chunk) => {
      body += chunk
      if (body.length > 10_000) reject(httpError(413, "Request body is too large"))
    })
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(httpError(400, "Invalid JSON body"))
      }
    })
  })

async function requireUser(request) {
  const user = await authenticate(request.headers.authorization)
  if (!user) throw httpError(401, "Sign in to continue")
  return user
}

/** Routes an id to the right backend, rejecting anything malformed. */
function backendFor(id) {
  if (showDemoLots && demo.has(id)) return "demo"
  if (supabaseEnabled && isUuid(id)) return "supabase"
  throw httpError(404, "Artwork not found")
}

async function getArtwork(id, token) {
  const artwork =
    backendFor(id) === "demo" ? demo.getArtwork(id) : await getSupabaseArtwork(id, token)
  if (!artwork) throw httpError(404, "Artwork not found")
  return artwork
}

// ── Routes ───────────────────────────────────────────────────────────────────
const routes = [
  [
    "GET",
    /^\/api\/health$/,
    () => ({
      status: "ok",
      supabase: supabaseEnabled,
      payments: { configured: paymentsConfigured, testMode: paymentsTestMode },
      email: emailConfigured,
      push: pushConfigured,
      demoLots: showDemoLots,
    }),
  ],

  // Payment provider → us. Signature-checked; see lib/payments.mjs.
  [
    "POST",
    /^\/api\/payments\/webhook$/,
    async (request) =>
      handleWebhook(await readRaw(request), request.headers["x-aurora-signature"]),
  ],

  // Test mode only: behave like a provider for the buyer's own order.
  [
    "POST",
    /^\/api\/orders\/([\w-]+)\/test-pay$/,
    async (request, [id]) => {
      if (!paymentsTestMode) throw httpError(404, "Route not found")
      const user = await requireUser(request)
      if (!isUuid(id)) throw httpError(404, "Order not found")
      const order = await getOrderForUser(id, user.token) // RLS: only parties can read it
      if (!order || order.buyer_id !== user.id) throw httpError(404, "Order not found")
      return simulateProviderPayment(order)
    },
  ],

  [
    "GET",
    /^\/api\/catalog$/,
    async (request) => {
      settleSoon()
      const fresh = new URL(request.url, "http://x").searchParams.has("fresh")
      const live = await listSupabaseCatalog({ fresh }).catch((error) => {
        console.error("Supabase catalogue unavailable:", error.message)
        return { artworks: [], artists: [] }
      })
      return {
        // SHOW_DEMO_LOTS=false hides the built-in sample lots (do this for a real launch).
        artworks: [...live.artworks, ...(showDemoLots ? demo.listArtworks() : [])],
        artists: [...(showDemoLots ? demo.listArtists() : []), ...live.artists],
      }
    },
  ],

  [
    "GET",
    /^\/api\/me$/,
    async (request) => {
      const { id, email, role, username, avatarUrl, missingForBid, missingForSell } =
        await requireUser(request)
      return {
        user: { id, email, role, username, avatarUrl },
        readiness: { bid: missingForBid, sell: missingForSell },
      }
    },
  ],

  [
    "GET",
    /^\/api\/me\/bids$/,
    async (request) => {
      const user = await requireUser(request)
      const remote = await supabaseBidsFor(user).catch(() => [])
      return [...remote, ...demo.bidsFor(user.id)].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      )
    },
  ],

  [
    "GET",
    /^\/api\/artworks\/([\w-]+)$/,
    async (request, [id]) => {
      const user = await authenticate(request.headers.authorization)
      return getArtwork(id, user?.token)
    },
  ],

  [
    "GET",
    /^\/api\/artworks\/([\w-]+)\/bids$/,
    async (request, [id]) => {
      const user = await authenticate(request.headers.authorization)
      return backendFor(id) === "demo"
        ? demo.history(id, user?.id)
        : supabaseHistory(id, user?.token)
    },
  ],

  [
    "POST",
    /^\/api\/artworks\/([\w-]+)\/bid$/,
    async (request, [id]) => {
      const user = await requireUser(request)
      const { amount } = await readBody(request)
      const value = Number(amount)
      if (!Number.isFinite(value) || value <= 0)
        throw httpError(422, "Enter a valid bid amount")
      if (backendFor(id) === "demo")
        return demo.placeBid(id, value, await freshReadiness(user))
      // Self-bidding, increments and end time are enforced inside place_bid.
      return placeSupabaseBid(id, value, user)
    },
    201,
  ],

  // Buy it now (only before the first bid).
  [
    "POST",
    /^\/api\/artworks\/([\w-]+)\/buy-now$/,
    async (request, [id]) => {
      const user = await requireUser(request)
      if (backendFor(id) === "demo") throw httpError(422, "Demo lots can’t be bought instantly")
      return buyNowSupabase(id, user)
    },
  ],

  // Reserve not met: the artist accepts / rejects / counters…
  [
    "POST",
    /^\/api\/artworks\/([\w-]+)\/decision$/,
    async (request, [id]) => {
      const user = await requireUser(request)
      if (backendFor(id) === "demo") throw httpError(404, "Artwork not found")
      const { action, counter } = await readBody(request)
      if (!["accept", "reject", "counter"].includes(action)) throw httpError(422, "Unknown action")
      const value = counter == null ? null : Number(counter)
      if (action === "counter" && !(Number.isFinite(value) && value > 0))
        throw httpError(422, "Enter a valid counter-offer")
      return sellerRespondSupabase(id, action, value, user)
    },
  ],

  // …and the top bidder answers a counter-offer.
  [
    "POST",
    /^\/api\/artworks\/([\w-]+)\/counter$/,
    async (request, [id]) => {
      const user = await requireUser(request)
      if (backendFor(id) === "demo") throw httpError(404, "Artwork not found")
      const { accept } = await readBody(request)
      return buyerRespondSupabase(id, Boolean(accept), user)
    },
  ],
]

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`)
  const origin = request.headers.origin
  if (request.method === "OPTIONS") return send(response, 204, null, origin)

  for (const [method, pattern, handler, status = 200] of routes) {
    const match = url.pathname.match(pattern)
    if (method !== request.method || !match) continue
    try {
      const body = await handler(request, match.slice(1))
      return send(response, status, body, origin)
    } catch (error) {
      const code = error.status ?? 500
      if (code >= 500) console.error(error)
      return send(
        response,
        code,
        { error: code >= 500 ? "Something went wrong" : error.message },
        origin,
      )
    }
  }
  send(response, 404, { error: "Route not found" }, origin)
})

startEmailWorker()
startPushWorker()

server.listen(port, () =>
  console.log(
    `AURORA API on http://localhost:${port} (Supabase ${supabaseEnabled ? "on" : "off — demo lots only"})`,
  ),
)
