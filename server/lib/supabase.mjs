// Thin Supabase REST client for the API server. Uses the publishable key plus
// the caller's JWT, so Row Level Security applies exactly as in the browser.
import "./env.mjs"
import { createRemoteJWKSet, jwtVerify } from "jose"
import { httpError } from "./demo-store.mjs"

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseEnabled = Boolean(url && key)

const jwks = url
  ? createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`))
  : null

async function rest(path, { token, method = "GET", body, headers } = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    // Postgres `raise exception` messages come back in `message`.
    const message = data?.message || `Supabase request failed (${response.status})`
    throw httpError(response.status >= 500 ? 502 : 422, message)
  }
  return data
}

// ── Auth ─────────────────────────────────────────────────────────────────────
const userCache = new Map() // token -> { user, expires }

/** Verifies the bearer token and loads the caller's profile (role, username). */
export async function authenticate(authorization) {
  if (!supabaseEnabled) return null
  const token = authorization?.replace(/^Bearer\s+/i, "")
  if (!token) return null
  const cached = userCache.get(token)
  if (cached && cached.expires > Date.now()) return cached.user

  let claims = null
  try {
    ;({ payload: claims } = await jwtVerify(token, jwks, {
      issuer: `${url}/auth/v1`,
      audience: process.env.SUPABASE_JWT_AUDIENCE || "authenticated",
    }))
  } catch {
    // Projects on legacy HS256 secrets have no JWKS: ask Supabase Auth instead.
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    }).catch(() => null)
    if (!response?.ok) return null
    const user = await response.json()
    claims = { sub: user.id, email: user.email }
  }

  const [[profile] = [], readiness] = await Promise.all([
    rest(`profiles?id=eq.${claims.sub}&select=role,username,avatar_url`, {
      token,
    }).catch(() => []),
    rest("rpc/account_readiness", { token, method: "POST", body: {} }).catch(
      () => null,
    ),
  ])
  const user = {
    id: claims.sub,
    email: claims.email ?? null,
    token,
    role: profile?.role ?? "collector",
    username:
      profile?.username || String(claims.email ?? "collector").split("@")[0],
    avatarUrl: profile?.avatar_url ?? null,
    // What the person still needs to add before bidding / selling.
    missingForBid: readiness?.bid ?? [],
    missingForSell: readiness?.sell ?? [],
  }
  // Short cache: readiness changes as soon as someone completes their profile.
  userCache.set(token, { user, expires: Date.now() + 10_000 })
  if (userCache.size > 5_000) userCache.clear()
  return user
}

/** Re-check readiness right now (bypasses the short auth cache). */
export async function freshReadiness(user) {
  if (!supabaseEnabled) return user
  const readiness = await rest("rpc/account_readiness", {
    token: user.token,
    method: "POST",
    body: {},
  }).catch(() => null)
  user.missingForBid = readiness?.bid ?? []
  user.missingForSell = readiness?.sell ?? []
  return user
}

// ── Orders ───────────────────────────────────────────────────────────────────
export async function getOrderForUser(orderId, token) {
  const [order] = await rest(`orders?id=eq.${orderId}&select=id,buyer_id,status,total_due`, { token })
  return order ?? null
}

let lastSettle = 0
/** Close ended auctions / expire unpaid orders. pg_cron does this every minute;
 *  this is a cheap fallback so nothing waits if cron isn't enabled. */
export function settleSoon(force = false) {
  if (!supabaseEnabled || (!force && Date.now() - lastSettle < 30_000)) return
  lastSettle = Date.now()
  void rest("rpc/settle_auctions", { method: "POST", body: {} })
    .then((changed) => {
      if (changed) invalidateCatalog()
    })
    .catch((error) => console.error("settle_auctions failed:", error.message))
}

// ── Catalogue ────────────────────────────────────────────────────────────────
const AUCTION_SELECT = [
  "id,status,format,opening_bid,current_bid,bid_increment,bid_count,starts_at,ends_at,seller_id,highest_bidder_id",
  "buy_now_price,has_reserve,reserve_met,decision_deadline,counter_offer,seller_decision,sold_via,event_id,lot_number",
  "artwork:artworks(title,image_url,category,medium,dimensions,year,description)",
  // display_name = the public name each person chose (username / full name / both).
  "seller:profiles!auctions_seller_id_fkey(username,display_name)",
  "highest:profiles!auctions_highest_bidder_id_fkey(username,display_name)",
].join(",")

function toArtwork(row) {
  const current = Number(row.current_bid)
  const increment = Number(row.bid_increment)
  const secsUntil = (iso) =>
    iso ? Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000)) : 0
  const timeLeftSecs = secsUntil(row.ends_at)
  const startsInSecs = secsUntil(row.starts_at)
  // The DB flips scheduled → live and live → ended/awaiting_seller in
  // settle_auctions(); derive the visible state from the clock so it never lags.
  const open = row.status === "live" || row.status === "scheduled"
  const status = open
    ? startsInSecs > 0
      ? "upcoming"
      : timeLeftSecs > 0
        ? "live"
        : "closing"
    : row.status === "awaiting_seller"
      ? "awaiting_seller"
      : "ended"
  const image = row.artwork?.image_url ?? ""
  return {
    id: row.id,
    title: row.artwork?.title ?? "Untitled",
    artist: row.seller?.display_name || row.seller?.username || "Artist",
    artistId: row.seller_id,
    sellerId: row.seller_id,
    image,
    thumbs: [image],
    category: row.artwork?.category ?? "",
    medium: row.artwork?.medium ?? "",
    dimensions: row.artwork?.dimensions ?? "",
    year: row.artwork?.year ?? null,
    currentBid: current,
    startingBid: Number(row.opening_bid),
    bidIncrement: increment,
    // First bid may equal the opening price; after that, add the increment.
    minNextBid: row.highest_bidder_id ? current + increment : current,
    bids: row.bid_count ?? 0,
    endsAt: row.ends_at,
    timeLeftSecs,
    isLive: status === "live",
    status,
    format: row.format ?? "timed",
    startsAt: row.starts_at ?? null,
    startsInSecs,
    buyNowPrice: row.buy_now_price == null ? null : Number(row.buy_now_price),
    hasReserve: Boolean(row.has_reserve),
    reserveMet: row.reserve_met !== false,
    decisionDeadline: row.decision_deadline ?? null,
    counterOffer: row.counter_offer == null ? null : Number(row.counter_offer),
    sellerDecision: row.seller_decision ?? null,
    soldVia: row.sold_via ?? null,
    eventId: row.event_id ?? null,
    lotNumber: row.lot_number ?? null,
    highestBidder: row.highest ? row.highest.display_name || row.highest.username : null,
    highestBidderId: row.highest_bidder_id,
    description: row.artwork?.description ?? "",
    tags: row.artwork?.category ? [`#${row.artwork.category.toLowerCase().replace(/\s+/g, "")}`] : [],
    source: "supabase",
  }
}

