import { useEffect, useRef, useState } from "react"
import { Check, Copy, Download, Share2 } from "lucide-react"
import { Button, Card } from "../../components/ui"
import { categoryLabel, useI18n } from "../../lib/i18n"
import { notify } from "../../lib/notify"
import { extractPalette, loadImage } from "../../lib/palette"

export type ArtistCardData = {
  id: string
  name: string
  location: string
  avatar?: string | null
  images: string[]
  categories: string[]
  works: number
  bids: number
  bestBid: number
}

const W = 1080
const H = 1920
const SITE = "tsiskariart.ge"

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Draws the 1080×1920 story card. Plain canvas: no screenshot library, works offline. */
async function draw(canvas: HTMLCanvasElement, data: ArtistCardData, labels: Record<string, string>) {
  await Promise.all([
    document.fonts.load('600 80px "Fraunces Variable"'),
    document.fonts.load('400 80px "DM Medea"', data.name),
    document.fonts.load('500 30px "Instrument Sans Variable"', 'Aa'), document.fonts.load('500 30px "Noto Sans Georgian Variable"', data.location || 'ა'),
  ]).catch(() => undefined)
  const [avatar, ...works] = await Promise.all([loadImage(data.avatar ?? ""), ...data.images.slice(0, 3).map(loadImage)])
  const palette = extractPalette(works.length ? works : [avatar])
  // Accent for numbers and link: the brightest, most colourful swatch, so it reads on the dark card.
  const lum = (c: string) => { const n = parseInt(c.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 }
  const accent = [...palette].filter((c) => lum(c) > 0.5).sort((a, b) => lum(b) - lum(a))[0] ?? "#f6a87b"
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  canvas.width = W
  canvas.height = H

  // Background: the artist's own colours, melted into the brand's dusk.
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, "#1b1620")
  bg.addColorStop(1, "#120e15")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 520, 40, W / 2, 520, 900)
  glow.addColorStop(0, `${palette[0]}66`)
  glow.addColorStop(0.6, `${palette[1] ?? palette[0]}22`)
  glow.addColorStop(1, "transparent")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const display = '"Fraunces Variable","DM Medea","Noto Serif Georgian Variable",Georgia,serif'
  const sans = '"Instrument Sans Variable","Noto Sans Georgian Variable",system-ui,sans-serif'
  ctx.textAlign = "center"

  // Wordmark
  ctx.fillStyle = "#f4ece1"
  ctx.font = `700 44px ${display}`
  ctx.letterSpacing = "10px"
  ctx.fillText("TSISKARI", W / 2, 120)
  ctx.letterSpacing = "0px"

  // Avatar
  const cx = W / 2
  const cy = 360
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, 150, 0, Math.PI * 2)
  ctx.clip()
  if (avatar) {
    const s = Math.max(300 / avatar.width, 300 / avatar.height)
    ctx.drawImage(avatar, cx - (avatar.width * s) / 2, cy - (avatar.height * s) / 2, avatar.width * s, avatar.height * s)
  } else {
    ctx.fillStyle = "#2b2230"
    ctx.fillRect(cx - 150, cy - 150, 300, 300)
    ctx.fillStyle = accent
    ctx.font = `700 120px ${display}`
    ctx.fillText(data.name.slice(0, 2).toUpperCase(), cx, cy + 42)
  }
  ctx.restore()
  ctx.lineWidth = 6
  ctx.strokeStyle = accent
  ctx.beginPath()
  ctx.arc(cx, cy, 156, 0, Math.PI * 2)
  ctx.stroke()

  // Name + place
  ctx.fillStyle = "#f4ece1"
  // DM Medea (Georgian display) has tall ascenders and descenders: smaller and airier.
  const ka = /[\u10D0-\u10FF]/.test(data.name)
  const lineH = ka ? 150 : 118
  ctx.font = ka ? `400 78px ${display}` : `600 92px ${display}`
  const lines = fit(ctx, data.name, 900)
  lines.forEach((l, i) => ctx.fillText(l, cx, 610 + i * lineH))
  const afterName = 610 + (lines.length - 1) * lineH + (ka ? 40 : 0)
  ctx.fillStyle = "#b9aea6"
  ctx.font = `500 36px ${sans}`
  if (data.location) ctx.fillText(data.location, cx, afterName + 70)

  // Works, framed
  const top = afterName + (ka ? 150 : 140)
  const frames = works.filter(Boolean) as HTMLImageElement[]
  if (frames.length) {
    const fw = (frames.length === 1 ? 460 : frames.length === 2 ? 380 : 290) * (ka ? 0.84 : 1)
    const gap = 36
    const total = frames.length * fw + (frames.length - 1) * gap
    frames.forEach((img, i) => {
      const x = cx - total / 2 + i * (fw + gap)
      const fh = fw * 1.25
      ctx.fillStyle = "#efe6d8"
      roundRect(ctx, x - 14, top - 14, fw + 28, fh + 28, 4)
      ctx.fill()
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, top, fw, fh)
      ctx.clip()
      const s = Math.max(fw / img.width, fh / img.height)
      ctx.drawImage(img, x + fw / 2 - (img.width * s) / 2, top + fh / 2 - (img.height * s) / 2, img.width * s, img.height * s)
      ctx.restore()
    })
  }
  const framesH = frames.length ? (frames.length === 1 ? 460 : frames.length === 2 ? 380 : 290) * (ka ? 0.84 : 1) * 1.25 + 28 : 0

  // Palette
  let y = top + framesH + (ka ? 90 : 110)
  ctx.fillStyle = "#b9aea6"
  ctx.font = `600 28px ${sans}`
  ctx.letterSpacing = "6px"
  ctx.fillText(labels.palette.toUpperCase(), cx, y)
  ctx.letterSpacing = "0px"
  const sw = ka ? 120 : 150
  const sg = 22
  const total = palette.length * sw + (palette.length - 1) * sg
  palette.forEach((c, i) => {
    ctx.fillStyle = c
    roundRect(ctx, cx - total / 2 + i * (sw + sg), y + 34, sw, sw, 30)
    ctx.fill()
  })
  y += 34 + sw + (ka ? 60 : 70)

  // Categories
  if (data.categories.length) {
    ctx.fillStyle = "#f4ece1"
    ctx.font = `500 38px ${sans}`
    ctx.fillText(data.categories.join("  ·  "), cx, y)
    y += 40
  }

  // Numbers
  y += ka ? 40 : 60
  const stats = [
    { v: String(data.works), l: labels.works },
    { v: String(data.bids), l: labels.bids },
    { v: data.bestBid ? `${data.bestBid.toLocaleString()}₾` : "—", l: labels.best },
  ]
  stats.forEach((s, i) => {
    const x = W / 2 + (i - 1) * 300
    ctx.fillStyle = accent
    ctx.font = `700 80px ${display}`
    ctx.fillText(s.v, x, y + 40)
    ctx.fillStyle = "#b9aea6"
    ctx.font = `500 28px ${sans}`
    ctx.fillText(s.l, x, y + 92)
  })

  // Footer
  ctx.fillStyle = "#f4ece1"
  ctx.font = /[\u10D0-\u10FF]/.test(labels.tagline) ? `600 34px "Noto Serif Georgian Variable",Georgia,serif` : `600 40px ${display}`
  ctx.fillText(labels.tagline, cx, H - 150)
  ctx.fillStyle = accent
  ctx.font = `600 36px ${sans}`
  ctx.fillText(`${SITE}/artists/${data.id.slice(0, 8)}`, cx, H - 90)
}

