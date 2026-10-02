// Site-wide inertial wheel scrolling (the "igloo" feel): the wheel sets a
// target and the page glides to it with an exponential ease, so each notch
// accelerates softly and coasts out. Only mouse-wheel / trackpad input on
// desktop is smoothed; touch, keyboard, the scrollbar, anchor jumps and
// programmatic scrolls stay native and simply re-sync the glide.
//
// No dependency: it behaves like Lenis' smoothWheel for this app's needs.

const LERP = 0.085 // share of the remaining distance covered per 60fps frame
const WHEEL_MULT = 1 // wheel distance multiplier

let started = false

export function startSmoothScroll() {
  if (started || typeof window === "undefined") return
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
  started = true

  let target = window.scrollY
  let current = window.scrollY
  let lastSet = -1
  let raf: number | null = null
  let lastT = 0

  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight
  const locked = () => {
    const b = document.body
    const h = document.documentElement
    return (
      b.hasAttribute("data-scroll-locked") ||
      getComputedStyle(b).overflowY === "hidden" ||
      getComputedStyle(h).overflowY === "hidden"
    )
  }

  // Can this element (or an ancestor below <body>) scroll in the wheel's direction?
  const nestedCanScroll = (el: Element | null, dy: number, dx: number) => {
    while (el && el !== document.body && el !== document.documentElement) {
      if (el instanceof HTMLElement) {
        if (el.closest("[data-smooth-prevent]")) return true
        const st = getComputedStyle(el)
        const oy = st.overflowY
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) {
          if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true
          if (dy < 0 && el.scrollTop > 0) return true
        }
        const ox = st.overflowX
        if (Math.abs(dx) > Math.abs(dy) && (ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 1) return true
      }
      el = el.parentElement
    }
    return false
  }

  const stop = () => {
    if (raf !== null) cancelAnimationFrame(raf)
    raf = null
    lastT = 0
  }

  const frame = (now: number) => {
    const dt = Math.min(64, now - (lastT || now - 16.667))
    lastT = now
    const k = 1 - Math.pow(1 - LERP, dt / 16.667)
    current += (target - current) * k
    if (Math.abs(target - current) < 0.5) current = target
    lastSet = Math.round(current)
    window.scrollTo(0, current)
    if (current === target) stop()
    else raf = requestAnimationFrame(frame)
  }

  const onWheel = (e: WheelEvent) => {
    if (!finePointer.matches || reduced.matches) return
    if (e.ctrlKey || e.defaultPrevented) return // pinch-zoom / someone else handled it
    if (locked()) return
    const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1
    const dy = e.deltaY * unit
    const dx = e.deltaX * unit
    if (Math.abs(dx) > Math.abs(dy)) return // horizontal gestures stay native
    const t = e.target instanceof Element ? e.target : null
    if (t && (t.closest('[role="dialog"], [data-radix-popper-content-wrapper]') || nestedCanScroll(t, dy, dx))) return
    e.preventDefault()
    if (raf === null) current = target = window.scrollY
    target = Math.max(0, Math.min(maxScroll(), target + dy * WHEEL_MULT))
    if (raf === null) raf = requestAnimationFrame(frame)
  }

  // Any scroll we didn't make (keyboard, scrollbar, scrollTo, anchors) wins.
  const onScroll = () => {
    if (raf === null) {
      current = target = window.scrollY
      return
    }
    if (Math.abs(window.scrollY - lastSet) > 2) {
      stop()
      current = target = window.scrollY
    }
  }

  window.addEventListener("wheel", onWheel, { passive: false })
  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", () => {
    target = Math.min(target, maxScroll())
  })
  // The browser's own smooth behaviour would fight the glide.
  document.documentElement.style.scrollBehavior = "auto"
}
