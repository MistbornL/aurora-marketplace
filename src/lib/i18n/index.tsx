import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { EN, KA, type MessageKey } from "./messages"
import { translateServerError } from "./server-errors"

/**
 * Tiny i18n: English + Georgian.
 *   const { t, lang, setLang, formatDate } = useI18n()
 *   t("nav.discover")                       → "Discover" / "აღმოჩენა"
 *   t("artwork.bidsCount", { count: 3 })    → "{count} {count|bid|bids}" → "3 bids"
 * Placeholders: {name}. Plural (English): {count|one|other} picks by count === 1.
 * Outside React (async callbacks, validators) use `tr()` — it reads the current language.
 */
export type Lang = "en" | "ka"
export type { MessageKey }
type Vars = Record<string, string | number | null | undefined>

const STORAGE_KEY = "aurora.lang"
const DICTS: Record<Lang, Record<MessageKey, string>> = { en: EN, ka: KA }
export const LOCALES: Record<Lang, string> = { en: "en-GB", ka: "ka-GE" }

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "en" || saved === "ka") return saved
  } catch {
    /* storage blocked */
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ka") ? "ka" : "en"
}

let current: Lang = initialLang()

export function format(template: string, vars?: Vars) {
  if (!vars) return template
  return template.replace(/\{(\w+)(?:\|([^|}]*)\|([^}]*))?\}/g, (match, name: string, one?: string, other?: string) => {
    const value = vars[name]
    if (one !== undefined) return Number(value) === 1 ? one : (other ?? "")
    return value == null ? match : String(value)
  })
}

/** Translate outside React components (uses the active language). */
export function tr(key: MessageKey, vars?: Vars) {
  return format(DICTS[current][key] || EN[key] || key, vars)
}

export const currentLang = () => current

/** Category values are stored in English; show them translated when we know them. */
export function categoryLabel(t: (key: MessageKey) => string, category: string) {
  const key = `common.category.${category}` as MessageKey
  return key in EN ? t(key) : category
}

/** Translate a server error message outside React. */
export const trError = (message: string) =>
  current === "ka" ? translateServerError(message, (key, vars) => tr(key, vars)) : message

type I18n = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: MessageKey, vars?: Vars) => string
  /** Intl locale for dates / numbers. */
  locale: string
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
  /** Server / database error text in the active language when we know it. */
  translateError: (message: string) => string
}

const I18nContext = createContext<I18n | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current)

  const setLang = useCallback((next: Lang) => {
    current = next
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage blocked */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<I18n>(() => {
    const dict = DICTS[lang]
    const locale = LOCALES[lang]
    return {
      lang,
      setLang,
      locale,
      t: (key, vars) => format(dict[key] || EN[key] || key, vars),
      formatDate: (input, options) => new Date(input).toLocaleString(locale, options),
      translateError: (message) =>
        lang === "ka" ? translateServerError(message, (key, vars) => format(dict[key] || EN[key], vars)) : message,
    }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error("useI18n must be used inside <LanguageProvider>")
  return context
}
