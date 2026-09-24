import { supabase } from "./supabase"

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** Whether this browser + build can even offer push (before asking permission). */
export function pushSupported() {
  return Boolean(VAPID_PUBLIC_KEY) && "serviceWorker" in navigator && "PushManager" in window
}

/** "default" (never asked), "granted", or "denied" — mirrors Notification.permission. */
export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported"
  return Notification.permission
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

/** Registers the service worker, asks permission, subscribes, and saves it server-side. */
export async function enablePush() {
  if (!pushSupported() || !supabase) throw new Error("Push isn't supported in this browser.")
  const registration = await navigator.serviceWorker.register("/sw.js")
  const permission = await Notification.requestPermission()
  if (permission !== "granted") return false

  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    }))

  const json = subscription.toJSON()
  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
  })
  if (error) throw error
  return true
}

/** Unsubscribes this browser and removes the server-side registration. */
export async function disablePush() {
  if (!("serviceWorker" in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration("/sw.js")
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  if (supabase) await supabase.rpc("unregister_push_subscription", { p_endpoint: endpoint })
}

/** True if this browser already has an active push subscription. */
export async function isPushEnabled() {
  if (!pushSupported()) return false
  const registration = await navigator.serviceWorker.getRegistration("/sw.js")
  return Boolean(await registration?.pushManager.getSubscription())
}
