export type AuctionStatus = "draft" | "scheduled" | "live" | "awaiting_seller" | "ended" | "cancelled"
export type AuctionFormat = "timed" | "live"

/** An auction as the artist sees it in their studio (Supabase `auctions` + `artworks`). */
export type ManagedAuction = {
  id: string
  artworkId: string
  title: string
  image: string
  category: string
  medium: string
  dimensions: string
  widthCm: number | null
  heightCm: number | null
  depthCm: number | null
  description: string
  openingBid: number
  currentBid: number
  bidIncrement: number
  bidCount: number
  status: AuctionStatus
  isLive: boolean
  endsAt: string
  timeLeftSecs: number
  format: AuctionFormat
  startsAt: string | null
  buyNowPrice: number | null
  hasReserve: boolean
  reserveMet: boolean
  sellerDecision: string | null
  decisionDeadline: string | null
}

export type AuctionData = {
  title: string
  category: string
  medium: string
  /** Label shown on the artwork page; built from the cm fields when they're set. */
  dimensions: string
  /** Size in cm; "" means not given. Width and height go together. */
  widthCm: number | ""
  heightCm: number | ""
  depthCm: number | ""
  description: string
  openingBid: number
  bidIncrement: number
  /** Local "YYYY-MM-DDTHH:mm" from the picker. */
  endsAt: string
  format: AuctionFormat
  /** Live auctions: local "YYYY-MM-DDTHH:mm" when bidding opens. */
  startsAt: string
  /** Optional; "" means none. */
  buyNowPrice: number | ""
  /** Optional hidden minimum; "" means none. */
  reservePrice: number | ""
  isLive: boolean
  image?: File
}

export type AuctionFormData = Omit<AuctionData, "image"> & {
  image?: FileList
}

export type StudioTab = "auctions" | "artworks" | "sales" | "about"
