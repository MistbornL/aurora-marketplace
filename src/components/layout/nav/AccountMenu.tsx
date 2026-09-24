import { useEffect, useRef, useState, type ReactNode } from "react"
import { Heart, LayoutDashboard, LogOut, Palette, ShieldCheck, Star } from "lucide-react"
import { useI18n } from "../../../lib/i18n"
import type { AccountRole } from "../../../types"
import { UserAvatar } from "../UserAvatar"
import { Panel } from "./Panel"

type Props = {
  name: string
  email: string
  avatarUrl: string | null
  role: AccountRole | null
  savedCount: number
  onDashboard: () => void
  onSaved: () => void
  onMembership: () => void
  onSignOut: () => Promise<void>
  onAdmin: () => void
}

export function AccountMenu({
  name,
  email,
  avatarUrl,
  role,
  savedCount,
  onDashboard,
  onSaved,
  onMembership,
  onSignOut,
  onAdmin,
}: Props) {
  const { t } = useI18n()
  const [signingOut, setSigningOut] = useState(false)
  const firstItem = useRef<HTMLButtonElement>(null)
  const isArtist = role === "artist" || role === "admin"

  useEffect(() => firstItem.current?.focus(), [])

  return (
    <Panel label={t("layout.account.label")} className="w-64">
      <div className="flex items-center gap-3 rounded-xl bg-white/[.03] p-3">
        <UserAvatar name={name} src={avatarUrl} size={40} />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-text">{name}</p>
          <p className="truncate text-xs text-text-muted">{email}</p>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              isArtist ? "bg-amber/15 text-amber" : "bg-white/[.07] text-text-secondary"
            }`}
          >
            {role === "admin"
              ? t("layout.account.roleAdmin")
              : isArtist
                ? t("layout.account.roleArtist")
                : t("layout.account.roleCollector")}
          </span>
        </div>
      </div>

      <div role="menu" className="mt-1.5 flex flex-col">
        <MenuItem
          ref={firstItem}
          icon={isArtist ? <Palette /> : <LayoutDashboard />}
          onClick={onDashboard}
        >
          {isArtist ? t("layout.account.artistStudio") : t("layout.account.myDashboard")}
        </MenuItem>
        {role === "admin" && (
          <MenuItem icon={<ShieldCheck />} onClick={onAdmin} tone="amber">
            {t("layout.account.backOffice")}
          </MenuItem>
        )}
        <MenuItem icon={<Heart />} onClick={onSaved}>
          {t("layout.account.savedWorks")}
          {savedCount > 0 && (
            <span className="ml-auto rounded-full bg-white/[.07] px-1.5 text-[11px] text-text-secondary">
              {savedCount}
            </span>
          )}
        </MenuItem>
        {!isArtist && (
          <MenuItem icon={<Star />} onClick={onMembership} tone="amber">
            {t("layout.account.collectors")}
          </MenuItem>
        )}
        <div className="my-1.5 h-px bg-white/[.07]" />
        <MenuItem
          icon={<LogOut />}
          tone="danger"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true)
            try {
              await onSignOut()
            } finally {
              setSigningOut(false)
            }
          }}
        >
          {signingOut ? t("layout.account.signingOut") : t("layout.account.signOut")}
        </MenuItem>
      </div>
    </Panel>
  )
}

function MenuItem({
  icon,
  children,
  onClick,
  tone = "default",
  disabled,
  ref,
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  tone?: "default" | "amber" | "danger"
  disabled?: boolean
  ref?: React.Ref<HTMLButtonElement>
}) {
  const tones = {
    default: "text-text-secondary hover:text-text",
    amber: "text-amber hover:text-amber",
    danger: "text-text-secondary hover:bg-red-500/10 hover:text-red-400",
  }
  return (
    <button
      ref={ref}
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/[.06] focus-visible:bg-white/[.06] focus-visible:outline-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0 ${tones[tone]}`}
    >
      {icon}
      {children}
    </button>
  )
}
