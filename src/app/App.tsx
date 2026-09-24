import { lazy, Suspense, useEffect, type ReactNode } from "react"
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom"
import { Footer } from "../components/layout/Footer"
import { Nav } from "../components/layout/Nav"
import { PageSkeleton } from "../components/layout/PageSkeletons"
import { ResetPasswordDialog } from "../features/auth/ResetPasswordDialog"
import { Button } from "../components/ui"
import { useCatalog } from "../features/catalog/catalog-context"
import { useI18n, type MessageKey } from "../lib/i18n"
import LandingPage from "../features/catalog/LandingPage"
import type { View } from "../types"

// Route-level code splitting: only the landing page ships in the main bundle.
const DiscoverPage = lazy(() => import("../features/catalog/DiscoverPage"))
const ArtworkDetailPage = lazy(
  () => import("../features/artwork/ArtworkDetailPage"),
)
const LiveLobbyPage = lazy(() => import("../features/live/LiveAuctionPage"))
const LiveRoomPage = lazy(() => import("../features/live/LiveRoomPage"))
const AboutPage = lazy(() => import("../features/info/AboutPage"))
const TermsPage = lazy(() => import("../features/info/TermsPage"))
const PrivacyPage = lazy(() => import("../features/info/PrivacyPage"))
const EventPage = lazy(() => import("../features/events/EventPage"))
const ArtistProfilePage = lazy(
  () => import("../features/artists/ArtistProfilePage"),
)
const ArtistsDirectoryPage = lazy(
  () => import("../features/artists/ArtistsDirectoryPage"),
)
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"))
const OrderPage = lazy(() => import("../features/orders/OrderPage"))
const AdminPage = lazy(() => import("../features/admin/AdminPage"))

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <ResetPasswordDialog />
    </BrowserRouter>
  )
}