export function ArtistCard({ data }: { data: ArtistCardData }) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)
  const key = JSON.stringify(data)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const labels = {
      palette: t("studio.card.palette"),
      works: t("studio.card.works"),
      bids: t("studio.card.bids"),
      best: t("studio.card.best"),
      tagline: t("studio.card.tagline"),
    }
    void draw(canvas, { ...data, categories: data.categories.map((c) => categoryLabel(t, c)) }, labels)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, t])

  const blob = () => new Promise<Blob | null>((resolve) => canvasRef.current?.toBlob(resolve, "image/png") ?? resolve(null))
  const link = `https://${SITE}/artists/${data.id}`

  async function download() {
    const file = await blob()
    if (!file) return
    const url = URL.createObjectURL(file)
    const a = document.createElement("a")
    a.href = url
    a.download = "tsiskari-artist-card.png"
    a.click()
    URL.revokeObjectURL(url)
  }
  async function share() {
    const file = await blob()
    if (!file) return
    const f = new File([file], "tsiskari-artist-card.png", { type: "image/png" })
    if (navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: data.name, url: link })
      } catch {
        /* cancelled */
      }
    } else void download()
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      notify(t("studio.card.copied"), link)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      notify(t("studio.card.copyFailed"), link, "error")
    }
  }

  return (
    <Card className="mb-6 grid gap-6 border-border bg-surface p-5 sm:grid-cols-[220px_1fr] sm:items-center ring-0">
      <canvas ref={canvasRef} className="mx-auto aspect-[9/16] w-full max-w-[220px] rounded-xl border border-white/10 bg-surface-2 shadow-xl" />
      <div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-amber">{t("studio.card.eyebrow")}</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-text">{t("studio.card.title")}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">{t("studio.card.text")}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => void share()} className="gap-2">
            <Share2 className="size-4" /> {t("studio.card.share")}
          </Button>
          <Button variant="outline" onClick={() => void download()} className="gap-2">
            <Download className="size-4" /> {t("studio.card.download")}
          </Button>
          <Button variant="outline" onClick={() => void copy()} className="gap-2">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {t("studio.card.copy")}
          </Button>
        </div>
      </div>
    </Card>
  )
}
