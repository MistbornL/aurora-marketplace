// Small, dependency-free motion helpers used by the landing page.
// Rules (see emil-design-eng): pointer effects are decorative, so they run only
// on devices with a fine pointer and never when the user asks for reduced
// motion; pointer input sets a target and a lerp loop eases toward it, and we
// write `transform` straight onto the element (no React re-renders).
import { useEffect, useState, type RefObject } from "react"

const query = (q: string) => typeof window !== "undefined" && window.matchMedia(q).matches

export function prefersReducedMotion() {
  return query("(prefers-reduced-motion: reduce)")
}

export function hasFinePointer() {
  return query("(hover: hover) and (pointer: fine)")
}

/** True when decorative pointer-driven motion should run. */
export function canUsePointerMotion() {
  return hasFinePointer() && !prefersReducedMotion()
}

/**
 * Runs `frame` every animation frame while the element is on screen, easing a
 * pointer target (-0.5..0.5 on each axis, relative to `area`) toward the value.
 */
function usePointerLoop(
  area: RefObject<HTMLElement | null>,
  frame: (x: number, y: number, hovering: boolean) => void,
  { ease = 0.1 }: { ease?: number } = {},
) {
  useEffect(() => {
    const el = area.current
    if (!el || !canUsePointerMotion()) return
    let tx = 0, ty = 0, cx = 0, cy = 0, hovering = false, raf = 0, visible = true

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      tx = (e.clientX - r.left) / r.width - 0.5
      ty = (e.clientY - r.top) / r.height - 0.5
      hovering = true
    }
    const onLeave = () => { tx = 0; ty = 0; hovering = false }
    const loop = () => {
      cx += (tx - cx) * ease
      cy += (ty - cy) * ease
      if (visible) frame(cx, cy, hovering)
      raf = requestAnimationFrame(loop)
    }
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    io.observe(el)
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerleave", onLeave)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerleave", onLeave)
    }
  }, [area, frame, ease])
}

/** Subtle 3D tilt that follows the pointer (used on the featured lot card). */
export function useTilt(ref: RefObject<HTMLElement | null>, maxDeg = 7) {
  const [frame] = useState(() => (x: number, y: number, hovering: boolean) => {
    const el = ref.current
    if (!el) return
    const s = hovering ? 1.015 : 1
    el.style.transform = `perspective(1100px) rotateY(${x * maxDeg * 2}deg) rotateX(${-y * maxDeg * 2}deg) scale(${s})`
  })
  usePointerLoop(ref, frame, { ease: 0.09 })
}

/** Pulls an element slightly toward the pointer while it's hovered. */
export function useMagnetic(ref: RefObject<HTMLElement | null>, strength = 0.28) {
  const [frame] = useState(() => (x: number, y: number) => {
    const el = ref.current
    if (!el) return
    el.style.translate = `${x * el.offsetWidth * strength}px ${y * el.offsetHeight * strength * 1.4}px`
  })
  usePointerLoop(ref, frame, { ease: 0.16 })
}

/** Moves a soft light (`light`) to follow the pointer inside `area`. */
export function useSpotlight(area: RefObject<HTMLElement | null>, light: RefObject<HTMLElement | null>) {
  const [frame] = useState(() => (x: number, y: number) => {
    const a = area.current, l = light.current
    if (!a || !l) return
    l.style.transform = `translate3d(${(x + 0.5) * a.clientWidth}px, ${(y + 0.5) * a.clientHeight}px, 0) translate(-50%, -50%)`
  })
  usePointerLoop(area, frame, { ease: 0.08 })
}

/** Flips to true once the element scrolls into view (and stays true). */
export function useInView(ref: RefObject<HTMLElement | null>, margin = "0px 0px -80px 0px") {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    if (typeof IntersectionObserver === "undefined") { setInView(true); return }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect() }
    }, { rootMargin: margin, threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, margin, inView])
  return inView
}

/** True once the page has scrolled past `offset` pixels. */
export function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [offset])
  return scrolled
}
