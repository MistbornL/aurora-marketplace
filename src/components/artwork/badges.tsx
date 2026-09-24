import { useI18n } from "../../lib/i18n"
import { Badge } from "../ui"

export function LivePill({ small }: { small?: boolean }) {
  return (
    <Badge
      variant="destructive"
      className={`${
        small ? "px-2 py-1 text-[9px]" : "px-2.5 py-1"
      } gap-1.5 border-0 bg-red-500 text-white shadow-lg shadow-red-500/25`}
    >
      <span
        className="rounded-full bg-white animate-pulse"
        style={{ width: small ? 5 : 6, height: small ? 5 : 6 }}
      />
      LIVE
    </Badge>
  )
}

export function EndingSoonPill({ small }: { small?: boolean }) {
  const { t } = useI18n()
  return (
    <Badge
      className={`${
        small ? "px-1.5 py-0.5 text-[9px]" : ""
      } gap-1 bg-amber text-bg`}
    >
      <span>🔥</span> {t("layout.badge.endingSoon")}
    </Badge>
  )
}

export function VerifiedBadge() {
  const { t } = useI18n()
  return (
    <span
      className="inline-flex items-center justify-center size-4 rounded-full text-[9px] font-bold"
      style={{ background: "#4a90d9", color: "#fff" }}
      title={t("layout.badge.verified")}
    >
      ✓
    </span>
  )
}


export function UpcomingPill({ small, label }: { small?: boolean; label: string }) {
  return (
    <Badge
      className={`${small ? "px-2 py-1 text-[9px]" : "px-2.5 py-1"} gap-1.5 border border-sky-300/30 bg-sky-500/90 text-white`}
    >
      {label}
    </Badge>
  )
}

export function OnApprovalPill({ small }: { small?: boolean }) {
  const { t } = useI18n()
  return (
    <Badge className={`${small ? "px-2 py-1 text-[9px]" : "px-2.5 py-1"} bg-violet-500/90 text-white`}>
      {t("layout.badge.onApproval")}
    </Badge>
  )
}
