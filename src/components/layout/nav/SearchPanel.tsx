import { useState } from "react"
import { Search } from "lucide-react"
import { useCatalog } from "../../../features/catalog/catalog-context"
import { categoryLabel, useI18n } from "../../../lib/i18n"
import { Panel } from "./Panel"

export function SearchPanel({ onPick }: { onPick: (artworkId: string) => void }) {
  const { t } = useI18n()
  const { artworks } = useCatalog()
  const [term, setTerm] = useState("")
  const query = term.trim().toLowerCase()
  const results = artworks
    .filter((art) =>
      `${art.title} ${art.artist} ${art.category}`.toLowerCase().includes(query),
    )
    .slice(0, 6)

  return (
    <Panel label={t("layout.nav.search")} className="w-[min(24rem,calc(100vw-2rem))] p-2">
      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 focus-within:border-amber/60">
        <Search className="size-4 text-text-muted" />
        <input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t("layout.search.placeholder")}
          className="h-10 w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
        />
      </label>
      <div className="mt-1 max-h-80 overflow-y-auto">
        {results.length ? (
          results.map((art) => (
            <button
              key={art.id}
              onClick={() => onPick(art.id)}
              className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[.06]"
            >
              <img src={art.image} alt="" loading="lazy" className="size-11 rounded-lg object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text">{art.title}</span>
                <span className="block truncate text-xs text-text-muted">
                  {art.artist} · {art.category ? categoryLabel(t, art.category) : t("layout.search.artwork")}
                </span>
              </span>
              <span className="font-mono text-xs font-semibold text-amber">{art.currentBid}₾</span>
            </button>
          ))
        ) : (
          <p className="px-2 py-8 text-center text-sm text-text-muted">
            {t("layout.search.noResults", { term })}
          </p>
        )}
      </div>
    </Panel>
  )
}