let catalogCache = { at: 0, data: null }

/** Published (non-draft) auctions + the artists who run them. Cached for 5s. */
export async function listSupabaseCatalog({ fresh = false } = {}) {
  if (!supabaseEnabled) return { artworks: [], artists: [] }
  // `fresh` (after someone's own change) still shares one fetch per second.
  const maxAge = fresh ? 1_000 : 5_000
  if (catalogCache.data && Date.now() - catalogCache.at < maxAge)
    return catalogCache.data
  const [rows, profiles] = await Promise.all([
    rest(
      `auctions?select=${AUCTION_SELECT}&status=in.(scheduled,live,awaiting_seller,ended)&order=ends_at.asc&limit=200`,
    ),
    rest(
      "profiles?role=eq.artist&select=id,username,display_name,bio,location,avatar_url,cover_url&limit=200",
    ),
  ])
  const artworks = rows.map(toArtwork)
  if (artworks.some((art) => art.status === "closing")) settleSoon(true)
  const artists = profiles.map((profile) => {
    const works = artworks.filter((art) => art.artistId === profile.id)
    return {
      id: profile.id,
      name: profile.display_name || profile.username || "Artist",
      verified: false,
      location: profile.location || "",
      avatar: profile.avatar_url || initialsAvatar(profile.username || "A"),
      banner: profile.cover_url || works[0]?.image || "",
      followers: 0,
      artworks: works.length,
      auctions: works.length,
      sold: works.filter((art) => !art.isLive && art.bids > 0).length,
      bio: profile.bio || "",
      tags: [],
    }
  })
  catalogCache = { at: Date.now(), data: { artworks, artists } }
  return catalogCache.data
}

