import { useState } from "react"
import { Expand, X } from "lucide-react"
import { useI18n } from "../../../lib/i18n"
import { EndingSoonPill, LivePill, OnApprovalPill, UpcomingPill } from "../../../components/artwork/badges"

/** Main image + thumbnails, with a full-screen viewer on click. */
export function ArtworkGallery({
  title,
  images,
  status,
}: {
  title: string
  images: string[]
  status: "live" | "ending" | "ended" | "upcoming" | "approval"
}) {
  const { t } = useI18n()
  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const src = images[active] ?? images[0]

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => setZoomed(true)}
        aria-label={t("artwork.gallery.fullScreen")}
        className="group relative aspect-square overflow-hidden rounded-3xl bg-surface-2 sm:aspect-[4/5]"
      >
        <img
          src={src}
          alt={title}
          fetchPriority="high"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
        />
        <div className="absolute left-4 top-4">
          {status === "live" && <LivePill />}
          {status === "ending" && <EndingSoonPill />}
          {status === "upcoming" && <UpcomingPill label={t("artwork.gallery.upcoming")} />}
          {status === "approval" && <OnApprovalPill />}
          {status === "ended" && (
            <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary backdrop-blur">
              {t("artwork.gallery.ended")}
            </span>
          )}
        </div>
        <span className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] text-text-secondary opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <Expand className="size-3.5" /> {t("artwork.gallery.fullScreen")}
        </span>
      </button>

      {images.length > 1 && (
        <div className="flex gap-2.5">
          {images.slice(0, 5).map((image, index) => (
            <button
              key={image + index}
              onClick={() => setActive(index)}
              aria-label={t("artwork.gallery.showImage", { index: index + 1 })}
              className={`size-[72px] shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                index === active
                  ? "border-amber"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoomed && (
        <div
          role="dialog"
          aria-label={title}
          onClick={() => setZoomed(false)}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in-0"
        >
          <img src={src} alt={title} className="max-h-full max-w-full rounded-xl object-contain" />
          <button
            aria-label={t("common.close")}
            className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-white/10 text-text hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  )
}
