// Service worker for Web Push. Registered by src/lib/push.ts. Only handles
// push delivery + notification clicks — no offline caching, kept intentionally
// tiny so it never fights the app's own updates.

self.addEventListener("push", (event) => {
  let payload = { title: "AURORA", body: "", link: "/" }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    /* non-JSON payload — fall back to defaults */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { link: payload.link || "/" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const link = event.notification.data?.link || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate?.(link)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link)
    }),
  )
})
