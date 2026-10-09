import { BadgeCheck, Handshake, LifeBuoy, ShieldCheck } from "lucide-react"
import { Reveal } from "../../components/motion/Reveal"
import { useI18n, type MessageKey } from "../../lib/i18n"

/** The one-line promise and the buyer protections, straight under the hero. */
export function TrustBand() {
  const { t } = useI18n()
  const items: Array<{ icon: typeof ShieldCheck; title: MessageKey; text: MessageKey }> = [
    { icon: ShieldCheck, title: "catalog.trust.payTitle", text: "catalog.trust.payText" },
    { icon: Handshake, title: "catalog.trust.meetTitle", text: "catalog.trust.meetText" },
    { icon: BadgeCheck, title: "catalog.trust.certTitle", text: "catalog.trust.certText" },
    { icon: LifeBuoy, title: "catalog.trust.helpTitle", text: "catalog.trust.helpText" },
  ]
  return (
    <section className="border-b border-white/[.06] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <Reveal className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber">{t("catalog.trust.eyebrow")}</p>
          <h2 className="mt-3 font-display text-[clamp(30px,3.4vw,48px)] font-semibold leading-[1.1] tracking-[-0.02em] text-text">
            {t("catalog.trust.title")}
          </h2>
          <p className="mt-4 text-[17px] leading-8 text-text-secondary">{t("catalog.trust.sub")}</p>
        </Reveal>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, title, text }, index) => (
            <Reveal as="li" key={title} delay={index * 70} className="rounded-2xl border border-white/[.08] bg-surface/60 p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-amber/10 text-amber">
                <Icon className="size-5" />
              </span>
              <p className="mt-4 font-display text-lg font-semibold text-text">{t(title)}</p>
              <p className="mt-1.5 text-sm leading-6 text-text-secondary">{t(text)}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
