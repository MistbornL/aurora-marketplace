import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui"
import { useI18n } from "../../lib/i18n"

// Shown for any URL that matches no route.
export default function NotFoundPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <section className="relative isolate flex min-h-[78vh] items-end overflow-hidden bg-bg">
      <img
        src="/img/404.webp"
        alt=""
        className="absolute inset-0 -z-20 size-full object-cover object-[70%_50%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(27,23,29,0.82)_0%,rgba(27,23,29,0.35)_55%,rgba(27,23,29,0)_100%),linear-gradient(to_top,var(--color-bg)_2%,rgba(27,23,29,0)_45%)]"
      />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-32 sm:px-8">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-amber">
          {t("common.notFound.eyebrow")}
        </p>
        <h1 className="mt-3 max-w-xl font-display text-4xl leading-tight text-text sm:text-6xl">
          {t("common.notFound.title")}
        </h1>
        <p className="mt-4 max-w-md text-text-secondary">{t("common.notFound.text")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => navigate("/")}>{t("common.notFound.home")}</Button>
          <Button variant="outline" onClick={() => navigate("/discover")}>
            {t("common.notFound.browse")}
          </Button>
        </div>
      </div>
    </section>
  )
}
