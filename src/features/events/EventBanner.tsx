import { ArrowRight, Radio } from "lucide-react"
import { Button } from "../../components/ui"
import { formatLeft, useCountdown } from "../../lib/clock"
import { useI18n } from "../../lib/i18n"
import { useCatalog } from "../catalog/catalog-context"
import { nextEvent, useEvents } from "./api"

/** "Next live event" strip for the landing page and the live lobby. */
export function EventBanner({ onOpen, className = "" }: { onOpen: (id: string) => void; className?: string }) {
  const { events } = useEvents()
  const event = nextEvent(events)
  if (!event) return null
  return <Banner key={event.id} event={event} onOpen={onOpen} className={className} />
}

function Banner({
  event,
  onOpen,
  className,
}: {
  event: NonNullable<ReturnType<typeof nextEvent>>
  onOpen: (id: string) => void
  className: string
}) {
  const { t, formatDate } = useI18n()
  const { artworks } = useCatalog()
  const lots = artworks.filter((art) => art.eventId === event.id)
  const secs = Math.max(0, Math.round((new Date(event.startsAt).getTime() - Date.now()) / 1000))
  const left = useCountdown(secs)
  const live = left.secs <= 0
  return (
    <div
      className={`flex flex-wrap items-center gap-4 rounded-3xl border border-red-500/30 bg-gradient-to-r from-red-500/[.12] via-amber/[.06] to-transparent p-5 sm:p-6 ${className}`}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-red-500/15 text-red-400">
        <Radio className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-400">
          {live ? t("events.banner.liveNow") : t("events.banner.next")}
        </p>
        <p className="mt-1 truncate font-display text-xl font-semibold text-text">{event.title}</p>
        <p className="mt-0.5 text-sm text-text-secondary">
          {formatDate(event.startsAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          {lots.length > 0 && ` · ${t("events.banner.lots", { count: lots.length })}`}
        </p>
      </div>
      {!live && (
        <span className="rounded-full bg-black/30 px-3 py-1.5 font-mono text-sm text-amber">{formatLeft(left.secs)}</span>
      )}
      <Button onClick={() => onOpen(event.id)} className="h-11 gap-2 rounded-full px-5 font-semibold">
        {live ? t("events.banner.join") : t("events.banner.see")} <ArrowRight className="size-4" />
      </Button>
    </div>
  )
}
