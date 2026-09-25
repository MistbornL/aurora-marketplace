import { Link } from "react-router-dom"
import { useI18n, type MessageKey } from "../../lib/i18n"

// Labels are message keys; they're translated at render time.
const COLUMNS: Array<{ title: MessageKey | "TSISKARI"; links: Array<{ label: MessageKey; to: string }> }> = [
  {
    title: "layout.footer.collect",
    links: [
      { label: "layout.footer.allAuctions", to: "/discover" },
      { label: "layout.footer.liveRooms", to: "/live" },
      { label: "layout.footer.artists", to: "/artists" },
    ],
  },
  {
    title: "layout.footer.sell",
    links: [
      { label: "layout.footer.sellYourArt", to: "/dashboard" },
      { label: "layout.footer.howSelling", to: "/about#selling" },
    ],
  },
  {
    title: "TSISKARI",
    links: [
      { label: "layout.footer.about", to: "/about" },
      { label: "layout.footer.faq", to: "/about#faq" },
      { label: "layout.footer.afterYouWin", to: "/about#after-you-win" },
      { label: "layout.footer.terms", to: "/terms" },
      { label: "pilot.footer.privacy", to: "/privacy" },
    ],
  },
]

export function Footer() {
  const { t } = useI18n()
  return (
    <footer className="border-t border-white/[.06] bg-[#0a0a0d]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 text-center sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] md:text-left lg:px-10">
        <div className="flex flex-col items-center md:items-start">
          <p className="font-display text-xl font-extrabold tracking-[-0.03em] text-text">
            TSISK
            <span className="mx-px inline-grid size-[18px] place-items-center rounded-full bg-amber align-middle text-[11px] text-bg">
              A
            </span>
            RI
          </p>
          <p className="mt-3 max-w-xs text-sm leading-6 text-text-muted">
            {t("layout.footer.tagline")}
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav
            key={column.title}
            className="flex flex-col items-center md:items-start"
            aria-label={column.title === "TSISKARI" ? "TSISKARI" : t(column.title)}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              {column.title === "TSISKARI" ? "TSISKARI" : t(column.title)}
            </p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm text-text-muted transition-colors hover:text-text">
                    {t(link.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/[.04] px-4 py-5 text-center text-xs text-text-muted/70">
        {t("layout.footer.copyright", { year: new Date().getFullYear() })}
      </div>
    </footer>
  )
}