/**
 * App-wide notification: shows a toast and adds an entry to the bell menu
 * (the Nav listens for this event).
 */
import { tr, trError } from "./i18n"

export type NotifyVariant = "success" | "error"

export function notify(
  title: string,
  detail: string,
  variant: NotifyVariant = "success",
) {
  window.dispatchEvent(
    new CustomEvent("aurora:notification", {
      detail: { title, detail, variant },
    }),
  )
}

/** Error text for the user, in their language when we recognise the message. */
export const errorMessage = (error: unknown, fallback?: string) =>
  error instanceof Error ? trError(error.message) : (fallback ?? tr("common.pleaseTryAgain"))

export function timeAgo(iso: string) {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 45) return tr("common.justNow")
  if (secs < 3600) return tr("common.minAgo", { count: Math.round(secs / 60) })
  if (secs < 86400) return tr("common.hoursAgo", { count: Math.round(secs / 3600) })
  return tr("common.daysAgo", { count: Math.round(secs / 86400) })
}
