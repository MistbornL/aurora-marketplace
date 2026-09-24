import { useCallback, useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { supabase } from "../../lib/supabase"
import { tr } from "../../lib/i18n"
import {
  MAX_MESSAGE_LENGTH,
  MAX_MESSAGES,
  MIN_SEND_INTERVAL_MS,
  uid,
  type ChatItem,
} from "./chat"

export type RoomStatus = "connecting" | "live" | "offline"
type Me = { id: string; name: string; avatar: string | null } | null

// One anonymous id per browser tab, so guests count as viewers too.
const guestId = `guest-${uid()}`

/**
 * One Supabase Realtime channel per auction room:
 *  - broadcast "chat": chat messages (ephemeral, not stored)
 *  - broadcast "bid":  "someone just bid" → everyone refreshes the price now
 *  - presence:         live viewer count
 * If Realtime is unavailable the room still works; chat stays local.
 */
export function useLiveRoom(roomId: string, me: Me, onRemoteBid: () => void) {
  const [messages, setMessages] = useState<ChatItem[]>(() => [welcome()])
  const [viewers, setViewers] = useState(1)
  const [status, setStatus] = useState<RoomStatus>(supabase ? "connecting" : "offline")
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastSent = useRef(0)
  const seenBids = useRef(new Set<string>())
  const onRemoteBidRef = useRef(onRemoteBid)
  onRemoteBidRef.current = onRemoteBid

  const push = useCallback((item: ChatItem) => {
    setMessages((list) => [...list, item].slice(-MAX_MESSAGES))
  }, [])

  // (The page remounts this per room, so messages / seen bids start fresh
  // per room; re-subscribing when your name loads must NOT clear them.)
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    setStatus("connecting")
    const channel = client.channel(`live-room:${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: me?.id ?? guestId } },
    })
    channel
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        const item = payload as ChatItem
        if (typeof item?.text !== "string") return
        push({ ...item, text: item.text.slice(0, MAX_MESSAGE_LENGTH), isMe: false })
      })
      .on("broadcast", { event: "bid" }, () => onRemoteBidRef.current())
      .on("presence", { event: "sync" }, () => {
        setViewers(Math.max(1, Object.keys(channel.presenceState()).length))
      })
      .subscribe(async (state) => {
        if (state === "SUBSCRIBED") {
          setStatus("live")
          await channel.track({ name: me?.name ?? "Guest", at: Date.now() })
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          setStatus("offline")
        }
      })
    channelRef.current = channel
    return () => {
      channelRef.current = null
      void client.removeChannel(channel)
    }
  }, [roomId, me?.id, me?.name, push])

  /** Returns an error message, or null when sent. */
  const send = useCallback(
    (raw: string): string | null => {
      const text = raw.trim()
      if (!me) return tr("live.chat.signInToChat")
      if (!text) return null
      if (text.length > MAX_MESSAGE_LENGTH) return tr("live.chat.tooLong", { max: MAX_MESSAGE_LENGTH })
      if (Date.now() - lastSent.current < MIN_SEND_INTERVAL_MS) return tr("live.chat.slowDown")
      lastSent.current = Date.now()
      const item: ChatItem = {
        id: uid(),
        kind: "chat",
        user: me.name,
        avatar: me.avatar,
        text,
        at: Date.now(),
      }
      push({ ...item, isMe: true })
      void channelRef.current?.send({ type: "broadcast", event: "chat", payload: item })
      return null
    },
    [me, push],
  )

  /** Show a bid in the chat once (from polling or our own bid). */
  const showBid = useCallback(
    (bid: { id: string; bidder: string; amount: number; isYou: boolean; createdAt: string }) => {
      if (seenBids.current.has(bid.id)) return
      seenBids.current.add(bid.id)
      push({
        id: `bid-${bid.id}`,
        kind: "bid",
        user: bid.isYou ? tr("live.chat.you") : bid.bidder,
        text: tr("live.chat.placedBid"),
        amount: bid.amount,
        at: new Date(bid.createdAt).getTime(),
        isMe: bid.isYou,
      })
    },
    [push],
  )

  /** Tell everyone in the room to refresh right away. */
  const announceBid = useCallback(() => {
    void channelRef.current?.send({ type: "broadcast", event: "bid", payload: { at: Date.now() } })
  }, [])

  /** Mark existing bids as seen so opening a room doesn't replay history into chat. */
  const primeBids = useCallback((ids: string[]) => {
    ids.forEach((id) => seenBids.current.add(id))
  }, [])

  return { messages, viewers, status, send, showBid, announceBid, primeBids }
}

function welcome(): ChatItem {
  return {
    id: uid(),
    kind: "system",
    text: tr("live.chat.welcome"),
    at: Date.now(),
  }
}
