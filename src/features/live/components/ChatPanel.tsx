import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArrowDown, Gavel, SendHorizontal, WifiOff } from "lucide-react"
import { useI18n } from "../../../lib/i18n"
import { MAX_MESSAGE_LENGTH, clockTime, type ChatItem } from "../chat"
import type { RoomStatus } from "../use-live-room"

/**
 * Chat that never grows the page: the list is the only scrolling element
 * (flex-1 + min-h-0), it auto-scrolls only when you're already at the bottom,
 * and otherwise shows a "new messages" pill.
 */
export function ChatPanel({
  messages,
  viewers,
  status,
  canChat,
  onSend,
  onSignIn,
}: {
  messages: ChatItem[]
  viewers: number
  status: RoomStatus
  canChat: boolean
  onSend: (text: string) => string | null
  onSignIn: () => void
}) {
  const { t } = useI18n()
  const listRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [unseen, setUnseen] = useState(0)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const lastCount = useRef(messages.length)

  const scrollToBottom = (smooth = false) => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: smooth ? "smooth" : "auto" })
  }

  useLayoutEffect(() => {
    const added = messages.length - lastCount.current
    lastCount.current = messages.length
    if (atBottom) scrollToBottom()
    else if (added > 0) setUnseen((count) => count + added)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  useEffect(() => {
    if (!error) return
    const id = setTimeout(() => setError(null), 3000)
    return () => clearTimeout(id)
  }, [error])

  function onScroll() {
    const list = listRef.current
    if (!list) return
    const bottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40
    setAtBottom(bottom)
    if (bottom) setUnseen(0)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const problem = onSend(draft)
    if (problem) return setError(problem)
    setDraft("")
    setAtBottom(true)
    requestAnimationFrame(() => scrollToBottom(true))
  }

  return (
    <section
      aria-label={t("live.chat.title")}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-white/[.08] bg-surface"
    >
      <header className="flex items-center justify-between border-b border-white/[.06] px-4 py-3">
        <p className="font-display text-sm font-semibold text-text">{t("live.chat.title")}</p>
        <span className="flex items-center gap-2 text-xs text-text-muted">
          {status === "offline" ? (
            <span className="flex items-center gap-1 text-amber" title={t("live.chat.offlineHint")}>
              <WifiOff className="size-3.5" /> {t("live.chat.offline")}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${status === "live" ? "bg-emerald-400" : "bg-amber animate-pulse"}`} />
              {t("live.chat.watching", { count: viewers })}
            </span>
          )}
        </span>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          className="absolute inset-0 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:thin]"
        >
          {messages.map((item) => (
            <Message key={item.id} item={item} />
          ))}
        </div>
        {unseen > 0 && (
          <button
            onClick={() => {
              scrollToBottom(true)
              setUnseen(0)
            }}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-amber px-3 py-1.5 text-xs font-semibold text-bg shadow-lg"
          >
            <ArrowDown className="size-3.5" /> {t("live.chat.new", { count: unseen })}
          </button>
        )}
      </div>

      <footer className="border-t border-white/[.06] p-3">
        {canChat ? (
          <form onSubmit={submit} className="flex items-center gap-2">
            <label className="sr-only" htmlFor="chat-input">{t("live.chat.message")}</label>
            <input
              id="chat-input"
              value={draft}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("live.chat.placeholder")}
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-amber/60"
            />
            <button
              type="submit"
              aria-label={t("live.chat.send")}
              disabled={!draft.trim()}
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber text-bg transition-opacity disabled:opacity-40"
            >
              <SendHorizontal className="size-4" />
            </button>
          </form>
        ) : (
          <button
            onClick={onSignIn}
            className="h-10 w-full rounded-xl border border-white/10 text-sm text-text-secondary hover:border-white/20 hover:text-text"
          >
            {t("live.chat.signIn")}
          </button>
        )}
        {error && <p role="alert" className="mt-2 text-xs text-amber">{error}</p>}
      </footer>
    </section>
  )
}

function Message({ item }: { item: ChatItem }) {
  const { t, locale } = useI18n()
  if (item.kind === "system")
    return (
      <p className="rounded-xl bg-white/[.03] px-3 py-2 text-center text-[11px] leading-5 text-text-muted">
        {item.text}
      </p>
    )
  if (item.kind === "bid")
    return (
      <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${item.isMe ? "border-amber/40 bg-amber/10" : "border-amber/15 bg-amber/[.05]"}`}>
        <Gavel className="size-4 shrink-0 text-amber" />
        <p className="min-w-0 flex-1 truncate text-xs text-text-secondary">
          <span className="font-semibold text-text">{item.isMe ? t("live.chat.you") : item.user}</span>{" "}
          {t("live.chat.placedBid")}
        </p>
        <span className="font-mono text-sm font-bold text-amber">{item.amount}₾</span>
      </div>
    )
  return (
    <div className={`flex gap-2.5 ${item.isMe ? "flex-row-reverse" : ""}`}>
      {item.avatar ? (
        <img src={item.avatar} alt="" className="size-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[10px] font-bold text-amber">
          {(item.user ?? "?").slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className={`flex min-w-0 max-w-[80%] flex-col ${item.isMe ? "items-end" : "items-start"}`}>
        <p className="mb-0.5 flex items-baseline gap-2 text-[11px]">
          <span className={`font-semibold ${item.isMe ? "text-amber" : "text-text"}`}>{item.isMe ? t("live.chat.you") : item.user}</span>
          <span className="text-text-muted">{clockTime(item.at, locale)}</span>
        </p>
        <p
          className={`rounded-2xl px-3 py-1.5 text-[13px] leading-5 [overflow-wrap:anywhere] ${
            item.isMe ? "rounded-tr-md bg-amber text-bg" : "rounded-tl-md bg-surface-2 text-text"
          }`}
        >
          {item.text}
        </p>
      </div>
    </div>
  )
}
