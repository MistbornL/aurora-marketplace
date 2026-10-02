import { useMemo, useState } from "react"
import { Search, SearchX, SlidersHorizontal } from "lucide-react"
import { ArtworkCard } from "../../components/artwork/ArtworkCard"
import { Button, Input } from "../../components/ui"
import { categoryLabel, useI18n, type MessageKey } from "../../lib/i18n"
import { useCatalog } from "./catalog-context"

const CATEGORIES = ["All", "Painting", "Drawing", "Photography", "Digital Art", "Sculpture", "Handmade"]
// Atmospheric tiles (generated in the landing film's look, ~30-90 KB each).
const CATEGORY_IMAGES: Record<string, string | undefined> = {
  Painting: "/img/cat-painting.webp",
  Drawing: "/img/cat-drawing.webp",
  Photography: "/img/cat-photography.webp",
  "Digital Art": "/img/cat-digital.webp",
  Sculpture: "/img/cat-sculpture.webp",
  Handmade: "/img/cat-handmade.webp",
}
// Sort labels are message keys; they're translated at render time.
const SORTS = {
  ending: "catalog.discover.sort.ending",
  popular: "catalog.discover.sort.popular",
  low: "catalog.discover.sort.low",
  high: "catalog.discover.sort.high",
} as const satisfies Record<string, MessageKey>
type Sort = keyof typeof SORTS

const PAGE_SIZE = 9

