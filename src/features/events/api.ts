import { useCallback, useEffect, useState } from "react"
import { requireSupabase, supabase } from "../../lib/supabase"

/** A curated live-auction evening, e.g. "Thursday Night Live · 21:00". */
export type AuctionEvent = {
  id: string
  title: string
  description: string
  startsAt: string
  lotGapMinutes: number
  coverUrl: string | null
  published: boolean
}

type Row = {
  id: string
  title: string
  description: string
  starts_at: string
  lot_gap_minutes: number
  cover_url: string | null
  published: boolean
}

const toEvent = (row: Row): AuctionEvent => ({
  id: row.id,
  title: row.title,
  description: row.description,
  startsAt: row.starts_at,
  lotGapMinutes: row.lot_gap_minutes,
  coverUrl: row.cover_url,
  published: row.published,
})

async function run<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

/** Published events (admins also see drafts), newest-first after upcoming. */
export async function listEvents(): Promise<AuctionEvent[]> {
  if (!supabase) return []
  const rows = await run(supabase.from("auction_events").select("*").order("starts_at", { ascending: true }).limit(100))
  return (rows as Row[]).map(toEvent)
}

export async function getEvent(id: string) {
  const row = await run(requireSupabase().from("auction_events").select("*").eq("id", id).maybeSingle())
  return row ? toEvent(row as Row) : null
}

export type EventInput = Pick<AuctionEvent, "title" | "description" | "startsAt" | "lotGapMinutes" | "published">

const toRow = (input: EventInput) => ({
  title: input.title.trim(),
  description: input.description.trim(),
  starts_at: new Date(input.startsAt).toISOString(),
  lot_gap_minutes: input.lotGapMinutes,
  published: input.published,
})

export async function createEvent(input: EventInput) {
  const row = await run(requireSupabase().from("auction_events").insert(toRow(input)).select("*").single())
  return toEvent(row as Row)
}

export async function updateEvent(id: string, input: EventInput) {
  const row = await run(requireSupabase().from("auction_events").update(toRow(input)).eq("id", id).select("*").single())
  // Lots follow the event's start time and gap.
  await run(requireSupabase().rpc("event_reschedule", { p_event_id: id }))
  return toEvent(row as Row)
}

export async function deleteEvent(id: string) {
  await run(requireSupabase().from("auction_events").delete().eq("id", id))
}

const rpc = (name: string, args: Record<string, unknown>) => run(requireSupabase().rpc(name, args))
export const addLot = (eventId: string, auctionId: string) =>
  rpc("event_add_lot", { p_event_id: eventId, p_auction_id: auctionId })
export const removeLot = (auctionId: string) => rpc("event_remove_lot", { p_auction_id: auctionId })
export const moveLot = (auctionId: string, direction: -1 | 1) =>
  rpc("event_move_lot", { p_auction_id: auctionId, p_direction: direction })

export function useEvents() {
  const [events, setEvents] = useState<AuctionEvent[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    try {
      setEvents(await listEvents())
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  return { events, loading, reload }
}

/** Next published event that hasn't finished (starts within the last 3 hours or later). */
export const nextEvent = (events: AuctionEvent[]) =>
  events.find((event) => event.published && new Date(event.startsAt).getTime() > Date.now() - 3 * 3_600_000) ?? null

/** Calendar file so people can save the date. */
export function downloadIcs(event: AuctionEvent, url: string) {
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const start = new Date(event.startsAt)
  const end = new Date(start.getTime() + 2 * 3_600_000)
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TSISKARI//Events//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@tsiskari`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${event.title.replace(/[,;]/g, " ")} — TSISKARI`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
  const link = document.createElement("a")
  link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }))
  link.download = "tsiskari-live-auction.ics"
  link.click()
  URL.revokeObjectURL(link.href)
}
