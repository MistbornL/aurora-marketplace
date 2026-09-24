import { useI18n } from "../../lib/i18n"
import { DiscoverSection } from "./DiscoverSection"

export default function DiscoverPage({
  onArtwork,
  onArtist,
}: {
  onArtwork: (id: string) => void
  onArtist: (id: string) => void
}) {
  const { t } = useI18n()
  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-10">
        <DiscoverSection onArtwork={onArtwork} onArtist={onArtist} title={t("catalog.discover.allAuctions")} />
      </div>
    </main>
  )
}
