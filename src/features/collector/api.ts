import { useEffect, useState } from "react"
import { apiFetch } from "../../lib/api-client"
import type { MyBid } from "../../types"
import { BIDS_UPDATED_EVENT } from "../artwork/api"

export const getMyBids = (signal?: AbortSignal) =>
  apiFetch<MyBid[]>("/me/bids", { signal })

/** The signed-in user's bids (latest per artwork), from the API. */
export function useMyBids(userId: string | undefined) {
  const [bids, setBids] = useState<MyBid[]>([])
  const [loading, setLoading] = useState(Boolean(userId))
  useEffect(() => {
    if (!userId) {
      setBids([])
      setLoading(false)
      return
    }
    let controller = new AbortController()
    const load = () => {
      controller.abort()
      controller = new AbortController()
      void getMyBids(controller.signal)
        .then(setBids)
        .catch(() => undefined)
        .finally(() => setLoading(false))
    }
    load()
    window.addEventListener(BIDS_UPDATED_EVENT, load)
    return () => {
      controller.abort()
      window.removeEventListener(BIDS_UPDATED_EVENT, load)
    }
  }, [userId])
  return { bids, loading }
}
