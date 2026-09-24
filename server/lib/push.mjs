// Web Push delivery for notifications — free, no third-party account. Browsers
// route pushes through their own vendor push services (Chrome→FCM, Firefox→
// Mozilla…) using a VAPID keypair we generate ourselves (see .env.example).
//
// The database queues important notifications in public.push_outbox (see
// migration 20260930_push_notifications.sql). This worker sends them every
// 15 seconds to every subscription the person has registered (they may have
// more than one device/browser). A dead subscription (410/404) is removed.
import "./env.mjs"
import webPush from "web-push"
import { T, fill } from "./email.mjs"

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || ""
const privateKey = process.env.VAPID_PRIVATE_KEY || ""
const subject = process.env.VAPID_SUBJECT || "mailto:hello@tsiskariart.ge"

export const pushConfigured = Boolean(url && serviceKey && publicKey && privateKey)

if (pushConfigured) webPush.setVapidDetails(subject, publicKey, privateKey)

const serviceHeaders = () =>
  serviceKey.startsWith("sb_secret_")
    ? { apikey: serviceKey, "Content-Type": "application/json" }
    : { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }

async function sendBatch() {
  const response = await fetch(
    `${url}/rest/v1/push_outbox?status=eq.pending&attempts=lt.5&order=created_at.asc&limit=20`,
    { headers: serviceHeaders() },
  )
  if (!response.ok) throw new Error(`push outbox read failed (${response.status})`)
  const rows = await response.json()
  for (const row of rows) {
    const dict = T[row.locale] ?? T.ka
    const [titleT, bodyT] = dict[row.kind] ?? T.en[row.kind] ?? ["TSISKARI", ""]
    const payload = JSON.stringify({
      title: fill(titleT, row.data),
      body: fill(bodyT, row.data),
      link: row.link || "/",
    })

    const subs = await fetch(
      `${url}/rest/v1/push_subscriptions?user_id=eq.${row.user_id}&select=id,endpoint,p256dh,auth_key`,
      { headers: serviceHeaders() },
    ).then((res) => (res.ok ? res.json() : []))

    let anySent = false
    for (const sub of subs) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload,
        )
        anySent = true
      } catch (error) {
        // 404/410 = the browser dropped the subscription (uninstalled, cleared data…) — forget it.
        if (error.statusCode === 404 || error.statusCode === 410) {
          await fetch(`${url}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
            method: "DELETE",
            headers: serviceHeaders(),
          }).catch(() => undefined)
        }
      }
    }

    const patch = anySent
      ? { status: "sent", sent_at: new Date().toISOString(), attempts: row.attempts + 1 }
      : {
          status: row.attempts + 1 >= 5 ? "failed" : "pending",
          attempts: row.attempts + 1,
          last_error: subs.length ? "all subscriptions failed" : "no subscriptions left",
        }
    await fetch(`${url}/rest/v1/push_outbox?id=eq.${row.id}`, {
      method: "PATCH",
      headers: serviceHeaders(),
      body: JSON.stringify(patch),
    }).catch(() => undefined)
  }
}

export function startPushWorker() {
  if (!pushConfigured) return
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      await sendBatch()
    } catch (error) {
      console.error("push worker:", error.message)
    } finally {
      running = false
    }
  }
  setInterval(tick, 15_000)
  void tick()
  console.log("Push notifications: on")
}
