import React from "react"
import ReactDOM from "react-dom/client"
import App from "./app/App"
import { AppProviders } from "./app/providers"
import "./styles/globals.css"
import { startSmoothScroll } from "./lib/smooth-scroll"

startSmoothScroll()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
)

// Lift the first-paint splash once the app has rendered and fonts are ready
// (shown for at least a moment so it never just flashes).
const boot = document.getElementById("boot")
if (boot) {
  const started = performance.now()
  const ready = Promise.race([
    document.fonts?.ready ?? Promise.resolve(),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ])
  void ready.then(() => {
    const wait = Math.max(0, 900 - (performance.now() - started))
    setTimeout(() => {
      boot.classList.add("done")
      setTimeout(() => boot.remove(), 600)
    }, wait)
  })
}
