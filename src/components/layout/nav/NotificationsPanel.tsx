import { useEffect, useState } from "react"
import { BellOff, BellRing } from "lucide-react"
import { useI18n } from "../../../lib/i18n"
import { timeAgo, notify, errorMessage } from "../../../lib/notify"
import { enablePush, isPushEnabled, pushPermission, pushSupported } from "../../../lib/push"
import { Panel } from "./Panel"
import type { NavNotification } from "./use-notifications"

function PushToggle() {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!pushSupported()) return setEnabled(null)
    void isPushEnabled().then(setEnabled)
  }, [])

  if (!pushSupported() || enabled === null) return null
  if (enabled)
    return (
      <p className="flex items-center gap-1.5 border-t border-white/[.06] px-3 py-2.5 text-xs text-text-muted">
        <BellRing className="size-3.5 text-amber" /> {t("layout.notifications.pushOn")}
      </p>
    )

  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (pushPermission() === "denied") return notify(t("layout.notifications.pushDenied"), "", "error")
        setBusy(true)
        try {
          const ok = await enablePush()
          if (ok) setEnabled(true)
          else notify(t("layout.notifications.pushDenied"), "", "error")
        } catch (error) {
          notify(t("layout.notifications.pushFailed"), errorMessage(error), "error")
        } finally {
          setBusy(false)
        }
      }}
      className="flex w-full items-center gap-1.5 border-t border-white/[.06] px-3 py-2.5 text-left text-xs text-amber hover:bg-white/[.05] disabled:opacity-60"
    >
      <BellRing className="size-3.5" /> {t("layout.notifications.enablePush")}
    </button>
  )
}

export function NotificationsPanel({
  items,
  unread,
  onRead,
  onReadAll,
}: {
  items: NavNotification[]
  unread: number
  onRead: (id: number) => void
  onReadAll: () => void
}) {
  const { t } = useI18n()
  return (
    <Panel label={t("layout.nav.notifications")} className="w-[min(22rem,calc(100vw-2rem))]">
      <div className="flex items-center justify-between px-3 pb-2 pt-2.5">
        <p className="font-display text-sm font-semibold text-text">
          {t("layout.nav.notifications")}
          {unread > 0 && (
            <span className="ml-2 rounded-full bg-amber/15 px-1.5 py-0.5 text-[10px] font-bold text-amber">
              {t("layout.notifications.newCount", { count: unread })}
            </span>
          )}
        </p>
        {unread > 0 && (
          <button onClick={onReadAll} className="text-xs text-amber hover:text-amber/80">
            {t("layout.notifications.markAllRead")}
          </button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {items.length ? (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => onRead(item.id)}
              className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[.05]"
            >
              <span
                className={`mt-1.5 size-2 shrink-0 rounded-full ${
                  item.unread ? "bg-amber shadow-[0_0_8px_rgba(232,184,75,0.6)]" : "bg-white/10"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${item.unread ? "font-medium text-text" : "text-text-secondary"}`}>
                  {item.titleKey ? t(item.titleKey, item.vars) : item.title}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-text-muted">
                  {item.detailKey ? t(item.detailKey, item.vars) : item.detail}
                </span>
                <span className="mt-1 block text-[10px] uppercase tracking-wide text-text-muted/70">
                  {timeAgo(new Date(item.at).toISOString())}
                </span>
              </span>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-sm text-text-muted">
            <BellOff className="size-5" />
            {t("layout.notifications.empty")}
          </div>
        )}
      </div>
      <PushToggle />
    </Panel>
  )
}
