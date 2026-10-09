// TODO(before launch): plain-language draft, not legal advice. Have it reviewed
// against Georgia's consumer-protection and e-commerce rules.
import { useI18n, type MessageKey } from "../../lib/i18n"
import { CONTACT_EMAIL } from "../../lib/site"

const SECTIONS = ["pay", "delivery", "notAsDescribed", "unpaid", "how", "contact"] as const

export default function RefundPage() {
  const { t } = useI18n()
  return (
    <main className="min-h-screen bg-bg pb-24">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber">{t("info.refund.eyebrow")}</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-text">{t("info.refund.title")}</h1>
        <p className="mt-3 text-sm text-text-muted">{t("info.refund.updated")}</p>
        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section}>
              <h2 className="font-display text-lg font-semibold text-text">
                {t(`info.refund.${section}.title` as MessageKey)}
              </h2>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-text-secondary">
                {t(`info.refund.${section}.body` as MessageKey, { email: CONTACT_EMAIL })}
              </p>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
