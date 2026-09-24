import { apiFetch } from "../../lib/api-client"
import type { Artwork, BidEntry } from "../../types"

export const getArtwork = (id: string, signal?: AbortSignal) =>
  apiFetch<Artwork>(`/artworks/${encodeURIComponent(id)}`, { signal })

export const getBidHistory = (id: string, signal?: AbortSignal) =>
  apiFetch<BidEntry[]>(`/artworks/${encodeURIComponent(id)}/bids`, { signal })

export const placeBid = (id: string, amount: number) =>
  apiFetch<{ artwork: Artwork; bid: BidEntry }>(
    `/artworks/${encodeURIComponent(id)}/bid`,
    { method: "POST", body: JSON.stringify({ amount }) },
  )

/** Other parts of the app (dashboard, nav) listen for this to refetch. */
export const BIDS_UPDATED_EVENT = "aurora:bids-updated"

type AuctionActionResult = { artwork: Artwork; orderId: string | null }

/** Buy instantly at the buy-now price (only before the first bid). */
export const buyNow = (id: string) =>
  apiFetch<AuctionActionResult>(`/artworks/${encodeURIComponent(id)}/buy-now`, { method: "POST" })

/** Artist: reserve not met → accept the top bid, reject it, or counter once. */
export const decideOnBid = (id: string, action: "accept" | "reject" | "counter", counter?: number) =>
  apiFetch<AuctionActionResult>(`/artworks/${encodeURIComponent(id)}/decision`, {
    method: "POST",
    body: JSON.stringify({ action, counter }),
  })

/** Top bidder: answer the artist's counter-offer. */
export const answerCounter = (id: string, accept: boolean) =>
  apiFetch<AuctionActionResult>(`/artworks/${encodeURIComponent(id)}/counter`, {
    method: "POST",
    body: JSON.stringify({ accept }),
  })
