import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "../../../features/auth/auth-context"
import { BIDS_UPDATED_EVENT } from "../../../features/artwork/api"
import { listNotifications, markNotificationsRead, type DbNotification } from "../../../features/notifications/api"
import { tr, type MessageKey } from "../../../lib/i18n"
import { EN } from "../../../lib/i18n/messages"

export type NavNotification = {
  id: number
  title: string
  detail: string
  unread: boolean
  at: number
  /** Where clicking the notification takes you. */
  link?: string | null
  /** Built-in items store message keys so they follow the active language. */
  titleKey?: MessageKey
  detailKey?: MessageKey
  vars?: Record<string, string | number>
  /** Set for notifications stored in the database. */
  dbId?: number
}

const POLL_MS = 30_000

/** Database kinds → message keys (unknown kinds fall back to a generic title). */
function fromDb(item: DbNotification): NavNotification {
  const titleKey = `notify.${item.kind}.title` as MessageKey
  const detailKey = `notify.${item.kind}.detail` as MessageKey
  const known = titleKey in EN
  const vars: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(item.data)) if (value != null) vars[key] = value
  return {
    id: -item.id, // negative ids never clash with local (timestamp) ids
    dbId: item.id,
    title: "",
    detail: "",
    titleKey: known ? titleKey : "notify.generic.title",
    detailKey: known && detailKey in EN ? detailKey : undefined,
    vars,
    unread: !item.readAt,
    at: new Date(item.createdAt).getTime(),
    link: item.link,
  }
}

/**
 * Bell-menu notifications: the signed-in person's notifications from the
 * database (polled every 30s and after bids), plus anything sent with
 * lib/notify() during this visit, which also shows as a toast.
 */
export function useNotifications() {
  const { user } = useAuth()
  const [local, setLocal] = useState<NavNotification[]>([])
  const [remote, setRemote] = useState<NavNotification[]>([])
  const seen = useRef<Set<number> | null>(null)

  const load = useCallback(async () => {
    if (!user) return setRemote([])
    const rows = (await listNotifications()).map(fromDb)
    // Toast notifications that arrived since the last check (not on first load).
    if (seen.current) {
      for (const row of rows)
        if (row.dbId && !seen.current.has(row.dbId) && row.unread)
          toast(tr(row.titleKey!, row.vars), {
            description: row.detailKey ? tr(row.detailKey, row.vars) : undefined,
          })
    }
    seen.current = new Set(rows.map((row) => row.dbId!))
    setRemote(rows)
  }, [user])

  useEffect(() => {
    seen.current = null
    void load()
    if (!user) return
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, POLL_MS)
    const onBid = () => setTimeout(() => void load(), 1500)
    window.addEventListener(BIDS_UPDATED_EVENT, onBid)
    return () => {
      clearInterval(id)
      window.removeEventListener(BIDS_UPDATED_EVENT, onBid)
    }
  }, [user, load])

  useEffect(() => {
    const onNotify = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          title: string
          detail: string
          variant?: "success" | "error"
        }>
      ).detail
      if (!detail) return
      setLocal((list) =>
        [
          { id: Date.now() + Math.random(), title: detail.title, detail: detail.detail, unread: true, at: Date.now() },
          ...list,
        ].slice(0, 20),
      )
      toast[detail.variant === "error" ? "error" : "success"](detail.title, {
        description: detail.detail,
      })
    }
    window.addEventListener("aurora:notification", onNotify)
    return () => window.removeEventListener("aurora:notification", onNotify)
  }, [])

  const items = [...remote, ...local].sort((a, b) => b.at - a.at).slice(0, 40)

  function markRead(id: number) {
    const item = items.find((entry) => entry.id === id)
    if (item?.dbId && item.unread) void markNotificationsRead([item.dbId])
    setRemote((list) => list.map((entry) => (entry.id === id ? { ...entry, unread: false } : entry)))
    setLocal((list) => list.map((entry) => (entry.id === id ? { ...entry, unread: false } : entry)))
  }

  function markAllRead() {
    void markNotificationsRead(remote.filter((entry) => entry.unread).map((entry) => entry.dbId!))
    setRemote((list) => list.map((entry) => ({ ...entry, unread: false })))
    setLocal((list) => list.map((entry) => ({ ...entry, unread: false })))
  }

  return {
    items,
    unread: items.filter((item) => item.unread).length,
    markRead,
    markAllRead,
  }
}
