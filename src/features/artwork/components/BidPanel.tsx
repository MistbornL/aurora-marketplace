import { useEffect, useState, type ReactNode } from "react"
import {
  CheckCircle2,
  CalendarClock,
  Clock,
  Gavel,
  ShieldCheck,
  Zap,
  Info,
  Lock,
  Minus,
  Plus,
  TrendingUp,
} from "lucide-react"
import { Button } from "../../../components/ui"
import { formatLeft } from "../../../lib/clock"
import { useI18n } from "../../../lib/i18n"
import type { Artwork, BidEntry } from "../../../types"
import { BidHistoryList } from "./BidHistoryList"
import { ReserveDecision } from "./ReserveDecision"

type Translate = ReturnType<typeof useI18n>["t"]

export type BidState =
  | "signed-out"
  | "own-auction"
  | "leading"
  | "outbid"
  | "open"
  | "upcoming"
  | "awaiting"
  | "ended"

type Props = {
  art: Artwork
  secsLeft: number
  /** Seconds until a scheduled lot opens. */
  startsIn: number
  state: BidState
  canBuyNow: boolean
  onBuyNow: () => void
  viewerId: string | null
  onArtworkChange: (next: Artwork) => void
  history: BidEntry[]
  historyLoading: boolean
  submitting: boolean
  justPlaced: boolean
  onBid: (amount: number) => void
  onSignIn: () => void
  onSeeAllBids: () => void
}

