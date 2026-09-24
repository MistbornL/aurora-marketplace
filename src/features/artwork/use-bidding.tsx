import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { errorMessage, notify } from "../../lib/notify"
import { tr } from "../../lib/i18n"
import type { Artwork, BidEntry } from "../../types"
import { AuthDialog } from "../auth/AuthDialog"
import { useAuth } from "../auth/auth-context"
import { useCatalog } from "../catalog/catalog-context"
import { CompleteProfileDialog } from "../profile/CompleteProfileDialog"
import { BIDS_UPDATED_EVENT, buyNow, placeBid } from "./api"
import type { BidState } from "./components/BidPanel"

/**
 * Everything needed to bid on one artwork — shared by the artwork page and
 * live rooms: who-can-bid state, sign-in / complete-profile gates, placing the
 * bid or buying instantly, and the dialogs those gates need (render `dialogs`).
 */
export function useBidding({
  art,
  history,
  secsLeft,
  startsIn = 0,
  applyBid,
  replace,
  onPlaced,
}: {
  art: Artwork
  history: BidEntry[]
  secsLeft: number
  /** Seconds until a scheduled lot opens (0 once it has started). */
  startsIn?: number
  applyBid: (artwork: Artwork, bid: BidEntry) => void
  replace?: (artwork: Artwork) => void
  onPlaced?: (bid: BidEntry) => void
}) {
  const { user, readiness } = useAuth()
  const { refresh } = useCatalog()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [justPlaced, setJustPlaced] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [pending, setPending] = useState<{ kind: "bid"; amount: number } | { kind: "buy" } | null>(null)

  const upcoming = art.status === "upcoming" && startsIn > 0
  // A scheduled lot opens on the client clock even before the next refresh.
  const isLive =
    (art.status === "live" || (art.status === "upcoming" && startsIn <= 0)) && secsLeft > 0
  const youLead = Boolean(user && art.highestBidderId === user.id)
  const youBid = history.some((bid) => bid.isYou)
  const state: BidState = upcoming
    ? !user
      ? "signed-out"
      : art.sellerId === user.id
        ? "own-auction"
        : "upcoming"
    : !isLive
      ? art.status === "awaiting_seller"
        ? "awaiting"
        : "ended"
      : !user
        ? "signed-out"
        : art.sellerId === user.id
          ? "own-auction"
          : youLead
            ? "leading"
            : youBid
              ? "outbid"
              : "open"

  /** Buy-now is offered until the first bid, before and during the auction. */
  const canBuyNow =
    art.buyNowPrice != null && art.bids === 0 && (upcoming || isLive) && art.sellerId !== user?.id

  async function placeNow(amount: number) {
    if (submitting) return
    setSubmitting(true)
    try {
      const result = await placeBid(art.id, amount)
      applyBid(result.artwork, result.bid) // shows instantly in history
      onPlaced?.(result.bid)
      setJustPlaced(true)
      setTimeout(() => setJustPlaced(false), 4000)
      window.dispatchEvent(new Event(BIDS_UPDATED_EVENT))
      const won = art.buyNowPrice != null && amount === art.buyNowPrice
      notify(
        won ? tr("artwork.toast.won") : tr("artwork.toast.confirmed"),
        won
          ? tr("artwork.toast.wonText", { amount, title: art.title })
          : tr("artwork.toast.confirmedText", { amount, title: art.title }),
      )
      void refresh({ silent: true })
    } catch (error) {
      notify(tr("artwork.toast.notPlaced"), errorMessage(error), "error")
    } finally {
      setSubmitting(false)
    }
  }

  async function buyNowNow() {
    if (submitting) return
    setSubmitting(true)
    try {
      const result = await buyNow(art.id)
      replace?.(result.artwork)
      window.dispatchEvent(new Event(BIDS_UPDATED_EVENT))
      notify(tr("artwork.toast.bought"), tr("artwork.toast.boughtText", { title: art.title }))
      void refresh({ silent: true })
      if (result.orderId) navigate(`/orders/${result.orderId}`)
    } catch (error) {
      notify(tr("artwork.toast.buyFailed"), errorMessage(error), "error")
    } finally {
      setSubmitting(false)
    }
  }

  function handleBid(amount: number) {
    if (!user) return setAuthOpen(true)
    // First bid ever? Ask for name + phone once, then continue with this bid.
    if (readiness.bid.length) return setPending({ kind: "bid", amount })
    void placeNow(amount)
  }

  function handleBuyNow() {
    if (!user) return setAuthOpen(true)
    if (readiness.bid.length) return setPending({ kind: "buy" })
    void buyNowNow()
  }

  const dialogs = (
    <>
      {authOpen && <AuthDialog initialMode="sign-up" onClose={() => setAuthOpen(false)} />}
      {pending !== null && (
        <CompleteProfileDialog
          purpose="bid"
          onClose={() => setPending(null)}
          onDone={() => {
            const next = pending
            setPending(null)
            if (next.kind === "bid") void placeNow(next.amount)
            else void buyNowNow()
          }}
        />
      )}
    </>
  )

  return {
    state,
    isLive,
    upcoming,
    canBuyNow,
    submitting,
    justPlaced,
    handleBid,
    handleBuyNow,
    openSignIn: () => setAuthOpen(true),
    dialogs,
  }
}
