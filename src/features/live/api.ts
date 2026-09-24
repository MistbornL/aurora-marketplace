import { useMemo } from "react"
import { useCatalog } from "../catalog/catalog-context"
import type { Artwork } from "../../types"

/** A room opens early for scheduled live-format lots (waiting room + chat). */
export const hasRoom = (art: Artwork) =>
  (art.isLive && art.timeLeftSecs > 0) || (art.status === "upcoming" && art.format === "live")

/**
 * Every auction that's live right now is its own room, soonest-ending first;
 * scheduled live auctions follow, soonest-starting first.
 */
export function useLiveRooms() {
  const { artworks } = useCatalog()
  return useMemo(() => {
    const live = artworks
      .filter((art) => art.isLive && art.timeLeftSecs > 0)
      .sort((a, b) => Number(b.format === "live") - Number(a.format === "live") || a.timeLeftSecs - b.timeLeftSecs)
    const upcoming = artworks
      .filter((art) => art.status === "upcoming" && art.format === "live")
      .sort((a, b) => a.startsInSecs - b.startsInSecs)
    return [...live, ...upcoming]
  }, [artworks])
}