export function BidPanel({
  art,
  secsLeft,
  startsIn,
  state,
  canBuyNow,
  onBuyNow,
  viewerId,
  onArtworkChange,
  history,
  historyLoading,
  submitting,
  justPlaced,
  onBid,
  onSignIn,
  onSeeAllBids,
}: Props) {
  const { t } = useI18n()
  const step = art.bidIncrement || 1
  const min = art.minNextBid
  const [amount, setAmount] = useState(min)
  const [confirming, setConfirming] = useState(false)
  const [confirmBuy, setConfirmBuy] = useState(false)
  const buyNowPrice = art.buyNowPrice

  // Keep the amount valid when someone else bids and the minimum moves up.
  useEffect(() => {
    setAmount((current) => (current < min ? min : current))
    setConfirming(false)
  }, [min])

  // A bid equal to the buy-now price wins instantly (and may skip the step rule).
  const winsNow = buyNowPrice != null && amount === buyNowPrice
  const tooHigh = buyNowPrice != null && amount > buyNowPrice
  const tooLow = amount < min && !winsNow
  const offStep = (amount - art.currentBid) % step !== 0 && !winsNow
  const invalid = tooLow || offStep || tooHigh || !Number.isFinite(amount)
  const canBid = state === "open" || state === "outbid"
  const quick = [min, min + step, min + step * 3].filter(
    (value) => buyNowPrice == null || value < buyNowPrice,
  )
  const liveFormat = art.format === "live"
  const urgent = secsLeft > 0 && (liveFormat ? secsLeft <= 10 : secsLeft <= 3600)
  const closed = state === "ended" || state === "awaiting"

  return (
    <section
      aria-label={t("artwork.placeABid")}
      className="rounded-3xl border border-white/[.08] bg-gradient-to-b from-surface to-[#141419] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:p-6"
    >
      {/* Price + time */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-text-muted">
            {art.bids > 0 ? t("artwork.panel.currentBid") : t("artwork.panel.startingBid")}
          </p>
          <p className="mt-1 font-display text-4xl font-bold tracking-tight text-amber">
            {art.currentBid}₾
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {t("common.bids", { count: art.bids })} · {t("artwork.panel.steps", { step })}
          </p>
        </div>
        <TimeBox
          state={state}
          art={art}
          secsLeft={secsLeft}
          startsIn={startsIn}
          urgent={urgent}
        />
      </div>

      {art.hasReserve && art.bids > 0 && !closed && (
        <p
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            art.reserveMet ? "bg-emerald-500/15 text-emerald-300" : "bg-violet-500/15 text-violet-200"
          }`}
        >
          <ShieldCheck className="size-3.5" />
          {art.reserveMet ? t("artwork.panel.reserveMet") : t("artwork.panel.reserveNotMet")}
        </p>
      )}

      {/* Friendly status */}
      <div className="mt-5">
        {state === "awaiting" ? (
          <ReserveDecision art={art} viewerId={viewerId} onChange={onArtworkChange} />
        ) : (
          <StatusBanner state={state} art={art} justPlaced={justPlaced} startsIn={startsIn} />
        )}
      </div>

      {/* Buy it now (until the first bid) */}
      {canBuyNow && buyNowPrice != null && (
        <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/[.07] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-200">
                <Zap className="size-4" /> {t("artwork.panel.buyNow")}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {t("artwork.panel.buyNowHint")}
              </p>
            </div>
            <p className="font-display text-2xl font-bold text-emerald-300">{buyNowPrice}₾</p>
          </div>
          {confirmBuy ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-10" onClick={() => setConfirmBuy(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={submitting}
                onClick={() => {
                  setConfirmBuy(false)
                  onBuyNow()
                }}
                className="h-10 bg-emerald-500 font-semibold text-bg hover:bg-emerald-400"
              >
                {submitting ? t("artwork.panel.buying") : t("artwork.panel.confirmAmount", { amount: buyNowPrice })}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setConfirmBuy(true)}
              className="mt-3 h-11 w-full rounded-xl bg-emerald-500 font-semibold text-bg hover:bg-emerald-400"
            >
              {t("artwork.panel.buyNowButton", { amount: buyNowPrice })}
            </Button>
          )}
          {confirmBuy && (
            <p className="mt-2 text-[11px] text-text-muted">
              {t("artwork.panel.buyNowBinding", { amount: buyNowPrice })}
            </p>
          )}
        </div>
      )}

      {/* Bid controls */}
      {canBid && (
        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {quick.map((value, index) => (
              <button
                key={value}
                onClick={() => {
                  setAmount(value)
                  setConfirming(false)
                }}
                className={`rounded-xl border px-2 py-2.5 text-center transition-colors ${
                  amount === value
                    ? "border-amber bg-amber/10 text-amber"
                    : "border-white/10 text-text-secondary hover:border-white/25 hover:text-text"
                }`}
              >
                <span className="block font-mono text-sm font-semibold">{value}₾</span>
                <span className="block text-[10px] text-text-muted">
                  {index === 0 ? t("artwork.panel.minimum") : `+${value - min}₾`}
                </span>
              </button>
            ))}
          </div>

          <div
            className={`flex items-center rounded-2xl border bg-black/20 p-1.5 ${
              invalid ? "border-red-500/50" : "border-white/10 focus-within:border-amber/60"
            }`}
          >
            <StepButton
              label={t("artwork.panel.lowerBid")}
              disabled={amount - step < min}
              onClick={() => {
                setAmount((value) => Math.max(min, value - step))
                setConfirming(false)
              }}
            >
              <Minus />
            </StepButton>
            <label className="flex flex-1 items-center justify-center gap-1">
              <span className="sr-only">{t("artwork.panel.yourBidLari")}</span>
              <input
                type="number"
                inputMode="numeric"
                value={Number.isFinite(amount) ? amount : ""}
                min={min}
                step={step}
                onChange={(event) => {
                  setAmount(Number(event.target.value))
                  setConfirming(false)
                }}
                className="w-28 bg-transparent text-center font-mono text-2xl font-semibold text-text outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="font-mono text-xl text-amber">₾</span>
            </label>
            <StepButton
              label={t("artwork.panel.raiseBid")}
              onClick={() => {
                setAmount((value) => (Number.isFinite(value) ? value : min) + step)
                setConfirming(false)
              }}
            >
              <Plus />
            </StepButton>
          </div>
          {buyNowPrice != null && art.bids > 0 && (
            <button
              onClick={() => {
                setAmount(buyNowPrice)
                setConfirming(false)
              }}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                winsNow
                  ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                  : "border-emerald-400/30 text-emerald-300/90 hover:border-emerald-400/60"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Zap className="size-3.5" /> {t("artwork.panel.winInstantly")}
              </span>
              <span className="font-mono font-semibold">{buyNowPrice}₾</span>
            </button>
          )}
          {invalid && (
            <p className="text-xs text-red-400" role="alert">
              {tooHigh
                ? t("artwork.panel.tooHigh", { amount: buyNowPrice })
                : tooLow
                ? t("artwork.panel.tooLow", { amount: min })
                : t("artwork.panel.offStep", {
                    step,
                    suggestion: min + Math.ceil((amount - min) / step) * step,
                  })}
            </p>
          )}

          {confirming ? (
            <div className="rounded-2xl border border-amber/30 bg-amber/[.06] p-3 animate-in fade-in-0">
              <p className="text-sm text-text">
                {t("artwork.panel.confirmBefore")} <strong className="font-mono text-amber">{amount}₾</strong>
                {t("artwork.panel.confirmAfter", { title: art.title })}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {t("artwork.panel.binding")}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-10" onClick={() => setConfirming(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  className="h-10 bg-amber font-semibold text-bg hover:bg-[#f3ca6b]"
                  disabled={submitting}
                  onClick={() => {
                    onBid(amount)
                    setConfirming(false)
                  }}
                >
                  {submitting ? t("artwork.panel.placing") : t("artwork.panel.confirmBid")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              disabled={invalid || submitting}
              onClick={() => setConfirming(true)}
              className="h-12 w-full gap-2 rounded-2xl bg-amber text-[15px] font-semibold text-bg shadow-lg shadow-amber/15 hover:bg-[#f3ca6b]"
            >
              <Gavel className="size-4" />
              {winsNow
                ? t("artwork.panel.winNow", { amount })
                : state === "outbid"
                  ? t("artwork.panel.bidAgain", { amount })
                  : t("artwork.panel.placeBid", { amount })}
            </Button>
          )}
        </div>
      )}

      {state === "signed-out" && (
        <Button
          onClick={onSignIn}
          className="mt-5 h-12 w-full rounded-2xl bg-amber text-[15px] font-semibold text-bg hover:bg-[#f3ca6b]"
        >
          {state === "signed-out" && startsIn > 0 ? t("artwork.panel.signInReady") : t("artwork.signInToBid")}
        </Button>
      )}

      {/* Recent bids */}
      <div className="mt-6 border-t border-white/[.06] pt-4">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-semibold text-text">{t("artwork.panel.recentBids")}</p>
          {history.length > 3 && (
            <button onClick={onSeeAllBids} className="text-xs text-amber hover:text-amber/80">
              {t("artwork.panel.seeAll")}
            </button>
          )}
        </div>
        <BidHistoryList bids={history} loading={historyLoading} total={art.bids} limit={3} />
      </div>

      <HowBiddingWorks step={step} live={liveFormat} />
    </section>
  )
}

function StatusBanner({
  state,
  art,
  justPlaced,
  startsIn,
}: {
  state: BidState
  art: Artwork
  justPlaced: boolean
  startsIn: number
}) {
  const { t, formatDate } = useI18n()
  const startsLabel = art.startsAt
    ? formatDate(art.startsAt, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : ""
  const banners: Record<BidState, { tone: string; icon: ReactNode; title: string; text: string }> = {
    "signed-out": {
      tone: "border-white/10 bg-white/[.03] text-text-secondary",
      icon: <Info />,
      title: startsIn > 0 ? t("artwork.status.opens", { date: startsLabel }) : t("artwork.status.joinToBid"),
      text: t("artwork.status.freeAccount"),
    },
    upcoming: {
      tone: "border-sky-400/30 bg-sky-500/[.08] text-sky-200",
      icon: <CalendarClock />,
      title: t("artwork.status.biddingOpens", { date: startsLabel }),
      text:
        art.format === "live"
          ? t("artwork.status.liveRules")
          : t("artwork.status.openingBid", { amount: art.startingBid }),
    },
    awaiting: {
      tone: "border-violet-400/30 bg-violet-500/[.08] text-violet-200",
      icon: <Clock />,
      title: t("artwork.status.onApproval"),
      text: t("artwork.status.belowReserve"),
    },
    "own-auction": {
      tone: "border-white/10 bg-white/[.03] text-text-secondary",
      icon: <Lock />,
      title: t("artwork.status.ownTitle"),
      text: t("artwork.status.ownText"),
    },
    leading: {
      tone: "border-emerald-500/30 bg-emerald-500/[.08] text-emerald-300",
      icon: <CheckCircle2 />,
      title: justPlaced ? t("artwork.status.placedLeading") : t("artwork.status.leading"),
      text: t("artwork.status.leadingText"),
    },
    outbid: {
      tone: "border-amber/30 bg-amber/[.08] text-amber",
      icon: <TrendingUp />,
      title: t("artwork.status.outbid"),
      text: t("artwork.status.outbidText", { name: art.highestBidder ?? t("artwork.status.someone"), amount: art.currentBid }),
    },
    open: {
      tone: "border-white/10 bg-white/[.03] text-text-secondary",
      icon: <Gavel />,
      title:
        art.bids > 0
          ? t("artwork.status.isLeading", { name: art.highestBidder ?? t("artwork.status.aCollector") })
          : t("artwork.status.noBids"),
      text: t("artwork.status.nextBid", { amount: art.minNextBid }),
    },
    ended: {
      tone: "border-white/10 bg-white/[.03] text-text-secondary",
      icon: <Clock />,
      title: endedTitle(art, t),
      text: endedText(art, t),
    },
  }
  const banner = banners[state]
  return (
    <div
      role="status"
      className={`flex gap-3 rounded-2xl border px-4 py-3 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 ${banner.tone}`}
    >
      {banner.icon}
      <div>
        <p className="text-sm font-semibold">{banner.title}</p>
        <p className="mt-0.5 text-xs opacity-80">{banner.text}</p>
      </div>
    </div>
  )
}

function endedTitle(art: Artwork, t: Translate) {
  if (art.soldVia === "buy_now") return t("artwork.ended.buyNowTitle")
  if (art.sellerDecision === "rejected" || art.sellerDecision === "expired" || art.sellerDecision === "counter_declined")
    return t("artwork.ended.notSold")
  return t("artwork.ended.title")
}

function endedText(art: Artwork, t: Translate) {
  if (art.soldVia === "buy_now") return t("artwork.ended.buyNowText", { amount: art.currentBid })
  if (art.soldVia === "counter") return t("artwork.ended.counterText", { amount: art.counterOffer })
  if (art.sellerDecision === "rejected") return t("artwork.ended.rejected")
  if (art.sellerDecision === "counter_declined") return t("artwork.ended.counterDeclined")
  if (art.sellerDecision === "expired") return t("artwork.ended.expired")
  return art.bids > 0 ? t("artwork.ended.soldFor", { amount: art.currentBid }) : t("artwork.ended.noBids")
}

function TimeBox({
  state,
  art,
  secsLeft,
  startsIn,
  urgent,
}: {
  state: BidState
  art: Artwork
  secsLeft: number
  startsIn: number
  urgent: boolean
}) {
  const { t, formatDate } = useI18n()
  const closed = state === "ended" || state === "awaiting"
  const upcoming = !closed && startsIn > 0
  const liveFormat = art.format === "live"

  if (upcoming)
    return (
      <div className="rounded-2xl bg-sky-500/10 px-3.5 py-2.5 text-right">
        <p className="flex items-center justify-end gap-1 text-xs text-sky-200/80">
          <CalendarClock className="size-3.5" /> {t("artwork.time.startsIn")}
        </p>
        <p className="mt-1 font-mono text-xl font-semibold text-sky-100">{formatLeft(startsIn)}</p>
        {art.startsAt && (
          <p className="mt-0.5 text-[11px] text-text-muted">
            {formatDate(art.startsAt, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    )

  if (liveFormat && !closed) {
    // Auctioneer-style call based on the 30s timer.
    const call =
      secsLeft <= 5
        ? t("artwork.time.lastCall")
        : secsLeft <= 10
          ? t("artwork.time.goingTwice")
          : secsLeft <= 20
            ? t("artwork.time.goingOnce")
            : t("artwork.time.takingBids")
    return (
      <div
        className={`min-w-[112px] rounded-2xl px-3.5 py-2.5 text-right transition-colors ${
          urgent ? "bg-red-500/15" : "bg-white/[.04]"
        }`}
        aria-live="polite"
      >
        <p className={`text-xs font-semibold ${urgent ? "text-red-300" : "text-text-muted"}`}>{call}</p>
        <p
          className={`mt-1 font-mono text-3xl font-bold tabular-nums ${urgent ? "text-red-400" : "text-text"}`}
        >
          0:{String(Math.min(secsLeft, 59)).padStart(2, "0")}
        </p>
        <p className="mt-0.5 text-[11px] text-text-muted">{t("artwork.time.resets")}</p>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl px-3.5 py-2.5 text-right ${!closed && urgent ? "bg-red-500/10" : "bg-white/[.04]"}`}>
      <p className="flex items-center justify-end gap-1 text-xs text-text-muted">
        <Clock className="size-3.5" />
        {closed ? t("artwork.time.closed") : t("artwork.time.endsIn")}
      </p>
      <p className={`mt-1 font-mono text-xl font-semibold ${!closed && urgent ? "text-red-400" : "text-text"}`}>
        {closed ? "—" : formatLeft(secsLeft)}
      </p>
      <p className="mt-0.5 text-[11px] text-text-muted">
        {formatDate(art.endsAt, {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  )
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-11 place-items-center rounded-xl bg-white/[.05] text-text transition-colors hover:bg-white/[.1] disabled:opacity-30 [&_svg]:size-4"
    >
      {children}
    </button>
  )
}

function HowBiddingWorks({ step, live }: { step: number; live: boolean }) {
  const { t } = useI18n()
  return (
    <details className="group mt-4 rounded-2xl bg-white/[.02] px-4 py-3 text-xs text-text-muted">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-text-secondary">
        <Info className="size-3.5" /> {t("artwork.how.title")}
        <span className="ml-auto transition-transform group-open:rotate-45">+</span>
      </summary>
      <ol className="mt-3 list-decimal space-y-1.5 pl-4 leading-5">
        <li>{t("artwork.how.step1", { step })}</li>
        <li>{t("artwork.how.step2")}</li>
        <li>{t("artwork.how.step3")}</li>
        {live ? (
          <li>{t("artwork.how.live")}</li>
        ) : (
          <li>{t("artwork.how.timed")}</li>
        )}
        <li>{t("artwork.how.reserve")}</li>
      </ol>
    </details>
  )
}

export { formatLeft } from "../../../lib/clock"
