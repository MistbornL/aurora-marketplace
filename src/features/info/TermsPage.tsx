// TODO(before launch): this is a plain-language starting draft, not legal advice.
// Have it reviewed by a lawyer familiar with Georgian consumer and e-commerce law.
import { useI18n } from "../../lib/i18n"

// Section ids map to "info.terms.<id>.title" / ".body"; translated at render time.
const SECTIONS = ["accounts", "bidding", "selling", "payment", "privacy", "conduct", "changes"] as const

export default function TermsPage() {
  const { t } = useI18n()
  return (
    <main className="min-h-screen bg-bg pb-24">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber">{t("info.terms.eyebrow")}</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-text">{t("info.terms.title")}</h1>
        <p className="mt-3 text-sm text-text-muted">{t("info.terms.updated")}</p>
        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section}>
              <h2 className="font-display text-lg font-semibold text-text">{t(`info.terms.${section}.title`)}</h2>
              <p className="mt-2 text-[15px] leading-7 text-text-secondary">{t(`info.terms.${section}.body`)}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
