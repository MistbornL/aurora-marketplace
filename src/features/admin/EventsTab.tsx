import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button, Card, Input, Label, Switch, Textarea } from "../../components/ui"
import { RowsSkeleton } from "../../components/layout/PageSkeletons"
import { useI18n } from "../../lib/i18n"
import { errorMessage, notify } from "../../lib/notify"
import { useCatalog } from "../catalog/catalog-context"
import {
  addLot,
  createEvent,
  deleteEvent,
  moveLot,
  removeLot,
  updateEvent,
  useEvents,
  type AuctionEvent,
  type EventInput,
} from "../events/api"

/** Local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
function toLocalInput(iso: string) {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function nextThursday21() {
  const date = new Date()
  date.setDate(date.getDate() + ((4 - date.getDay() + 7) % 7 || 7))
  date.setHours(21, 0, 0, 0)
  return toLocalInput(date.toISOString())
}

const blank = (): EventInput => ({
  title: "",
  description: "",
  startsAt: nextThursday21(),
  lotGapMinutes: 5,
  published: false,
})

/** Admin: plan live-auction evenings and choose their lots. */
export function EventsTab() {
  const { t, formatDate } = useI18n()
  const { events, loading, reload } = useEvents()
  const { refresh } = useCatalog()
  const [editing, setEditing] = useState<AuctionEvent | "new" | null>(null)

  if (loading) return <RowsSkeleton />

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-secondary">{t("pilot.events.intro")}</p>
        <Button onClick={() => setEditing("new")} className="gap-2">
          <Plus className="size-4" /> {t("pilot.events.new")}
        </Button>
      </div>

      {editing && (
        <EventEditor
          key={editing === "new" ? "new" : editing.id}
          event={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (saved) => {
            await reload()
            void refresh({ silent: true })
            setEditing(saved)
          }}
          onDeleted={async () => {
            await reload()
            void refresh({ silent: true })
            setEditing(null)
          }}
        />
      )}

      {events.length ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {events.map((event) => (
            <button
              key={event.id}
              onClick={() => setEditing(event)}
              className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-border p-4 text-left last:border-b-0 hover:bg-white/[.025]"
            >
              <span>
                <span className="block font-display font-semibold text-text">{event.title}</span>
                <span className="text-xs text-text-muted">
                  {formatDate(event.startsAt, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  event.published ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[.07] text-text-secondary"
                }`}
              >
                {event.published ? t("pilot.events.published") : t("pilot.events.draft")}
              </span>
            </button>
          ))}
        </div>
      ) : (
        !editing && (
          <p className="rounded-2xl border border-dashed border-border px-6 py-14 text-center text-sm text-text-muted">
            {t("pilot.events.empty")}
          </p>
        )
      )}
    </div>
  )
}

function EventEditor({
  event,
  onClose,
  onSaved,
  onDeleted,
}: {
  event: AuctionEvent | null
  onClose: () => void
  onSaved: (event: AuctionEvent) => Promise<void>
  onDeleted: () => Promise<void>
}) {
  const { t, formatDate } = useI18n()
  const navigate = useNavigate()
  const { artworks, refresh } = useCatalog()
  const [draft, setDraft] = useState<EventInput>(() =>
    event
      ? { ...event, startsAt: toLocalInput(event.startsAt) }
      : blank(),
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [pick, setPick] = useState("")

  const lots = useMemo(
    () =>
      event
        ? artworks.filter((art) => art.eventId === event.id).sort((a, b) => (a.lotNumber ?? 0) - (b.lotNumber ?? 0))
        : [],
    [artworks, event],
  )
  // Published real auctions without bids and without an event.
  const eligible = artworks.filter(
    (art) =>
      art.source === "supabase" &&
      !art.eventId &&
      art.bids === 0 &&
      (art.status === "upcoming" || art.status === "live"),
  )

  async function act(label: string, action: () => Promise<unknown>, after?: () => Promise<void>) {
    setBusy(label)
    try {
      await action()
      await refresh({ silent: true })
      await after?.()
    } catch (error) {
      notify(t("common.somethingWrong"), errorMessage(error), "error")
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    if (draft.title.trim().length < 3) return notify(t("pilot.events.titleTooShort"), "", "error")
    setBusy("save")
    try {
      const saved = event ? await updateEvent(event.id, draft) : await createEvent(draft)
      notify(t("pilot.events.saved"), saved.title)
      await onSaved(saved)
    } catch (error) {
      notify(t("common.somethingWrong"), errorMessage(error), "error")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="grid gap-5 border border-amber/30 bg-surface p-6 ring-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-text">
          {event ? t("pilot.events.edit") : t("pilot.events.new")}
        </h2>
        <div className="flex items-center gap-2">
          {event && (
            <Button size="sm" variant="ghost" onClick={() => navigate(`/events/${event.id}`)} className="gap-1.5">
              <ExternalLink className="size-3.5" /> {t("pilot.events.view")}
            </Button>
          )}
          <button onClick={onClose} aria-label={t("common.close")} className="text-text-muted hover:text-text">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label className="text-xs text-text-secondary">{t("pilot.events.fieldTitle")}</Label>
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder={t("pilot.events.titlePlaceholder")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-text-secondary">{t("pilot.events.fieldStart")}</Label>
          <Input
            type="datetime-local"
            value={draft.startsAt}
            onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-text-secondary">{t("pilot.events.fieldGap")}</Label>
          <Input
            type="number"
            min={1}
            max={120}
            value={String(draft.lotGapMinutes)}
            onChange={(e) => setDraft({ ...draft, lotGapMinutes: Number(e.target.value) || 5 })}
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label className="text-xs text-text-secondary">{t("pilot.events.fieldDescription")}</Label>
          <Textarea
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder={t("pilot.events.descriptionPlaceholder")}
          />
        </div>
        <label className="flex items-center gap-3 text-sm text-text sm:col-span-2">
          <Switch checked={draft.published} onCheckedChange={(value) => setDraft({ ...draft, published: value })} />
          {t("pilot.events.publishLabel")}
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save()} disabled={busy === "save"} className="font-semibold">
          {busy === "save" ? t("common.saving") : t("common.save")}
        </Button>
        {event && (
          <Button
            variant="ghost"
            className="text-red-300 hover:text-red-200"
            disabled={Boolean(busy)}
            onClick={() => void act("delete", () => deleteEvent(event.id), onDeleted)}
          >
            <Trash2 className="size-4" /> {t("pilot.events.delete")}
          </Button>
        )}
      </div>

      {event && (
        <div className="border-t border-white/[.06] pt-5">
          <h3 className="font-display font-semibold text-text">{t("pilot.events.lotsTitle")}</h3>
          <p className="mt-1 text-xs text-text-muted">{t("pilot.events.lotsHint", { gap: event.lotGapMinutes })}</p>
          <ol className="mt-3 flex flex-col gap-2">
            {lots.map((art, index) => (
              <li key={art.id} className="flex items-center gap-3 rounded-xl bg-white/[.03] p-2">
                <span className="w-6 text-center font-display font-bold text-amber">{art.lotNumber}</span>
                <img src={art.image} alt="" className="size-10 rounded-lg object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text">{art.title}</span>
                  <span className="text-[11px] text-text-muted">
                    {art.artist}
                    {art.startsAt && ` · ${formatDate(art.startsAt, { hour: "2-digit", minute: "2-digit" })}`}
                  </span>
                </span>
                <Button size="icon" variant="ghost" aria-label={t("pilot.events.up")} disabled={index === 0 || Boolean(busy)}
                  onClick={() => void act("move", () => moveLot(art.id, -1))}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={t("pilot.events.down")} disabled={index === lots.length - 1 || Boolean(busy)}
                  onClick={() => void act("move", () => moveLot(art.id, 1))}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={t("pilot.events.remove")} disabled={art.bids > 0 || Boolean(busy)}
                  onClick={() => void act("remove", () => removeLot(art.id))}>
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              aria-label={t("pilot.events.addLot")}
              className="h-10 min-w-64 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm text-text"
            >
              <option value="" className="bg-surface">
                {eligible.length ? t("pilot.events.choose") : t("pilot.events.noneEligible")}
              </option>
              {eligible.map((art) => (
                <option key={art.id} value={art.id} className="bg-surface">
                  {art.title} — {art.artist} ({art.startingBid}₾)
                </option>
              ))}
            </select>
            <Button
              disabled={!pick || Boolean(busy)}
              onClick={() =>
                void act("add", () => addLot(event.id, pick), async () => {
                  setPick("")
                  notify(t("pilot.events.lotAdded"), t("pilot.events.lotAddedText"))
                })
              }
            >
              <Plus className="size-4" /> {t("pilot.events.addLot")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
