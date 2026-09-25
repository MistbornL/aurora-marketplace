// Loaded on demand (React.lazy) so three.js and model-viewer only download
// when someone asks to see a painting on their wall.
import "@google/model-viewer"
import { useEffect, useRef, useState } from "react"
import { Loader2, Smartphone } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui"
import { formatSize, type SizeCm } from "../../../lib/artwork-size"
import { useI18n } from "../../../lib/i18n"
import { buildArtworkGlb } from "./framed-model"
import type { ModelViewerElement } from "./model-viewer"

export default function ArViewer({
  image,
  title,
  size,
  onClose,
}: {
  image: string
  title: string
  size: SizeCm
  onClose: () => void
}) {
  const { t, lang } = useI18n()
  const viewer = useRef<ModelViewerElement>(null)
  const [model, setModel] = useState<{ url: string; poster: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [canAR, setCanAR] = useState<boolean | null>(null)
  const sizeLabel = formatSize(size.width, size.height, null, lang === "ka" ? "სმ" : "cm")

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    buildArtworkGlb(image, size)
      .then((result) => {
        if (cancelled) return URL.revokeObjectURL(result.url)
        url = result.url
        setModel(result)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [image, size])

  useEffect(() => {
    const el = viewer.current
    if (!el || !model) return
    const onLoad = () => setCanAR(Boolean(el.canActivateAR))
    const onError = () => setFailed(true)
    el.addEventListener("load", onLoad)
    el.addEventListener("error", onError)
    return () => {
      el.removeEventListener("load", onLoad)
      el.removeEventListener("error", onError)
    }
  }, [model])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl gap-4 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t("artwork.ar.title")}</DialogTitle>
          <DialogDescription>
            {title} · {t("artwork.ar.trueSize", { size: sizeLabel })}
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/5] max-h-[62dvh] w-full overflow-hidden rounded-2xl bg-[radial-gradient(120%_80%_at_50%_0%,#26221a_0%,#141417_55%,#0f0f12_100%)] ring-1 ring-white/[.08]">
          {model && !failed && (
            <model-viewer
              ref={viewer}
              src={model.url}
              poster={model.poster}
              alt={title}
              ar=""
              ar-modes="webxr scene-viewer quick-look"
              ar-placement="wall"
              ar-scale="fixed"
              camera-controls=""
              disable-zoom=""
              touch-action="pan-y"
              camera-orbit="-20deg 82deg auto"
              min-camera-orbit="-60deg 60deg auto"
              max-camera-orbit="60deg 110deg auto"
              shadow-intensity="1"
              shadow-softness="0.9"
              exposure="1.05"
              environment-image="neutral"
              interaction-prompt="none"
              style={{ width: "100%", height: "100%", background: "transparent" }}
            >
              <button
                slot="ar-button"
                type="button"
                className="press absolute bottom-4 left-1/2 flex h-12 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-amber px-6 text-[15px] font-semibold text-bg shadow-[0_12px_34px_-10px_rgba(232,184,75,.7)]"
              >
                <Smartphone className="size-4" />
                {t("artwork.ar.place")}
              </button>
            </model-viewer>
          )}

          {!model && !failed && (
            <div className="absolute inset-0 grid place-items-center text-sm text-text-muted">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> {t("artwork.ar.loading")}
              </span>
            </div>
          )}
          {failed && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-text-secondary">
              {t("artwork.ar.error")}
            </div>
          )}
        </div>

        {canAR === false && (
          <p className="flex items-start gap-2 text-[13px] leading-5 text-text-secondary">
            <Smartphone className="mt-0.5 size-4 shrink-0 text-amber" />
            {t("artwork.ar.phoneHint")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
