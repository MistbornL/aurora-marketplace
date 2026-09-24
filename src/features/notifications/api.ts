import { supabase } from "../../lib/supabase"

/** A notification created by the database (outbid, won, paid, shipped…). */
export type DbNotification = {
  id: number
  kind: string
  data: Record<string, string | number | null>
  link: string | null
  readAt: string | null
  createdAt: string
}

export async function listNotifications(): Promise<DbNotification[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, data, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(40)
  if (error || !data) return []
  return data.map((row) => ({
    id: Number(row.id),
    kind: String(row.kind),
    data: (row.data ?? {}) as DbNotification["data"],
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  }))
}

export async function markNotificationsRead(ids: number[]) {
  if (!supabase || !ids.length) return
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids)
}
