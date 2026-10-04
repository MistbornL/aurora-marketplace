import { useI18n, type Lang } from "../../lib/i18n"

const OPTIONS: Array<{ lang: Lang; label: string; name: string }> = [
  { lang: "ka", label: "ქა", name: "ქართული" },
  { lang: "en", label: "EN", name: "English" },
]

/** Compact KA / EN toggle. */
export function LanguageSwitch({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { lang, setLang, t } = useI18n()
  if (compact) {
    // One small button showing the language you would switch to.
    const next = OPTIONS.find((option) => option.lang !== lang) ?? OPTIONS[0]
    return (
      <button
        onClick={() => setLang(next.lang)}
        aria-label={`${t("common.language")}: ${next.name}`}
        title={next.name}
        className={`h-9 min-w-9 items-center justify-center rounded-full bg-white/[.05] px-2.5 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-white/[.09] hover:text-text ${className}`}
      >
        {next.label}
      </button>
    )
  }
  return (
    <div
      role="radiogroup"
      aria-label={t("common.language")}
      className={`flex h-8 items-center gap-0.5 rounded-full bg-white/[.05] p-0.5 text-[11px] font-semibold ${className}`}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.lang}
          role="radio"
          aria-checked={lang === option.lang}
          aria-label={option.name}
          title={option.name}
          onClick={() => setLang(option.lang)}
          className={`h-7 min-w-7 rounded-full px-1.5 transition-colors ${
            lang === option.lang
              ? "bg-amber text-bg hover:bg-amber-dark"
              : "text-text-secondary hover:text-text"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
