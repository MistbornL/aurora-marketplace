import { useI18n } from "../../lib/i18n"
import { DiscoverSection } from "./DiscoverSection"
import { PageBackdrop } from "../../components/layout/PageBackdrop"

export default function DiscoverPage({
  onArtwork,
  onArtist,
}: {
  onArtwork: (id: string) => void
  onArtist: (id: string) => void
}) {
  const { t } = useI18n()
  return (
    <main className="relative isolate min-h-screen bg-bg">
      <PageBackdrop src="/img/banner-discover.webp" position="50% 40%" />
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 lg:px-10">
        <DiscoverSection onArtwork={onArtwork} onArtist={onArtist} title={t("catalog.discover.allAuctions")} />
      </div>
    </main>
  )
}
