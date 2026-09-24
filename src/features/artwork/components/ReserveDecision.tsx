import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Check, Handshake, Hourglass, X } from "lucide-react"
import { Button, Input } from "../../../components/ui"
import { formatLeft, useRemaining } from "../../../lib/clock"
import { errorMessage, notify } from "../../../lib/notify"
import { useI18n } from "../../../lib/i18n"
import { requireSupabase } from "../../../lib/supabase"
import type { Artwork } from "../../../types"
import { answerCounter, decideOnBid } from "../api"

const secsUntil = (iso: string | null) =>
  iso ? Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000)) : 0

/**
 * Reserve not met (Copart's "On approval"): the artist accepts the top bid,
 * declines it, or counters once; the top bidder then accepts or declines.
 */
export function ReserveDecision({
  art,
  viewerId,
  onChange,
}: {
  art: Artwork
  viewerId: string | null
  onChange: (next: Artwork) => void
}) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const left = useRemaining(secsUntil(art.decisionDeadline), art.decisionDeadline)
  const isSeller = Boolean(viewerId && viewerId === art.sellerId)
  const isTopBidder = Boolean(viewerId && viewerId === art.highestBidderId)
  const countered = art.sellerDecision === "countered"
  const [busy, setBusy] = useState<string | null>(null)
  const [counter, setCounter] = useState(() => art.currentBid + art.bidIncrement)
  const [reserve, setReserve] = useState<number | null>(null)

  useEffect(() => {
    if (!isSeller) return
    void requireSupabase()
      .rpc("get_auction_reserve", { p_auction_id: art.id })
      .then(({ data }) => {
        if (data != null) {
          setReserve(Number(data))
          setCounter((value) => Math.max(value, Math.min(Number(data), art.currentBid + art.bidIncrement * 5)))
        }
      })
  }, [isSeller, art.id, art.currentBid, art.bidIncrement])

  async function run(label: string, action: () => ReturnType<typeof decideOnBid>, title: string, detail: string, goToOrder = false) {
    setBusy(label)
    try {
      const result = await action()
      onChange(result.artwork)
      notify(title, detail)
      if (goToOrder && result.orderId) navigate(`/orders/${result.orderId}`)
    } catch (error) {
      notify(t("common.somethingWrong"), errorMessage(error), "error")
    } finally {
      setBusy(null)
    }
  }

  const deadline = (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-violet-200">
      <Hourglass className="size-3" /> {left > 0 ? formatLeft(left) : t("artwork.reserve.closing")}
    </span>
  )

  // ── Artist ──
  if (isSeller && !countered)
    return (
      <Box title={t("artwork.reserve.sellerTitle")} aside={deadline}>
        <p>
          {t("artwork.reserve.topBidIs")} <strong className="text-text">{art.currentBid}₾</strong>
          {reserve != null && (
            <>
              {" "}
              ({t("artwork.reserve.yourReserve")} <strong className="text-text">{reserve}₾</strong>)
            </>
          )}
          {t("artwork.reserve.sellerOptions")}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            disabled={Boolean(busy)}
            className="h-11 font-semibold"
            onClick={() =>
              void run("accept", () => decideOnBid(art.id, "accept"), t("artwork.reserve.saleAccepted"), t("artwork.reserve.saleAcceptedText"))
            }
          >
            <Check className="size-4" /> {busy === "accept" ? t("artwork.reserve.accepting") : t("artwork.reserve.accept", { amount: art.currentBid })}
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(busy)}
            className="h-11 text-red-300 hover:text-red-200"
            onClick={() =>
              void run("reject", () => decideOnBid(art.id, "reject"), t("artwork.reserve.bidDeclined"), t("artwork.reserve.bidDeclinedText"))
            }
          >
            <X className="size-4" /> {t("artwork.reserve.decline")}
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-amber">₾</span>
            <Input
              type="number"
              aria-label={t("artwork.reserve.counterLabel")}
              min={art.currentBid + 1}
              value={Number.isFinite(counter) ? counter : ""}
              onChange={(event) => setCounter(Number(event.target.value))}
              className="h-11 pl-8 font-mono"
            />
          </div>
          <Button
            variant="outline"
            disabled={Boolean(busy) || !(counter > art.currentBid)}
            className="h-11"
            onClick={() =>
              void run(
                "counter",
                () => decideOnBid(art.id, "counter", counter),
                t("artwork.reserve.counterSent"),
                t("artwork.reserve.counterSentText", { amount: counter }),
              )
            }
          >
            <Handshake className="size-4" /> {t("artwork.reserve.counter")}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-text-muted">
          {t("artwork.reserve.noAnswer")}
        </p>
      </Box>
    )

  if (isSeller && countered)
    return (
      <Box title={t("artwork.reserve.counterSent")} aside={deadline}>
        <p>
          {t("artwork.reserve.offeredBefore")} <strong className="text-text">{art.counterOffer}₾</strong>
          {t("artwork.reserve.offeredAfter")}
        </p>
      </Box>
    )

  // ── Top bidder ──
  if (isTopBidder && countered)
    return (
      <Box title={t("artwork.reserve.offerTitle")} aside={deadline}>
        <p>
          {t("artwork.reserve.offerBefore", { amount: art.currentBid })}{" "}
          <strong className="text-amber">{art.counterOffer}₾</strong>
          {t("artwork.reserve.offerAfter")}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            disabled={Boolean(busy)}
            className="h-11 font-semibold"
            onClick={() =>
              void run(
                "accept",
                () => answerCounter(art.id, true),
                t("artwork.reserve.offerAccepted"),
                t("artwork.reserve.offerAcceptedText"),
                true,
              )
            }
          >
            <Check className="size-4" /> {busy === "accept" ? t("artwork.reserve.accepting") : t("artwork.reserve.buyFor", { amount: art.counterOffer })}
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(busy)}
            className="h-11"
            onClick={() =>
              void run("decline", () => answerCounter(art.id, false), t("artwork.reserve.offerDeclined"), t("artwork.reserve.offerDeclinedText"))
            }
          >
            <X className="size-4" /> {t("artwork.reserve.noThanks")}
          </Button>
        </div>
      </Box>
    )

  if (isTopBidder)
    return (
      <Box title={t("artwork.reserve.waitingTitle")} aside={deadline}>
        <p>
          {t("artwork.reserve.waitingBefore")} <strong className="text-text">{art.currentBid}₾</strong>
          {t("artwork.reserve.waitingAfter")}
        </p>
      </Box>
    )

  // ── Everyone else ──
  return (
    <Box title={t("artwork.status.onApproval")} aside={deadline}>
      <p>
        {t("artwork.reserve.othersText", { amount: art.currentBid })}
      </p>
    </Box>
  )
}

function Box({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div role="status" className="rounded-2xl border border-violet-400/30 bg-violet-500/[.08] p-4 text-sm leading-6 text-text-secondary">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="font-semibold text-violet-100">{title}</p>
        {aside}
      </div>
      {children}
    </div>
  )
}
