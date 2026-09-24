import { useEffect, useMemo, useRef } from "react"
import { ChevronLeft } from "lucide-react"
import { Button } from "../../components/ui"
import { formatLeft, useCountdown, useRemaining } from "../../lib/clock"
import { useI18n } from "../../lib/i18n"
import type { Artwork } from "../../types"
import { BidPanel } from "../artwork/components/BidPanel"
import { useBidding } from "../artwork/use-bidding"
import { useLiveArtwork } from "../artwork/use-live-artwork"
import { useAuth } from "../auth/auth-context"
import { useCatalog } from "../catalog/catalog-context"
import { hasRoom, useLiveRooms } from "./api"
import { ChatPanel } from "./components/ChatPanel"
import { useLiveRoom } from "./use-live-room"

/** /live/:id — one room per auction: stage + bidding on the left, chat on the right. */
export default function LiveRoomPage({
  roomId,
  onLobby,
  onRoom,
  onArtwork,
  onArtist,
}: {
  roomId: string
  onLobby: () => void
  onRoom: (id: string) => void
  onArtwork: (id: string) => void
  onArtist: (id: string) => void
}) {
  const { artworks } = useCatalog()
  const { t } = useI18n()
  const art = artworks.find((item) => item.id === roomId)

  if (!art || !hasRoom(art))
    return (
      <div className="grid min-h-[70vh] place-items-center bg-bg px-4 text-center">
        <div>
          <p className="font-display text-2xl font-semibold text-text">
            {art ? t("live.room.ended") : t("live.room.notFound")}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            {art ? t("live.room.endedText", { title: art.title }) : t("live.room.notFoundText")}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={onLobby} className="h-10 rounded-full px-5">
              {t("live.room.backToRooms")}
            </Button>
            {art && (
              <Button onClick={() => onArtwork(art.id)} className="h-10 rounded-full px-5">
                {t("live.room.viewResults")}
              </Button>
            )}
          </div>
        </div>
      </div>
    )

  return (
    <Room key={art.id} initial={art} onLobby={onLobby} onRoom={onRoom} onArtwork={onArtwork} onArtist={onArtist} />
  )
}