/** Filterable artwork grid (landing page + /discover). */
export function DiscoverSection({
  onArtwork,
  onArtist,
  title,
}: {
  onArtwork: (id: string) => void
  onArtist: (id: string) => void
  title?: string
}) {
  const { t } = useI18n()
  const { artworks } = useCatalog()
  const [category, setCategory] = useState("All")
  const [liveOnly, setLiveOnly] = useState(false)
  const [sort, setSort] = useState<Sort>("ending")
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [query, setQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")

  const filtered = useMemo(() => {
    const isLive = (art: (typeof artworks)[number]) => art.isLive && art.timeLeftSecs > 0
    // 0 = live now, 1 = upcoming, 2 = finished
    const rank = (art: (typeof artworks)[number]) => (isLive(art) ? 0 : art.status === "upcoming" ? 1 : 2)
    const q = query.trim().toLowerCase()
    const min = minPrice === "" ? null : Number(minPrice)
    const max = maxPrice === "" ? null : Number(maxPrice)
    const list = artworks.filter(
      (art) =>
        (category === "All" || art.category === category) &&
        (!liveOnly || isLive(art)) &&
        (!q || art.title.toLowerCase().includes(q) || art.artist.toLowerCase().includes(q)) &&
        (min == null || art.currentBid >= min) &&
        (max == null || art.currentBid <= max),
    )
    const sorters: Record<Sort, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      // Live lots first (soonest ending), then ended ones.
      ending: (a, b) =>
        rank(a) - rank(b) ||
        (rank(a) === 1 ? a.startsInSecs - b.startsInSecs : a.timeLeftSecs - b.timeLeftSecs),
      popular: (a, b) => b.bids - a.bids,
      low: (a, b) => a.currentBid - b.currentBid,
      high: (a, b) => b.currentBid - a.currentBid,
    }
    return [...list].sort(sorters[sort])
  }, [artworks, category, liveOnly, sort, query, minPrice, maxPrice])

  const hasPriceFilter = minPrice !== "" || maxPrice !== ""
  const reset = () => {
    setCategory("All")
    setLiveOnly(false)
    setQuery("")
    setMinPrice("")
    setMaxPrice("")
    setVisible(PAGE_SIZE)
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-text">{title ?? t("catalog.discover.title")}</h2>
          <p className="mt-1 text-sm text-text-muted">{t("catalog.discover.count", { count: filtered.length })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setVisible(PAGE_SIZE)
              }}
              placeholder={t("catalog.discover.searchPlaceholder")}
              className="h-9 w-52 rounded-full border-white/10 bg-transparent pl-8 text-[13px]"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-pressed={showFilters}
            className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors ${
              showFilters || hasPriceFilter
                ? "border-amber/60 bg-amber/10 text-amber"
                : "border-white/10 text-text-secondary hover:border-white/20"
            }`}
          >
            <SlidersHorizontal className="size-3.5" /> {t("catalog.discover.priceRange")}
          </button>
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-white/10 px-3.5 text-[13px] text-text-secondary hover:border-white/20">
            <input
              type="checkbox"
              checked={liveOnly}
              onChange={(event) => {
                setLiveOnly(event.target.checked)
                setVisible(PAGE_SIZE)
              }}
              className="size-3.5 accent-[#f6a87b]"
            />
            {t("catalog.discover.liveOnly")}
          </label>
          <label className="sr-only" htmlFor="discover-sort">{t("catalog.discover.sortBy")}</label>
          <select
            id="discover-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="h-9 rounded-full border border-white/10 bg-bg px-3.5 text-[13px] text-text-secondary outline-none hover:border-white/20 focus:border-amber/60"
          >
            {Object.entries(SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {t(label)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showFilters && (
        <div className="-mt-2 mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[.08] bg-white/[.03] px-4 py-3">
          <span className="text-[13px] text-text-secondary">{t("catalog.discover.priceRange")}</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={minPrice}
            onChange={(event) => {
              setMinPrice(event.target.value)
              setVisible(PAGE_SIZE)
            }}
            placeholder={t("catalog.discover.priceMin")}
            className="h-9 w-28 text-[13px]"
          />
          <span className="text-text-muted">–</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={maxPrice}
            onChange={(event) => {
              setMaxPrice(event.target.value)
              setVisible(PAGE_SIZE)
            }}
            placeholder={t("catalog.discover.priceMax")}
            className="h-9 w-28 text-[13px]"
          />
          {hasPriceFilter && (
            <button
              type="button"
              onClick={() => {
                setMinPrice("")
                setMaxPrice("")
              }}
              className="text-[13px] text-amber hover:text-amber/80"
            >
              {t("catalog.discover.clearFilters")}
            </button>
          )}
        </div>
      )}

      <div
        role="tablist"
        aria-label={t("catalog.discover.categories")}
        className="-mx-4 mb-10 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:grid lg:grid-cols-7 lg:overflow-visible"
      >
        {CATEGORIES.map((item) => {
          const active = item === category
          const img = CATEGORY_IMAGES[item]
          const count = item === "All" ? artworks.length : artworks.filter((art) => art.category === item).length
          return (
            <button
              key={item}
              role="tab"
              aria-selected={active}
              onClick={() => {
                setCategory(active && item !== "All" ? "All" : item)
                setVisible(PAGE_SIZE)
              }}
              className={`cat-tile group relative aspect-[4/5] w-32 shrink-0 snap-start overflow-hidden rounded-2xl border text-left transition-[border-color,transform,box-shadow] duration-300 sm:w-36 lg:w-auto ${
                active
                  ? "border-amber shadow-[0_10px_30px_-12px_rgba(246,168,123,.55)]"
                  : "border-white/[.08] hover:-translate-y-0.5 hover:border-white/25"
              }`}
            >
              {img ? (
                <img
                  src={img}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover transition-[transform,opacity] duration-500 group-hover:scale-105 ${
                    active ? "opacity-100" : "opacity-75 group-hover:opacity-95"
                  }`}
                />
              ) : (
                <span aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_80%_0%,rgba(246,168,123,.28),transparent_60%),linear-gradient(160deg,var(--color-surface-2),var(--color-surface))]" />
              )}
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-bg/95 via-bg/30 to-transparent" />
              <span className="absolute inset-x-3 bottom-3">
                <span className={`block font-display text-[15px] font-semibold leading-tight ${active ? "text-amber" : "text-text"}`}>
                  {categoryLabel(t, item)}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[.14em] text-text-secondary">
                  {count}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {filtered.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, visible).map((art) => (
            <ArtworkCard
              key={art.id}
              art={art}
              onClick={() => onArtwork(art.id)}
              onArtistClick={() => onArtist(art.artistId)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-white/10 py-20 text-center">
          <SearchX className="size-6 text-text-muted" />
          <p className="font-display text-lg text-text-secondary">{t("catalog.discover.empty")}</p>
          <button onClick={reset} className="text-sm text-amber hover:text-amber/80">
            {t("catalog.discover.clearFilters")}
          </button>
        </div>
      )}

      {filtered.length > visible && (
        <div className="mt-10 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setVisible((count) => count + PAGE_SIZE)}
            className="h-11 rounded-full px-8 text-[13px]"
          >
            {t("catalog.discover.loadMore")}
          </Button>
        </div>
      )}
    </>
  )
}
