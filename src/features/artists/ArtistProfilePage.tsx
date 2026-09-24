import { useState } from "react"
import { ChevronLeft, MapPin, Share2, UserCheck, UserPlus } from "lucide-react"
import { ArtworkCard } from "../../components/artwork/ArtworkCard"
import { VerifiedBadge } from "../../components/artwork/badges"
import { Button } from "../../components/ui"
import { useI18n } from "../../lib/i18n"
import { notify } from "../../lib/notify"
import { useCatalog } from "../catalog/catalog-context"

type Tab = "live" | "past" | "about"

export default function ArtistProfilePage({
  artistId,
  onBack,
  onArtworkClick,
}: {
  artistId: string
  onBack: () => void
  onArtworkClick: (id: string) => void
}) {
  const { t } = useI18n()
  const { artists, artworks } = useCatalog()
  const artist = artists.find((a) => a.id === artistId)
  const works = artworks.filter((artwork) => artwork.artistId === artistId)
  const isOpen = (art: (typeof works)[number]) =>
    (art.isLive && art.timeLeftSecs > 0) || art.status === "upcoming"
  const live = works.filter(isOpen)
  const past = works.filter((art) => !isOpen(art))
  const [tab, setTab] = useState<Tab>(live.length ? "live" : past.length ? "past" : "about")
  const [following, setFollowing] = useState(false)

  if (!artist)
    return (
      <div className="grid min-h-[60vh] place-items-center gap-3 bg-bg text-sm text-text-secondary">
        <p>{t("artists.profile.notFound")}</p>
        <Button variant="outline" onClick={onBack}>
          {t("artists.profile.goBack")}
        </Button>
      </div>
    )

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: artist!.name, url: location.href })
      else {
        await navigator.clipboard.writeText(location.href)
        notify(t("artists.profile.linkCopied"), t("artists.profile.shareDetail", { name: artist!.name }))
      }
    } catch {
      /* dismissed */
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "live", label: t("artists.profile.liveNow"), count: live.length },
    { key: "past", label: t("artists.profile.tabPast"), count: past.length },
    { key: "about", label: t("artists.profile.tabAbout") },
  ]

  return (
    <main className="min-h-screen bg-bg pb-20">
      {/* Banner */}
      <div className="relative h-56 bg-surface-2 sm:h-72">
        {artist.banner && (
          <img src={artist.banner} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-transparent to-bg" />
        <button
          onClick={onBack}
          className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-[13px] text-text backdrop-blur hover:bg-black/70 sm:left-6 lg:left-10"
        >
          <ChevronLeft className="size-4" /> {t("common.back")}
        </button>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <div className="-mt-16 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <img
              src={artist.avatar}
              alt={artist.name}
              className="size-28 shrink-0 rounded-full border-4 border-bg object-cover ring-2 ring-amber/40"
            />
            <div className="pb-1">
              <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-text">
                {artist.name}
                {artist.verified && <VerifiedBadge />}
              </h1>
              {artist.location && (
                <p className="mt-1 flex items-center gap-1 text-sm text-text-muted">
                  <MapPin className="size-3.5" /> {artist.location}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setFollowing((value) => !value)
                if (!following) notify(t("artists.profile.followToastTitle"), t("artists.profile.followToastDetail", { name: artist.name }))
              }}
              variant={following ? "outline" : "default"}
              className="h-10 gap-2 rounded-full px-5"
            >
              {following ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
              {following ? t("artists.profile.following") : t("artists.profile.follow")}
            </Button>
            <Button
              variant="outline"
              onClick={() => void share()}
              aria-label={t("artists.profile.share")}
              className="size-10 rounded-full p-0"
            >
              <Share2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* Stats + bio */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <p className="max-w-2xl text-[15px] leading-7 text-text-secondary">
            {artist.bio || t("artists.profile.noBio")}
          </p>
          <dl className="grid grid-cols-3 gap-3">
            {[
              { label: t("artists.profile.followers"), value: artist.followers >= 1000 ? `${(artist.followers / 1000).toFixed(1)}K` : artist.followers },
              { label: t("artists.profile.liveNow"), value: live.length },
              { label: t("artists.profile.sold"), value: artist.sold },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/[.06] bg-surface/60 px-3 py-3 text-center">
                <dd className="font-display text-xl font-bold text-text">{stat.value}</dd>
                <dt className="mt-0.5 text-[11px] text-text-muted">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>

        {artist.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {artist.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/[.08] px-3 py-1 text-xs text-text-muted">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div role="tablist" className="mt-10 flex gap-1 border-b border-white/[.08]">
          {tabs.map((item) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 pb-3 text-sm transition-colors ${
                tab === item.key
                  ? "border-amber text-text"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {item.label}
              {item.count !== undefined && (
                <span className="rounded-full bg-white/[.06] px-1.5 text-[11px] text-text-secondary">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="pt-8">
          {tab !== "about" ? (
            (tab === "live" ? live : past).length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {(tab === "live" ? live : past).map((art) => (
                  <ArtworkCard
                    key={art.id}
                    art={art}
                    onClick={() => onArtworkClick(art.id)}
                    onArtistClick={() => undefined}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-text-muted">
                {tab === "live"
                  ? t("artists.profile.noLive", { name: artist.name })
                  : t("artists.profile.noPast")}
              </p>
            )
          ) : (
            <div className="max-w-2xl space-y-4 text-[15px] leading-7 text-text-secondary">
              <p>{artist.bio || t("artists.profile.noBioShort")}</p>
              <p>
                {artist.location
                  ? t("artists.profile.summaryLocation", {
                      name: artist.name,
                      works: artist.artworks,
                      auctions: artist.auctions,
                      location: artist.location,
                    })
                  : t("artists.profile.summary", {
                      name: artist.name,
                      works: artist.artworks,
                      auctions: artist.auctions,
                    })}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
