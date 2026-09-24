import { tr } from "../../lib/i18n"
import { requireSupabase } from "../../lib/supabase"
import type { AuctionData, AuctionStatus, ManagedAuction } from "./types"

const SELECT =
  "id, status, format, opening_bid, current_bid, bid_increment, bid_count, starts_at, ends_at, buy_now_price, has_reserve, reserve_met, seller_decision, decision_deadline, artwork:artworks(id, title, image_url, category, medium, dimensions, description)"

type Row = {
  id: string
  status: AuctionStatus
  opening_bid: number | string
  current_bid: number | string
  bid_increment: number | string
  bid_count: number
  ends_at: string
  format: "timed" | "live"
  starts_at: string | null
  buy_now_price: number | string | null
  has_reserve: boolean
  reserve_met: boolean
  seller_decision: string | null
  decision_deadline: string | null
  artwork: {
    id: string
    title: string
    image_url: string
    category: string
    medium: string
    dimensions: string
    description: string
  } | null
}

function toManaged(row: Row): ManagedAuction {
  const secs = Math.max(
    0,
    Math.round((new Date(row.ends_at).getTime() - Date.now()) / 1000),
  )
  return {
    id: row.id,
    artworkId: row.artwork?.id ?? "",
    title: row.artwork?.title ?? tr("studio.untitled"),
    image: row.artwork?.image_url ?? "",
    category: row.artwork?.category ?? "",
    medium: row.artwork?.medium ?? "",
    dimensions: row.artwork?.dimensions ?? "",
    description: row.artwork?.description ?? "",
    openingBid: Number(row.opening_bid),
    currentBid: Number(row.current_bid),
    bidIncrement: Number(row.bid_increment),
    bidCount: row.bid_count ?? 0,
    status: row.status,
    isLive:
      (row.status === "live" || row.status === "scheduled") &&
      secs > 0 &&
      (!row.starts_at || new Date(row.starts_at).getTime() <= Date.now()),
    endsAt: row.ends_at,
    timeLeftSecs: secs,
    format: row.format ?? "timed",
    startsAt: row.starts_at,
    buyNowPrice: row.buy_now_price == null ? null : Number(row.buy_now_price),
    hasReserve: Boolean(row.has_reserve),
    reserveMet: row.reserve_met !== false,
    sellerDecision: row.seller_decision,
    decisionDeadline: row.decision_deadline,
  }
}

export async function listMyAuctions(userId: string) {
  const db = requireSupabase()
  const { data, error } = await db
    .from("auctions")
    .select(SELECT)
    .eq("seller_id", userId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data as unknown as Row[]).map(toManaged)
}

const artworkFields = (values: AuctionData) => ({
  title: values.title.trim(),
  category: values.category,
  medium: values.medium.trim(),
  dimensions: values.dimensions.trim(),
  description: values.description.trim(),
})

const optionalPrice = (value: number | "") => (value === "" || !(Number(value) > 0) ? null : Number(value))

const auctionFields = (values: AuctionData) => {
  const live = values.format === "live"
  // Picker gives local time; store absolute timestamps.
  const startsAt = live ? new Date(values.startsAt) : null
  return {
    // The DB turns "live" into "scheduled" while starts_at is in the future.
    status: (values.isLive ? "live" : "draft") as AuctionStatus,
    format: values.format,
    opening_bid: Number(values.openingBid),
    bid_increment: Number(values.bidIncrement),
    buy_now_price: optionalPrice(values.buyNowPrice),
    starts_at: startsAt ? startsAt.toISOString() : null,
    // Live lots: the DB derives the real end (start + opening window, then +30s per bid).
    ends_at: startsAt
      ? new Date(startsAt.getTime() + 3_600_000).toISOString()
      : new Date(values.endsAt).toISOString(),
  }
}

/** Reserve prices live in a private table; only this RPC can set them. */
async function saveReserve(auctionId: string, values: AuctionData) {
  const { error } = await requireSupabase().rpc("set_auction_reserve", {
    p_auction_id: auctionId,
    p_reserve: optionalPrice(values.reservePrice),
  })
  if (error) throw new Error(error.message)
}

export async function getReserve(auctionId: string) {
  const { data } = await requireSupabase().rpc("get_auction_reserve", { p_auction_id: auctionId })
  return data == null ? null : Number(data)
}

export async function createAuction(
  userId: string,
  values: AuctionData,
  imageUrl: string,
) {
  const db = requireSupabase()
  const { data: artwork, error: artworkError } = await db
    .from("artworks")
    .insert({ artist_id: userId, image_url: imageUrl, ...artworkFields(values) })
    .select("id")
    .single()
  if (artworkError) throw new Error(artworkError.message)

  const opening = Number(values.openingBid)
  const { data, error } = await db
    .from("auctions")
    .insert({
      artwork_id: artwork.id,
      seller_id: userId,
      current_bid: opening, // the DB trigger enforces this anyway
      ...auctionFields(values),
    })
    .select(SELECT)
    .single()
  if (error) {
    // Don't leave an orphan artwork behind.
    await db.from("artworks").delete().eq("id", artwork.id)
    throw new Error(error.message)
  }
  const created = data as unknown as Row
  if (optionalPrice(values.reservePrice) != null) {
    await saveReserve(created.id, values)
    return toManaged({ ...created, has_reserve: true, reserve_met: false })
  }
  return toManaged(created)
}

export async function updateAuction(
  auction: ManagedAuction,
  values: AuctionData,
  imageUrl?: string,
) {
  const db = requireSupabase()
  const { error: artworkError } = await db
    .from("artworks")
    .update({
      ...artworkFields(values),
      ...(imageUrl ? { image_url: imageUrl } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", auction.artworkId)
  if (artworkError) throw new Error(artworkError.message)

  // Once bids exist, pricing, format and timing are locked by the DB — only send details.
  const fields =
    auction.bidCount > 0
      ? { status: auctionFields(values).status }
      : auctionFields(values)
  const { data, error } = await db
    .from("auctions")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", auction.id)
    .select(SELECT)
    .single()
  if (error) throw new Error(error.message)
  const updated = data as unknown as Row
  if (auction.bidCount === 0) {
    await saveReserve(updated.id, values)
    const has = optionalPrice(values.reservePrice) != null
    return toManaged({ ...updated, has_reserve: has, reserve_met: !has })
  }
  return toManaged(updated)
}

export async function deleteAuction(auction: ManagedAuction) {
  if (auction.bidCount > 0)
    throw new Error(tr("studio.error.hasBids"))
  const db = requireSupabase()
  // Deleting the artwork cascades to its auction.
  const { data, error } = await db
    .from("artworks")
    .delete()
    .eq("id", auction.artworkId)
    .select("id")
  if (error) throw new Error(error.message)
  if (!data?.length)
    throw new Error(tr("studio.error.nothingDeleted"))
}
