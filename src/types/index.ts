/** Domain types shared by the whole app. Mirrors the Node API responses. */

export type View =
  | "landing"
  | "artwork"
  | "live"
  | "artist"
  | "discover"
  | "profile"

export type Artwork = {
  /** Demo lots use "1".."n"; real lots use the Supabase auction uuid. */
  id: string
  title: string
  artist: string
  artistId: string
  /** Supabase user id of the seller (null for demo lots). */
  sellerId: string | null
  image: string
  thumbs: string[]
  category: string
  medium: string
  dimensions: string
  year: number | null
  currentBid: number
  startingBid: number
  minNextBid: number
  bidIncrement: number
  bids: number
  endsAt: string
  timeLeftSecs: number
  isLive: boolean
  /**
   * upcoming: scheduled, bidding not open yet · live: taking bids ·
   * closing: time's up, being settled · awaiting_seller: reserve not met,
   * the artist decides · ended: finished (sold or not).
   */
  status: AuctionPhase
  /** timed = fixed end; live = 30s "going once" timer that resets on each bid. */
  format: "timed" | "live"
  startsAt: string | null
  startsInSecs: number
  /** Instant purchase price (only until the first bid). */
  buyNowPrice: number | null
  hasReserve: boolean
  reserveMet: boolean
  decisionDeadline: string | null
  counterOffer: number | null
  sellerDecision:
    | "accepted"
    | "rejected"
    | "countered"
    | "counter_accepted"
    | "counter_declined"
    | "expired"
    | null
  soldVia: "bid" | "buy_now" | "counter" | null
  /** Set when the lot belongs to an auction event (e.g. "Thursday Night Live"). */
  eventId: string | null
  lotNumber: number | null
  highestBidder: string | null
  highestBidderId: string | null
  description: string
  tags: string[]
  source: "demo" | "supabase"
}

export type AuctionPhase = "upcoming" | "live" | "closing" | "awaiting_seller" | "ended"

export type Artist = {
  id: string
  name: string
  verified: boolean
  location: string
  avatar: string
  banner: string
  followers: number
  artworks: number
  auctions: number
  sold: number
  bio: string
  tags: string[]
}

export type Catalog = { artworks: Artwork[]; artists: Artist[] }

export type BidEntry = {
  id: string
  bidder: string
  avatar: string | null
  amount: number
  createdAt: string
  isYou: boolean
}

export type MyBid = { artworkId: string; amount: number; createdAt: string }

export type AccountRole = "collector" | "artist" | "admin"