function initialsAvatar(name) {
  const letters = name.slice(0, 2).toUpperCase().replace(/[^A-Z0-9]/g, "") || "A"
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#1f1f2a"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="30" font-weight="700" fill="#e8b84b">${letters}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export const invalidateCatalog = () => (catalogCache = { at: 0, data: null })

export async function getSupabaseArtwork(id, token, settled = false) {
  const [row] = await rest(`auctions?id=eq.${id}&select=${AUCTION_SELECT}`, {
    token,
  })
  if (!row) return null
  const artwork = toArtwork(row)
  // Time's up but not settled yet (live lots close 30s after the last bid):
  // settle now so the winner / seller decision shows immediately.
  if (artwork.status === "closing" && !settled) {
    await rest("rpc/settle_auctions", { method: "POST", body: {} }).catch(() => null)
    invalidateCatalog()
    return getSupabaseArtwork(id, token, true)
  }
  return artwork
}

// ── Bids ─────────────────────────────────────────────────────────────────────
export async function placeSupabaseBid(id, amount, user) {
  await rest("rpc/place_bid", {
    token: user.token,
    method: "POST",
    body: { p_auction_id: id, p_amount: amount },
  })
  invalidateCatalog()
  const artwork = await getSupabaseArtwork(id, user.token)
  const [latest] = await supabaseHistory(id, user.token)
  return { artwork, bid: latest }
}

export async function supabaseHistory(id, token) {
  const rows = await rest("rpc/auction_bid_history", {
    token,
    method: "POST",
    body: { p_auction_id: id },
  })
  return rows.map((row) => ({
    id: row.bid_id,
    bidder: row.bidder,
    avatar: row.avatar_url,
    amount: Number(row.amount),
    createdAt: row.created_at,
    isYou: Boolean(row.is_you),
  }))
}

/** Latest bid per auction for the caller (RLS: bidders read their own bids). */
export async function supabaseBidsFor(user) {
  const rows = await rest(
    `bids?bidder_id=eq.${user.id}&select=auction_id,amount,created_at&order=created_at.desc&limit=500`,
    { token: user.token },
  )
  const seen = new Set()
  return rows
    .filter((row) => !seen.has(row.auction_id) && seen.add(row.auction_id))
    .map((row) => ({
      artworkId: row.auction_id,
      amount: Number(row.amount),
      createdAt: row.created_at,
    }))
}

// ── Buy it now / reserve decisions (RPCs check who may call them) ────────────
async function auctionRpc(name, id, body, user) {
  const result = await rest(`rpc/${name}`, { token: user.token, method: "POST", body: { p_auction_id: id, ...body } })
  invalidateCatalog()
  const artwork = await getSupabaseArtwork(id, user.token)
  return { artwork, orderId: result ?? null }
}
export const buyNowSupabase = (id, user) => auctionRpc("buy_now", id, {}, user)
export const sellerRespondSupabase = (id, action, counter, user) =>
  auctionRpc("seller_respond", id, { p_action: action, p_counter: counter ?? null }, user)
export const buyerRespondSupabase = (id, accept, user) =>
  auctionRpc("buyer_respond_counter", id, { p_accept: Boolean(accept) }, user)
