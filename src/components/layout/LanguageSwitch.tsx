import { useI18n, type Lang } from "../../lib/i18n"

const OPTIONS: Array<{ lang: Lang; label: string; name: string }> = [
  { lang: "ka", label: "ქა", name: "ქართული" },
  { lang: "en", label: "EN", name: "English" },
]

/** Compact KA / EN toggle. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n()
  return (
    <div
      role="radiogroup"
      aria-label={t("common.language")}
      className={`flex h-9 items-center rounded-full bg-white/[.05] p-0.5 text-[12px] font-semibold ${className}`}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.lang}
          role="radio"
          aria-checked={lang === option.lang}
          aria-label={option.name}
          title={option.name}
          onClick={() => setLang(option.lang)}
          className={`h-8 min-w-9 rounded-full px-2 transition-colors ${
            lang === option.lang ? "bg-amber text-bg" : "text-text-secondary hover:text-text"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
