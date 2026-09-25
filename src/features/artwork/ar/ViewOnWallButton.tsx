import { lazy, Suspense, useMemo, useState } from "react"
import { Frame } from "lucide-react"
import { artworkSizeCm, formatSize } from "../../../lib/artwork-size"
import { useI18n } from "../../../lib/i18n"
import type { Artwork } from "../../../types"

const ArViewer = lazy(() => import("./ArViewer"))

/** "View on your wall": only shown when we know the artwork's real size. */
export function ViewOnWallButton({ art }: { art: Artwork }) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(false)
  const size = useMemo(() => artworkSizeCm(art), [art])
  if (!size || !art.image) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press group flex w-full items-center gap-3 rounded-2xl border border-white/[.08] bg-white/[.03] px-4 py-3 text-left transition-colors hover:border-amber/40 hover:bg-amber/[.05]"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber/12 text-amber">
          <Frame className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-text">{t("artwork.ar.button")}</span>
          <span className="block text-xs text-text-muted">
            {t("artwork.ar.buttonHint", {
              size: formatSize(size.width, size.height, null, lang === "ka" ? "სმ" : "cm"),
            })}
          </span>
        </span>
        <span className="text-xs font-medium text-amber transition-transform group-hover:translate-x-0.5">AR</span>
      </button>

      {open && (
        <Suspense fallback={null}>
          <ArViewer image={art.image} title={art.title} size={size} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
