import { useSavedIds, setSaved } from "../../features/catalog/saved"
import { useI18n } from "../../lib/i18n"
import { C } from "../../lib/theme"
import { Button } from "../ui"

export function HeartButton({
  size = 28,
  artworkId,
  artworkTitle,
}: {
  size?: number
  artworkId: string
  artworkTitle?: string
}) {
  const { t } = useI18n()
  const on = useSavedIds().includes(artworkId)

  function toggleSaved() {
    setSaved(artworkId, !on, artworkTitle)
  }
  return (
    <Button
      onClick={toggleSaved}
      aria-label={on ? t("layout.heart.remove") : t("layout.heart.save")}
      aria-pressed={on}
      variant="secondary"
      className="rounded-full active:scale-90"
      style={{ width: size, height: size, backdropFilter: "blur(8px)" }}
    >
      <svg
        width={14}
        height={14}
        viewBox="0 0 14 14"
        fill={on ? C.amber : "none"}
        stroke={on ? C.amber : C.textSec}
        strokeWidth="1.4"
      >
        <path d="M7 12S1.5 8 1.5 4.5a3 3 0 015.5-1.66A3 3 0 0112.5 4.5C12.5 8 7 12 7 12z" />
      </svg>
    </Button>
  )
}