function Room({
  initial,
  onLobby,
  onRoom,
  onArtwork,
  onArtist,
}: {
  initial: Artwork
  onLobby: () => void
  onRoom: (id: string) => void
  onArtwork: (id: string) => void
  onArtist: (id: string) => void
}) {
  const { user, profile } = useAuth()
  const { t } = useI18n()
  const rooms = useLiveRooms()
  const { artwork: art, history, historyLoading, applyBid, replace, reload } = useLiveArtwork(initial)
  const secs = useRemaining(art.timeLeftSecs, art.endsAt)
  const startsIn = useRemaining(art.startsInSecs, art.startsAt)

  const me = useMemo(
    () => (user ? { id: user.id, name: profile?.publicName ?? profile?.username ?? t("live.room.collector"), avatar: profile?.avatarUrl ?? null } : null),
    [user, profile?.publicName, profile?.username, profile?.avatarUrl, t],
  )
  const room = useLiveRoom(art.id, me, reload)
  const bidding = useBidding({
    art,
    history,
    secsLeft: secs,
    startsIn,
    applyBid,
    replace,
    onPlaced: (bid) => {
      room.showBid(bid)
      room.announceBid() // everyone else refreshes immediately
    },
  })

  // Show new bids (from anyone) in the chat; don't replay old history on entry.
  const primed = useRef(false)
  const { primeBids, showBid } = room
  useEffect(() => {
    if (historyLoading) return
    if (!primed.current) {
      primeBids(history.map((bid) => bid.id))
      primed.current = true
      return
    }
    ;[...history].reverse().forEach(showBid)
  }, [history, historyLoading, primeBids, showBid])

  return (
    <main className="bg-bg lg:flex lg:h-[calc(100dvh-4rem)] lg:flex-col">
      {/* Room switcher */}
      <div className="flex items-center gap-3 border-b border-white/[.06] px-4 py-3 sm:px-6 lg:px-10">
        <button
          onClick={onLobby}
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-[13px] text-text-secondary hover:bg-white/[.05] hover:text-text"
        >
          <ChevronLeft className="size-4" /> {t("live.room.allRooms")}
        </button>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label={t("live.room.tabs")}>
          {rooms.map((item) => (
            <RoomTab key={item.id} art={item} active={item.id === art.id} onClick={() => onRoom(item.id)} />
          ))}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-10">
        {/* Stage + bidding: its own scroll area on desktop */}
        <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin]">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0">
              <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-3xl bg-[#0a0a0d] xl:aspect-auto xl:h-[min(62vh,640px)]">
                <img src={art.image} alt={art.title} fetchPriority="high" className="h-full w-full object-contain" />
                <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-text backdrop-blur">
                  {bidding.upcoming ? (
                    <>
                      <span className="size-1.5 rounded-full bg-sky-400" /> {t("live.room.startsIn", { time: formatLeft(startsIn) })}
                    </>
                  ) : bidding.isLive ? (
                    <>
                      <span className="size-1.5 animate-pulse rounded-full bg-red-500" /> LIVE ·{" "}
                      {art.format === "live" ? `0:${String(Math.min(secs, 59)).padStart(2, "0")}` : formatLeft(secs)}
                    </>
                  ) : (
                    t("live.room.closed")
                  )}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">{art.title}</h1>
                  <button onClick={() => onArtist(art.artistId)} className="text-sm text-text-secondary hover:text-text">
                    {t("live.room.by", { artist: art.artist })}
                  </button>
                </div>
                <Button variant="outline" onClick={() => onArtwork(art.id)} className="h-9 rounded-full px-4 text-[13px]">
                  {t("live.room.fullDetails")}
                </Button>
              </div>
            </div>
            <BidPanel
              art={art}
              secsLeft={secs}
              startsIn={startsIn}
              canBuyNow={bidding.canBuyNow}
              onBuyNow={bidding.handleBuyNow}
              viewerId={user?.id ?? null}
              onArtworkChange={replace}
              state={bidding.state}
              history={history}
              historyLoading={historyLoading}
              submitting={bidding.submitting}
              justPlaced={bidding.justPlaced}
              onBid={bidding.handleBid}
              onSignIn={bidding.openSignIn}
              onSeeAllBids={() => onArtwork(art.id)}
            />
          </div>
        </div>

        {/* Chat: fixed height on phones, fills the column on desktop — never grows the page */}
        <div className="h-[70vh] min-h-0 lg:h-auto">
          <ChatPanel
            messages={room.messages}
            viewers={room.viewers}
            status={room.status}
            canChat={Boolean(user)}
            onSend={room.send}
            onSignIn={bidding.openSignIn}
          />
        </div>
      </div>
      {bidding.dialogs}
    </main>
  )
}

function RoomTab({ art, active, onClick }: { art: Artwork; active: boolean; onClick: () => void }) {
  const { t } = useI18n()
  const { secs } = useCountdown(art.status === "upcoming" ? art.startsInSecs : art.timeLeftSecs, 60)
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2.5 rounded-2xl border py-1.5 pl-1.5 pr-3 text-left transition-colors ${
        active ? "border-amber/50 bg-amber/10" : "border-white/[.08] hover:border-white/20"
      }`}
    >
      <img src={art.image} alt="" className="size-9 rounded-xl object-cover" />
      <span>
        <span className={`block max-w-[140px] truncate text-xs font-medium ${active ? "text-text" : "text-text-secondary"}`}>
          {art.title}
        </span>
        <span className="block text-[11px] text-text-muted">
          <span className="font-mono text-amber">{art.currentBid}₾</span> ·{" "}
          {art.status === "upcoming" ? t("live.room.tabStarts", { time: formatLeft(secs) }) : art.format === "live" ? t("live.room.tabLive") : formatLeft(secs)}
        </span>
      </span>
    </button>
  )
}
