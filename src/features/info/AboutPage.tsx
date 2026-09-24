import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { CreditCard, Gavel, MessageCircle, Package, Palette, ShieldCheck } from "lucide-react"
import { Button } from "../../components/ui"
import { useI18n } from "../../lib/i18n"

// NOTE: policy wording (payment window, shipping, fees) describes the intended
// process. Review it against how you actually run payments/shipping before launch.

// FAQ entries are message keys ("info.faq.<id>.q" / ".a"); translated at render time.
const FAQ = [
  "join",
  "binding",
  "phone",
  "name",
  "steps",
  "live",
  "buyNow",
  "reserve",
  "fees",
  "missed",
  "ownWork",
  "outbid",
] as const

export default function AboutPage() {
  const { t } = useI18n()
  const { hash } = useLocation()
  const navigate = useNavigate()

  // Support /about#faq style links.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" })
    else window.scrollTo({ top: 0 })
  }, [hash])

  return (
    <main className="min-h-screen bg-bg pb-24">
      <section className="border-b border-white/[.06] bg-gradient-to-b from-amber/[.06] to-transparent">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber">{t("info.about.eyebrow")}</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">
            {t("info.about.title")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-text-secondary">
            {t("info.about.lead")}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-20 px-4 pt-16 sm:px-6">
        <Section id="buying" eyebrow={t("info.buying.eyebrow")} title={t("info.buying.title")}>
          <Steps
            steps={[
              { icon: <Gavel />, title: t("info.buying.bidTitle"), text: t("info.buying.bidText") },
              { icon: <ShieldCheck />, title: t("info.buying.winTitle"), text: t("info.buying.winText") },
              { icon: <Package />, title: t("info.buying.collectTitle"), text: t("info.buying.collectText") },
            ]}
          />
        </Section>

        <Section id="after-you-win" eyebrow={t("info.win.eyebrow")} title={t("info.win.title")}>
          <ol className="space-y-4">
            {[
              { icon: <MessageCircle />, title: t("info.win.notifiedTitle"), text: t("info.win.notifiedText") },
              { icon: <CreditCard />, title: t("info.win.payTitle"), text: t("info.win.payText") },
              { icon: <Package />, title: t("info.win.shipTitle"), text: t("info.win.shipText") },
              { icon: <ShieldCheck />, title: t("info.win.confirmTitle"), text: t("info.win.confirmText") },
            ].map((item) => (
              <li key={item.title} className="flex gap-4 rounded-2xl border border-white/[.06] bg-surface/60 p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber/10 text-amber [&_svg]:size-5">{item.icon}</span>
                <div>
                  <p className="font-display font-semibold text-text">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="selling" eyebrow={t("info.selling.eyebrow")} title={t("info.selling.title")}>
          <Steps
            steps={[
              { icon: <Palette />, title: t("info.selling.createTitle"), text: t("info.selling.createText") },
              { icon: <Gavel />, title: t("info.selling.publishTitle"), text: t("info.selling.publishText") },
              { icon: <CreditCard />, title: t("info.selling.paidTitle"), text: t("info.selling.paidText") },
            ]}
          />
          <Button onClick={() => navigate("/dashboard")} className="mt-6 h-11 rounded-full px-6">
            {t("info.selling.openStudio")}
          </Button>
        </Section>

        <Section id="faq" eyebrow={t("info.faq.eyebrow")} title={t("info.faq.title")}>
          <div className="divide-y divide-white/[.06] rounded-2xl border border-white/[.06] bg-surface/60">
            {FAQ.map((item) => (
              <details key={item} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-text">
                  {t(`info.faq.${item}.q`)}
                  <span className="text-xl text-text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{t(`info.faq.${item}.a`)}</p>
              </details>
            ))}
          </div>
        </Section>
      </div>
    </main>
  )
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-text">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function Steps({ steps }: { steps: { icon: React.ReactNode; title: string; text: string }[] }) {
  const { t } = useI18n()
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div key={step.title} className="rounded-2xl border border-white/[.06] bg-surface/60 p-5">
          <span className="grid size-10 place-items-center rounded-xl bg-amber/10 text-amber [&_svg]:size-5">{step.icon}</span>
          <p className="mt-4 text-xs text-text-muted">{t("info.about.step", { n: index + 1 })}</p>
          <p className="font-display text-lg font-semibold text-text">{step.title}</p>
          <p className="mt-1.5 text-sm leading-6 text-text-secondary">{step.text}</p>
        </div>
      ))}
    </div>
  )
}
