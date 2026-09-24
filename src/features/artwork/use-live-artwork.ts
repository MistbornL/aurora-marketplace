import { useCallback, useEffect, useState } from "react"
import type { Artwork, BidEntry } from "../../types"
import { getArtwork, getBidHistory } from "./api"

const POLL_MS = 10_000
/** Live-format lots close 30s after the last bid — keep them near real time. */
const LIVE_POLL_MS = 2_000

/**
 * Keeps one artwork + its bid history fresh: loads history on mount, then polls
 * every 10s while the tab is visible so other people's bids show up.
 * `applyBid` lets the page insert your own bid instantly after a successful POST.
 */
export function useLiveArtwork(initial: Artwork) {
  const [artwork, setArtwork] = useState(initial)
  const [history, setHistory] = useState<BidEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const [fresh, bids] = await Promise.all([
        getArtwork(initial.id, signal),
        getBidHistory(initial.id, signal),
      ])
      setArtwork(fresh)
      setHistory(bids)
    },
    [initial.id],
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
      .catch(() => undefined)
      // A cancelled request must not flip "loading" off with an empty list.
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false)
      })
    return () => controller.abort()
  }, [load])

  const fast =
    artwork.format === "live" &&
    (artwork.status === "live" ||
      artwork.status === "closing" ||
      (artwork.status === "upcoming" && artwork.startsInSecs < 120))
  useEffect(() => {
    const controller = new AbortController()
    const id = setInterval(() => {
      if (document.visibilityState === "visible")
        void load(controller.signal).catch(() => undefined)
    }, fast ? LIVE_POLL_MS : POLL_MS)
    return () => {
      controller.abort()
      clearInterval(id)
    }
  }, [load, fast])

  const applyBid = useCallback((next: Artwork, bid: BidEntry) => {
    setArtwork(next)
    setHistory((items) => [bid, ...items.filter((item) => item.id !== bid.id)])
  }, [])

  /** Replace the artwork (e.g. after buy-now or a reserve decision). */
  const replace = useCallback((next: Artwork) => setArtwork(next), [])

  /** Refetch now (e.g. someone in the live room just bid). */
  const reload = useCallback(() => {
    void load().catch(() => undefined)
  }, [load])

  return { artwork, history, historyLoading, applyBid, replace, reload }
}
