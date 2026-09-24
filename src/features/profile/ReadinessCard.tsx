import { CheckCircle2, Circle } from "lucide-react"
import { Button } from "../../components/ui"
import { useAuth } from "../auth/auth-context"
import { MISSING_LABELS, type MissingField } from "./api"
import { useI18n } from "../../lib/i18n"

const REQUIRED: Record<"bid" | "sell", MissingField[]> = {
  bid: ["name", "phone"],
  sell: ["location", "bio"],
}

/** Checklist that shows what's needed to bid (collectors) or publish (artists). */
export function ReadinessCard({
  purpose,
  onFix,
}: {
  purpose: "bid" | "sell"
  onFix: () => void
}) {
  const { readiness } = useAuth()
  const { t } = useI18n()
  const missing = readiness[purpose]
  if (!missing.length) return null
  return (
    <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-amber/25 bg-amber/[.05] p-5 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="font-display font-semibold text-text">
          {purpose === "bid" ? t("profile.ready.bidTitle") : t("profile.ready.sellTitle")}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {purpose === "bid"
            ? t("profile.ready.bidText")
            : t("profile.ready.sellText")}
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {REQUIRED[purpose].map((field) => {
            const done = !missing.includes(field)
            return (
              <li
                key={field}
                className={`flex items-center gap-1.5 text-xs ${done ? "text-text-muted line-through" : "text-text-secondary"}`}
              >
                {done ? (
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                ) : (
                  <Circle className="size-3.5 text-amber" />
                )}
                {t(MISSING_LABELS[field])}
              </li>
            )
          })}
        </ul>
      </div>
      <Button onClick={onFix} className="h-10 rounded-full px-5">
        {t("profile.ready.complete")}
      </Button>
    </div>
  )
}
