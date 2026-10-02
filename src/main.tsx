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
