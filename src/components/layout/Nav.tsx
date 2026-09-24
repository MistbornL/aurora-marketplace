import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, ChevronDown, Menu, Search, X } from "lucide-react"
import { AuthDialog } from "../../features/auth/AuthDialog"
import { useAuth } from "../../features/auth/auth-context"
import { useCatalog } from "../../features/catalog/catalog-context"
import { useSavedIds } from "../../features/catalog/saved"
import { useI18n, type MessageKey } from "../../lib/i18n"
import { errorMessage, notify } from "../../lib/notify"
import type { View } from "../../types"
import { Button } from "../ui"
import { AccountMenu } from "./nav/AccountMenu"
import { MembershipDialog, SavedWorksDialog } from "./nav/dialogs"
import { NotificationsPanel } from "./nav/NotificationsPanel"
import { SearchPanel } from "./nav/SearchPanel"
import { useNotifications } from "./nav/use-notifications"
import { LanguageSwitch } from "./LanguageSwitch"
import { UserAvatar } from "./UserAvatar"

// Labels are message keys; they're translated at render time.
const NAV_LINKS: { label: MessageKey; view: View }[] = [
  { label: "layout.nav.discover", view: "discover" },
  { label: "layout.nav.artists", view: "artist" },
  { label: "layout.nav.live", view: "live" },
]

type PanelName = "search" | "notifications" | "account" | "menu"