function AppRoutes() {
  const { t, translateError } = useI18n()
  const { loading, error, refresh } = useCatalog()
  if (loading) return <PageSkeleton />
  if (error)
    return (
      <div className="grid min-h-screen place-items-center gap-3 bg-bg font-display text-sm text-text-secondary">
        {translateError(error)}
        <Button onClick={() => void refresh()}>{t("common.tryAgainShort")}</Button>
      </div>
    )
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/discover" element={<DiscoverRoute />} />
        <Route path="/artists" element={<ArtistsRoute />} />
        <Route path="/artists/:id" element={<ArtistRoute />} />
        <Route path="/artworks/:id" element={<ArtworkRoute />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
        <Route path="/orders/:id" element={<OrderRoute />} />
        <Route path="/admin" element={<PageFrame><AdminPage /></PageFrame>} />
        <Route path="/live" element={<LiveLobbyRoute />} />
        <Route path="/live/:id" element={<LiveRoomRoute />} />
        <Route path="/about" element={<PageFrame><AboutPage /></PageFrame>} />
        <Route path="/terms" element={<PageFrame><TermsPage /></PageFrame>} />
        <Route path="/privacy" element={<PageFrame><PrivacyPage /></PageFrame>} />
        <Route path="/events/:id" element={<EventRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

const DESTINATIONS: Record<View, string> = {
  landing: "/",
  discover: "/discover",
  artwork: "/discover",
  artist: "/artists",
  live: "/live",
  profile: "/dashboard",
}

function viewForPath(pathname: string): View {
  if (pathname.startsWith("/artworks/")) return "artwork"
  if (pathname.startsWith("/artists")) return "artist"
  if (pathname === "/dashboard" || pathname.startsWith("/orders")) return "profile"
  if (pathname.startsWith("/live") || pathname.startsWith("/events")) return "live"
  if (pathname === "/discover") return "discover"
  return "landing"
}

/** Shared navigation helpers so routes don't repeat URL building. */
function useAppNav() {
  const navigate = useNavigate()
  return {
    navigate,
    toArtwork: (id: string) => navigate(`/artworks/${encodeURIComponent(id)}`),
    toArtist: (id: string) => navigate(`/artists/${encodeURIComponent(id)}`),
    back: () => (window.history.length > 1 ? navigate(-1) : navigate("/")),
  }
}

const TITLES: Array<[RegExp, MessageKey]> = [
  [/^\/discover/, "pilot.title.discover"],
  [/^\/artists/, "pilot.title.artists"],
  [/^\/artworks\//, "pilot.title.artwork"],
  [/^\/(live|events)/, "pilot.title.live"],
  [/^\/dashboard/, "pilot.title.dashboard"],
  [/^\/orders\//, "pilot.title.order"],
  [/^\/admin/, "pilot.title.admin"],
  [/^\/about/, "pilot.title.about"],
  [/^\/terms/, "pilot.title.terms"],
  [/^\/privacy/, "pilot.title.privacy"],
]

/** "Discover · AURORA" — follows the route and the language. */
function usePageTitle(pathname: string) {
  const { t } = useI18n()
  useEffect(() => {
    const match = TITLES.find(([pattern]) => pattern.test(pathname))
    document.title = match ? `${t(match[1])} · AURORA` : `AURORA — ${t("pilot.title.home")}`
  }, [pathname, t])
}

function PageFrame({
  children,
  footer = true,
}: {
  children: ReactNode
  footer?: boolean
}) {
  const { navigate, toArtwork } = useAppNav()
  const { pathname } = useLocation()
  usePageTitle(pathname)
  return (
    <>
      <Nav
        current={viewForPath(pathname)}
        onNav={(view) => navigate(DESTINATIONS[view])}
        onArtwork={toArtwork}
        onAbout={() => navigate("/about")}
      />
      {children}
      {footer && <Footer />}
    </>
  )
}

function LandingRoute() {
  const { navigate, toArtwork, toArtist } = useAppNav()
  return (
    <PageFrame>
      <LandingPage
        onArtwork={toArtwork}
        onArtist={toArtist}
        onLive={() => navigate("/live")}
        onDiscover={() => navigate("/discover")}
        onEvent={(id) => navigate(`/events/${encodeURIComponent(id)}`)}
      />
    </PageFrame>
  )
}

function DiscoverRoute() {
  const { toArtwork, toArtist } = useAppNav()
  return (
    <PageFrame>
      <DiscoverPage onArtwork={toArtwork} onArtist={toArtist} />
    </PageFrame>
  )
}

function ArtistsRoute() {
  const { navigate, toArtist } = useAppNav()
  return (
    <PageFrame>
      <ArtistsDirectoryPage
        onArtist={toArtist}
        onApply={() => navigate("/dashboard")}
      />
    </PageFrame>
  )
}

function ArtworkRoute() {
  const { back, toArtist } = useAppNav()
  const { id = "" } = useParams()
  return (
    <PageFrame>
      <ArtworkDetailPage
        key={id}
        artworkId={id}
        onBack={back}
        onArtistClick={toArtist}
      />
    </PageFrame>
  )
}

function ArtistRoute() {
  const { back, toArtwork } = useAppNav()
  const { id = "" } = useParams()
  return (
    <PageFrame>
      <ArtistProfilePage
        key={id}
        artistId={id}
        onBack={back}
        onArtworkClick={toArtwork}
      />
    </PageFrame>
  )
}

function DashboardRoute() {
  return (
    <PageFrame>
      <DashboardPage />
    </PageFrame>
  )
}

function LiveLobbyRoute() {
  const { navigate } = useAppNav()
  return (
    <PageFrame>
      <LiveLobbyPage
        onJoin={(id) => navigate(`/live/${encodeURIComponent(id)}`)}
        onDiscover={() => navigate("/discover")}
        onEvent={(id) => navigate(`/events/${encodeURIComponent(id)}`)}
      />
    </PageFrame>
  )
}

function LiveRoomRoute() {
  const { navigate, toArtwork, toArtist } = useAppNav()
  const { id = "" } = useParams()
  return (
    // Full-height room layout: no footer.
    <PageFrame footer={false}>
      <LiveRoomPage
        roomId={id}
        onLobby={() => navigate("/live")}
        onRoom={(next) => navigate(`/live/${encodeURIComponent(next)}`)}
        onArtwork={toArtwork}
        onArtist={toArtist}
      />
    </PageFrame>
  )
}

function OrderRoute() {
  const { back, toArtwork } = useAppNav()
  const { id = "" } = useParams()
  return (
    <PageFrame>
      <OrderPage key={id} orderId={id} onBack={back} onArtwork={toArtwork} />
    </PageFrame>
  )
}

function EventRoute() {
  const { back, navigate, toArtwork } = useAppNav()
  const { id = "" } = useParams()
  return (
    <PageFrame>
      <EventPage
        key={id}
        eventId={id}
        onBack={back}
        onRoom={(lot) => navigate(`/live/${encodeURIComponent(lot)}`)}
        onArtwork={toArtwork}
      />
    </PageFrame>
  )
}
