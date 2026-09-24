// In-memory store for the demo lots shipped with the app (ids "1".."n").
// Real auctions created by artists live in Supabase (see ./supabase.mjs).
import { ARTISTS, ARTWORKS, DEMO_BIDDERS } from "../data/seed.mjs"

const bootTime = Date.now()
const MAX_HISTORY = 200

/** artworkId -> bids, newest first */
const histories = new Map()

const artworks = ARTWORKS.map((seed) => {
  const bidIncrement = seed.minNextBid - seed.currentBid
  const endsAt = new Date(bootTime + seed.timeLeftSecs * 1000).toISOString()
  const artwork = {
    ...seed,
    id: String(seed.id),
    artistId: String(seed.artistId),
    sellerId: null,
    bidIncrement,
    endsAt,
    highestBidderId: null,
    source: "demo",
  }
  histories.set(artwork.id, seedHistory(artwork))
  return artwork
})

const artists = ARTISTS.map((artist) => ({ ...artist, id: String(artist.id) }))

function seedHistory(artwork) {
  const count = Math.min(artwork.bids, 6)
  const others = DEMO_BIDDERS.filter((b) => b.name !== artwork.highestBidder)
  return Array.from({ length: count }, (_, i) => {
    const bidder =
      i === 0
        ? (DEMO_BIDDERS.find((b) => b.name === artwork.highestBidder) ?? {
            name: artwork.highestBidder,
            avatar: null,
          })
        : others[(i - 1) % others.length]
    return {
      id: `demo-${artwork.id}-${i}`,
      bidderId: null,
      bidder: bidder.name,
      avatar: bidder.avatar,
      amount: Math.max(
        artwork.startingBid,
        artwork.currentBid - i * artwork.bidIncrement,
      ),
      createdAt: new Date(bootTime - (2 + i * 7) * 60_000).toISOString(),
    }
  })
}

/** Recompute time-dependent fields at read time. */
function present(artwork) {
  const timeLeftSecs = Math.max(
    0,
    Math.round((new Date(artwork.endsAt).getTime() - Date.now()) / 1000),
  )
  const isLive = artwork.isLive && timeLeftSecs > 0
  return {
    ...artwork,
    timeLeftSecs,
    isLive,
    // Demo lots are always timed auctions without reserve / buy-now.
    format: "timed",
    status: isLive ? "live" : "ended",
    startsAt: null,
    startsInSecs: 0,
    buyNowPrice: null,
    hasReserve: false,
    reserveMet: true,
    decisionDeadline: null,
    counterOffer: null,
    sellerDecision: null,
    soldVia: null,
    eventId: null,
    lotNumber: null,
  }
}

export const demo = {
  has: (id) => histories.has(String(id)),
  listArtworks: () => artworks.map(present),
  listArtists: () => artists,
  getArtwork(id) {
    const artwork = artworks.find((item) => item.id === String(id))
    return artwork ? present(artwork) : null
  },
  history(id, viewerId) {
    return (histories.get(String(id)) ?? []).slice(0, 50).map((bid) => ({
      id: bid.id,
      bidder: bid.bidder,
      avatar: bid.avatar,
      amount: bid.amount,
      createdAt: bid.createdAt,
      isYou: Boolean(viewerId && bid.bidderId === viewerId),
    }))
  },
  /** Latest bid per artwork for one user. */
  bidsFor(userId) {
    const result = []
    for (const [artworkId, bids] of histories) {
      const mine = bids.find((bid) => bid.bidderId === userId)
      if (mine)
        result.push({ artworkId, amount: mine.amount, createdAt: mine.createdAt })
    }
    return result
  },
  placeBid(id, amount, user) {
    const artwork = artworks.find((item) => item.id === String(id))
    if (!artwork) throw httpError(404, "Artwork not found")
    const live = present(artwork)
    if (!live.isLive) throw httpError(422, "This auction has ended")
    if (user.missingForBid?.length)
      throw httpError(
        422,
        "Complete your bidder profile (name and phone) to place bids",
      )
    if (artwork.sellerId && artwork.sellerId === user.id)
      throw httpError(403, "You can’t bid on your own auction")
    if (artwork.highestBidderId === user.id)
      throw httpError(422, "You’re already the highest bidder")
    if (!Number.isFinite(amount) || amount < artwork.minNextBid)
      throw httpError(422, `Bid must be at least ${artwork.minNextBid}₾`)
    if ((amount - artwork.currentBid) % artwork.bidIncrement !== 0)
      throw httpError(
        422,
        `Bids must increase in ${artwork.bidIncrement}₾ steps`,
      )

    artwork.currentBid = amount
    artwork.minNextBid = amount + artwork.bidIncrement
    artwork.bids += 1
    artwork.highestBidder = user.username
    artwork.highestBidderId = user.id

    const bid = {
      id: `bid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      bidderId: user.id,
      bidder: user.username,
      avatar: user.avatarUrl,
      amount,
      createdAt: new Date().toISOString(),
    }
    const history = histories.get(artwork.id)
    history.unshift(bid)
    history.length = Math.min(history.length, MAX_HISTORY)
    return {
      artwork: present(artwork),
      bid: { ...bid, bidderId: undefined, isYou: true },
    }
  },
}

export function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}
