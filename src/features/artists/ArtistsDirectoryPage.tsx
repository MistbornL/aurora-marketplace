import { useMemo, useState } from "react"
import { useCatalog } from "../catalog/catalog-context"
import { useAuth } from "../auth/auth-context"
import { useI18n } from "../../lib/i18n"
import { Button, Card, Input } from "../../components/ui"
import {
  EndingSoonPill,
  LivePill,
  VerifiedBadge,
} from "../../components/artwork/badges"

export default function ArtistsDirectoryPage({
  onArtist,
  onApply,
}: {
  onArtist: (id: string) => void
  onApply: () => void
}) {
  const { t } = useI18n()
  const { artists, artworks } = useCatalog()
  const { role } = useAuth()
  const [query, setQuery] = useState("")
  const list = useMemo(
    () =>
      artists.filter((artist) =>
        `${artist.name} ${artist.location} ${artist.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [artists, query],
  )
  return (
    <main className="min-h-screen bg-bg px-6 py-10 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-amber">
              {t("artists.dir.eyebrow")}
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-text">
              {t("artists.dir.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
              {t("artists.dir.lead")}
            </p>
          </div>
          <div className="w-full sm:w-72">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("artists.dir.search")}
            />
          </div>
        </div>
        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm text-text-secondary">{t("artists.dir.count", { count: list.length })}</p>
          {role !== "artist" && role !== "admin" && (
            <Button variant="outline" size="sm" onClick={onApply}>
              {t("artists.dir.sell")}
            </Button>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((artist) => {
            const artistWorks = artworks.filter(
              (art) => art.artistId === artist.id,
            )
            const live = artistWorks.find((art) => art.isLive)
            const endingSoon = artistWorks.find(
              (art) => art.isLive && art.timeLeftSecs <= 2 * 3600,
            )
            return (
              <Card
                key={artist.id}
                className="group overflow-hidden border border-border bg-surface ring-0"
              >
                <div className="relative h-32 overflow-hidden bg-surface-2">
                  <img
                    src={artist.banner}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent" />
                  {endingSoon ? (
                    <div className="absolute left-3 top-3">
                      <EndingSoonPill small />
                    </div>
                  ) : live ? (
                    <div className="absolute left-3 top-3">
                      <LivePill small />
                    </div>
                  ) : null}
                </div>
                <div className="relative p-5 pt-0">
                  <img
                    src={artist.avatar}
                    alt={artist.name}
                    loading="lazy"
                    className="-mt-10 size-20 rounded-full border-[3px] border-surface object-cover"
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <h2 className="font-display text-xl font-bold text-text">
                      {artist.name}
                    </h2>
                    {artist.verified && <VerifiedBadge />}
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    📍 {artist.location}
                  </p>
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-text-secondary">
                    {artist.bio}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <span className="text-xs text-text-muted">
                      {t("artists.dir.availableWorks", { count: artistWorks.length })}
                    </span>
                    <Button size="sm" onClick={() => onArtist(artist.id)}>
                      {t("artists.dir.viewProfile")}
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
        {list.length === 0 && (
          <div className="py-20 text-center text-sm text-text-muted">
            {t("artists.dir.noResults")}
          </div>
        )}
      </div>
    </main>
  )
}