export function Nav({
  current,
  onNav,
  onArtwork,
  onAbout,
}: {
  current: View
  onNav: (v: View) => void
  onArtwork?: (id: string) => void
  onAbout?: () => void
}) {
  const { t } = useI18n()
  const { user, role, profile, signOut } = useAuth()
  const { artworks } = useCatalog()
  const savedIds = useSavedIds()
  const notifications = useNotifications()
  const navRef = useRef<HTMLElement>(null)
  const navigate = useNavigate()

  // Only one panel can be open at a time.
  const [open, setOpen] = useState<PanelName | null>(null)
  const [dialog, setDialog] = useState<"auth" | "signup" | "saved" | "membership" | null>(null)
  const toggle = (panel: PanelName) =>
    setOpen((currentPanel) => (currentPanel === panel ? null : panel))
  const close = () => setOpen(null)

  // Click outside the navbar or press Escape → close. Panels render inside the
  // <nav>, so clicks on their items never count as "outside".
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Navigating somewhere closes any open panel.
  useEffect(close, [current])

  function go(view: View) {
    close()
    onNav(view)
  }

  async function handleSignOut() {
    try {
      await signOut()
      close()
      onNav("landing")
      notify(t("layout.nav.signedOut"), t("layout.nav.signedOutDetail"))
    } catch (error) {
      notify(t("layout.nav.signOutFailed"), errorMessage(error), "error")
    }
  }

  const name = profile?.username ?? user?.email?.split("@")[0] ?? ""

  return (
    <>
      <nav
        ref={navRef}
        className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-white/[.06] bg-[#0d0d10]/85 px-4 backdrop-blur-xl sm:px-6 lg:px-10"
      >
        {/* Logo */}
        <button
          onClick={() => go("landing")}
          aria-label={t("layout.nav.home")}
          className="flex shrink-0 items-center font-display text-[22px] font-extrabold tracking-[-0.03em] text-text"
        >
          AUR
          <span className="mx-px inline-grid size-[22px] place-items-center rounded-full bg-amber text-[13px] text-bg">
            O
          </span>
          RA
        </button>

        {/* Links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ label, view }) => {
            const active = current === view
            return (
              <button
                key={label}
                onClick={() => go(view)}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-full px-4 py-2 text-[13px] transition-colors ${
                  active
                    ? "bg-white/[.07] text-text"
                    : "text-text-secondary hover:bg-white/[.04] hover:text-text"
                }`}
              >
                {t(label)}
                {view === "live" && (
                  <span className="absolute right-2 top-2 size-1.5 animate-pulse rounded-full bg-red-500" />
                )}
              </button>
            )
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <LanguageSwitch className="hidden sm:flex" />
          <div className="md:hidden">
            <IconButton
              label={open === "menu" ? t("layout.nav.closeMenu") : t("layout.nav.openMenu")}
              active={open === "menu"}
              onClick={() => toggle("menu")}
            >
              {open === "menu" ? <X /> : <Menu />}
            </IconButton>
          </div>
          <div className="relative">
            <IconButton
              label={t("layout.nav.search")}
              active={open === "search"}
              onClick={() => toggle("search")}
            >
              <Search />
            </IconButton>
            {open === "search" && (
              <SearchPanel
                onPick={(id) => {
                  close()
                  onArtwork?.(id)
                }}
              />
            )}
          </div>

          <div className="relative">
            <IconButton
              label={
                notifications.unread
                  ? t("layout.nav.notificationsUnread", { count: notifications.unread })
                  : t("layout.nav.notifications")
              }
              active={open === "notifications"}
              onClick={() => toggle("notifications")}
            >
              <Bell />
            </IconButton>
            {notifications.unread > 0 && (
              <span className="pointer-events-none absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-amber px-1 text-[9px] font-bold leading-4 text-bg ring-2 ring-[#0d0d10]">
                {notifications.unread}
              </span>
            )}
            {open === "notifications" && (
              <NotificationsPanel
                items={notifications.items}
                unread={notifications.unread}
                onRead={(id) => {
                  notifications.markRead(id)
                  const link = notifications.items.find((item) => item.id === id)?.link
                  if (link) {
                    close()
                    navigate(link)
                  }
                }}
                onReadAll={notifications.markAllRead}
              />
            )}
          </div>

          {user ? (
            <div className="relative ml-1">
              <button
                onClick={() => toggle("account")}
                aria-haspopup="menu"
                aria-expanded={open === "account"}
                aria-label={t("layout.nav.accountMenu")}
                className={`group flex items-center gap-2 rounded-full border py-1 pl-1 pr-1 transition-colors sm:pr-2.5 ${
                  open === "account"
                    ? "border-amber/50 bg-white/[.07]"
                    : "border-white/10 hover:border-white/20 hover:bg-white/[.05]"
                }`}
              >
                <UserAvatar name={name} src={profile?.avatarUrl} size={30} />
                <span className="hidden max-w-28 truncate text-[13px] font-medium text-text sm:block">
                  {name}
                </span>
                <ChevronDown
                  className={`hidden size-3.5 text-text-muted transition-transform sm:block ${
                    open === "account" ? "rotate-180" : ""
                  }`}
                />
              </button>
              {open === "account" && (
                <AccountMenu
                  name={name}
                  email={user.email ?? ""}
                  avatarUrl={profile?.avatarUrl ?? null}
                  role={role}
                  savedCount={savedIds.length}
                  onDashboard={() => go("profile")}
                  onSaved={() => {
                    close()
                    setDialog("saved")
                  }}
                  onMembership={() => {
                    close()
                    setDialog("membership")
                  }}
                  onSignOut={handleSignOut}
                  onAdmin={() => {
                    close()
                    navigate("/admin")
                  }}
                />
              )}
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                close()
                setDialog("auth")
              }}
              className="ml-1 h-9 rounded-full bg-amber px-4 font-semibold text-bg hover:bg-[#f3ca6b]"
            >
              {t("common.signIn")}
            </Button>
          )}
        </div>
        {/* Mobile menu */}
        {open === "menu" && (
          <div className="absolute inset-x-0 top-full z-[60] border-b border-white/[.08] bg-[#0d0d10] px-4 pb-5 pt-2 shadow-2xl animate-in fade-in-0 slide-in-from-top-2 md:hidden">
            <nav aria-label={t("layout.nav.main")} className="flex flex-col">
              {[...NAV_LINKS, { label: "layout.nav.aboutFaq" as MessageKey, view: "about" as const }].map(({ label, view }) => (
                <button
                  key={label}
                  onClick={() => {
                    close()
                    if (view === "about") onAbout?.()
                    else onNav(view)
                  }}
                  className={`flex items-center justify-between rounded-xl px-3 py-3.5 text-left text-base ${
                    current === view ? "bg-white/[.06] text-text" : "text-text-secondary"
                  }`}
                >
                  {t(label)}
                  {view === "live" && <span className="size-2 animate-pulse rounded-full bg-red-500" />}
                </button>
              ))}
            </nav>
            <div className="mt-3 flex items-center justify-between border-t border-white/[.06] px-3 pt-4 sm:hidden">
              <span className="text-sm text-text-secondary">{t("common.language")}</span>
              <LanguageSwitch />
            </div>
            {!user && (
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[.06] pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    close()
                    setDialog("auth")
                  }}
                  className="h-11 rounded-full"
                >
                  {t("common.signIn")}
                </Button>
                <Button
                  onClick={() => {
                    close()
                    setDialog("signup")
                  }}
                  className="h-11 rounded-full font-semibold"
                >
                  {t("common.joinFree")}
                </Button>
              </div>
            )}
          </div>
        )}
      </nav>

      {dialog === "auth" && <AuthDialog onClose={() => setDialog(null)} />}
      {dialog === "signup" && <AuthDialog initialMode="sign-up" onClose={() => setDialog(null)} />}
      {dialog === "saved" && (
        <SavedWorksDialog
          artworks={artworks.filter((artwork) => savedIds.includes(artwork.id))}
          onArtwork={(id) => {
            setDialog(null)
            onArtwork?.(id)
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "membership" && (
        <MembershipDialog onClose={() => setDialog(null)} />
      )}
    </>
  )
}

function IconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={label}
      title={label}
      aria-expanded={active}
      onClick={onClick}
      className={`grid size-9 place-items-center rounded-full transition-colors [&_svg]:size-[17px] ${
        active
          ? "bg-white/[.1] text-text"
          : "bg-white/[.05] text-text-secondary hover:bg-white/[.09] hover:text-text"
      }`}
    >
      {children}
    </button>
  )
}
