/** Brand colours, used when an image can't be read (cross-origin or still loading). */
export const FALLBACK_PALETTE = ["#f6a87b", "#c0627a", "#5a2f5e", "#ffd38a", "#3a2748"]

/** Loads an image for canvas use; resolves null if it can't be loaded. */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`

/**
 * The most characteristic colours across a set of images: each image is shrunk,
 * pixels are bucketed, near-black / near-white / grey pixels are ignored, and
 * the biggest buckets that are visibly different from each other win.
 */
export function extractPalette(images: Array<HTMLImageElement | null>, count = 5): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  try {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 48
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return FALLBACK_PALETTE.slice(0, count)
    for (const img of images) {
      if (!img) continue
      ctx.clearRect(0, 0, 48, 48)
      ctx.drawImage(img, 0, 0, 48, 48)
      const { data } = ctx.getImageData(0, 0, 48, 48) // throws if the image is cross-origin
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
        if (a < 200) continue
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        if (max < 38 || min > 225 || max - min < 22) continue // black, white, grey
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
        const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
        bucket.n++
        bucket.r += r
        bucket.g += g
        bucket.b += b
        buckets.set(key, bucket)
      }
    }
  } catch {
    return FALLBACK_PALETTE.slice(0, count)
  }
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((v) => [v.r / v.n, v.g / v.n, v.b / v.n])
  const picked: number[][] = []
  for (const c of ranked) {
    if (picked.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) > 70)) picked.push(c)
    if (picked.length === count) break
  }
  if (!picked.length) return FALLBACK_PALETTE.slice(0, count)
  const out = picked.map((c) => hex(c[0], c[1], c[2]))
  for (const f of FALLBACK_PALETTE) if (out.length < count && !out.includes(f)) out.push(f)
  return out
}
