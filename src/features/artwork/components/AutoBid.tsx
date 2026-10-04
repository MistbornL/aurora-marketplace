import { useEffect, useState } from "react"
import { Bot, X } from "lucide-react"
import { Button } from "../../../components/ui"
import { useI18n } from "../../../lib/i18n"
import { errorMessage, notify } from "../../../lib/notify"
import type { Artwork } from "../../../types"
import { BIDS_UPDATED_EVENT, getAutoBid, setAutoBid } from "../api"

/**
 * A private ceiling: the server bids the smallest amount needed on your behalf
 * (see run_auto_bids in the database) until your maximum is reached.
 */
export function AutoBid({
  art,
  onArtworkChange,
}: {
  art: Artwork
  onArtworkChange: (next: Artwork) => void
}) {
  const { t } = useI18n()
  const [max, setMax] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  const step = art.bidIncrement || 1
  const min = art.minNextBid

  // Demo lots live in memory — no ceilings there.
  const supported = /^[0-9a-f]{8}-/i.test(art.id)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    getAutoBid(art.id)
      .then((result) => !cancelled && setMax(result.max))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [art.id, supported])

  if (!supported) return null

  const parsed = Number(value)
  const onGrid = Number.isFinite(parsed) && (parsed - art.currentBid) % step === 0
  const valid = Number.isFinite(parsed) && parsed >= min && onGrid &&
    (art.buyNowPrice == null || parsed < art.buyNowPrice)

  async function save(next: number | null) {
    if (saving) return
    setSaving(true)
    try {
      const result = await setAutoBid(art.id, next)
      setMax(result.max)
      onArtworkChange(result.artwork)
      setOpen(false)
      setValue("")
      window.dispatchEvent(new Event(BIDS_UPDATED_EVENT))
      notify(
        next == null ? t("artwork.auto.removed") : t("artwork.auto.saved"),
        next == null ? "" : t("artwork.auto.savedText", { max: next, title: art.title }),
      )
    } catch (error) {
      notify(t("artwork.auto.failed"), errorMessage(error), "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3">
      {max != null && !open && (
        <div className="flex items-center justify-between rounded-xl border border-amber/25 bg-amber/[.06] px-3 py-2 text-xs text-amber">
          <span className="flex items-center gap-1.5">
            <Bot className="size-3.5" /> {t("artwork.auto.active", { max })}
          </span>
          <button
            onClick={() => save(null)}
            disabled={saving}
            aria-label={t("artwork.auto.remove")}
            className="rounded-full p-1 text-amber/80 hover:bg-white/10 hover:text-amber"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {!open ? (
        <button
          onClick={() => {
            setValue(String(max ?? min + step * 4))
            setOpen(true)
          }}
          className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs text-text-secondary underline-offset-4 hover:text-text hover:underline"
        >
          <Bot className="size-3.5" /> {t("artwork.auto.cta")}
        </button>
      ) : (
        <div className="rounded-2xl border border-white/[.08] bg-white/[.03] p-3 animate-in fade-in-0">
          <label htmlFor="auto-bid-max" className="text-xs font-medium text-text">
            {t("artwork.auto.label")}
          </label>
          <input
            id="auto-bid-max"
            inputMode="numeric"
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/[^\d.]/g, ""))}
            className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-bg px-3 font-mono text-sm text-text outline-none focus-visible:border-amber/60"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-muted">{t("artwork.auto.hint")}</p>
          {value !== "" && !valid && (
            <p className="mt-1 text-[11px] text-red-400" role="alert">
              {t("artwork.auto.min", { min, step })}
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-9" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              className="h-9 bg-amber font-semibold text-bg hover:bg-amber-dark"
              disabled={!valid || saving}
              onClick={() => save(parsed)}
            >
              {t("artwork.auto.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
