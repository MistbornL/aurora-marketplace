import { useEffect, useRef, useState } from "react"
import { Lock, MessageCircle, SendHorizontal } from "lucide-react"
import { Card } from "../../components/ui"
import { useI18n } from "../../lib/i18n"
import { errorMessage, notify } from "../../lib/notify"
import { CHAT_OPEN_STATUSES, sendOrderMessage, useOrderMessages, type Order } from "./api"

const MAX = 1000

/** Buyer ↔ seller chat for one order. Open until the payout is sent, then read-only. */
export function OrderChat({
  order,
  userId,
  perspective,
}: {
  order: Order
  userId: string
  perspective: "buyer" | "seller" | "admin"
}) {
  const { t, lang } = useI18n()
  const open = CHAT_OPEN_STATUSES.includes(order.status)
  const canWrite = open && perspective !== "admin"
  const { messages, loaded, merge } = useOrderMessages(order.id, open)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const other = perspective === "buyer" ? order.sellerName : order.buyerName

  // Stay at the newest message.
  useEffect(() => {
    const el = list.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  // Nothing to show once a finished order never had a conversation.
  if (!open && loaded && messages.length === 0) return null

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      merge([await sendOrderMessage(order.id, body)])
      setText("")
    } catch (error) {
      notify(t("orders.chat.sendFailed"), errorMessage(error), "error")
    } finally {
      setSending(false)
    }
  }

  const nameOf = (senderId: string) =>
    senderId === order.buyerId ? order.buyerName : order.sellerName
  const time = (iso: string) =>
    new Date(iso).toLocaleString(lang === "ka" ? "ka-GE" : "en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })

  return (
    <Card id="order-chat" className="border border-border bg-surface p-0 ring-0">
      <div className="flex items-center gap-2 border-b border-white/[.06] px-5 py-3.5">
        <MessageCircle className="size-4 text-amber" />
        <h2 className="font-display text-sm font-semibold text-text">
          {perspective === "admin" ? t("orders.chat.adminTitle") : t("orders.chat.title", { name: other })}
        </h2>
      </div>

      <div ref={list} className="max-h-80 min-h-40 space-y-2.5 overflow-y-auto px-5 py-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-text-muted">{t("orders.chat.empty")}</p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === userId
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  mine
                    ? "rounded-br-md bg-amber text-bg"
                    : "rounded-bl-md border border-white/[.08] bg-white/[.05] text-text"
                }`}
              >
                {m.body}
              </div>
              <span className="mt-1 px-1 text-[10px] text-text-muted">
                {perspective === "admin" ? `${nameOf(m.senderId)} · ` : mine ? "" : `${nameOf(m.senderId)} · `}
                {time(m.createdAt)}
              </span>
            </div>
          )
        })}
      </div>

      {canWrite ? (
        <div className="border-t border-white/[.06] px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              maxLength={MAX}
              rows={1}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
              placeholder={t("orders.chat.placeholder")}
              aria-label={t("orders.chat.placeholder")}
              className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border border-white/10 bg-white/[.04] px-4 py-2.5 text-sm text-text outline-none placeholder:text-text-muted focus-visible:border-amber/60"
            />
            <button
              onClick={() => void send()}
              disabled={!text.trim() || sending}
              aria-label={t("orders.chat.send")}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-amber text-bg transition-colors hover:bg-amber-dark disabled:opacity-40"
            >
              <SendHorizontal className="size-4" />
            </button>
          </div>
          <p className="mt-2 px-1 text-[11px] text-text-muted">{t("orders.chat.hint")}</p>
        </div>
      ) : (
        !open && (
          <p className="flex items-center gap-2 border-t border-white/[.06] px-5 py-3 text-xs text-text-muted">
            <Lock className="size-3.5 shrink-0" /> {t("orders.chat.closed")}
          </p>
        )
      )}
    </Card>
  )
}
