import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "../../lib/supabase"
import { getReadiness, type Readiness } from "../profile/api"
import type { AccountRole } from "../../types"
import { tr } from "../../lib/i18n"

/**
 * One account system, one `role` per profile.
 *  - collector: browses, bids, saves, wins.
 *  - artist:    everything a collector can do + studio tools (create/manage auctions, sales).
 * The trusted source of truth is `profiles.role` (users cannot write it directly —
 * see supabase/migrations/20260923_account_roles.sql). user_metadata.role is only
 * a hint used before the profile row loads.
 */
export type { AccountRole }
export type SignUpRole = Exclude<AccountRole, "admin">

/** What the UI needs to show the signed-in person (navbar avatar, menus). */
export type ProfileSummary = {
  username: string
  /** The name others see (username, full name or both — the person's choice). */
  publicName: string
  avatarUrl: string | null
}

export type SignUpInput = {
  email: string
  password: string
  firstName: string
  lastName: string
  role: SignUpRole
}

type AuthState = {
  user: User | null
  role: AccountRole | null
  profile: ProfileSummary | null
  /** Missing details before bidding / selling (empty arrays = ready). */
  readiness: Readiness
  /** True after opening a password-reset link: show "set new password". */
  recovering: boolean
  /** Call after the profile is edited so the navbar updates. */
  refreshProfile: () => Promise<void>
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** Resolves `needsConfirmation: true` when Supabase requires email confirmation. */
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  resendConfirmation: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  becomeArtist: () => Promise<void>
}
const AuthContext = createContext<AuthState | null>(null)
const notConfigured = () => {
  throw new Error(tr("auth.error.notConfigured"))
}

const metadataRole = (user: User): AccountRole =>
  user.user_metadata?.role === "artist" ? "artist" : "collector"

const metadataProfile = (user: User): ProfileSummary => {
  const username = String(user.user_metadata?.username || user.email?.split("@")[0] || "Collector")
  return { username, publicName: username, avatarUrl: user.user_metadata?.avatar_url || null }
}

async function fetchAccount(
  user: User,
): Promise<{ role: AccountRole; profile: ProfileSummary }> {
  const fallback = { role: metadataRole(user), profile: metadataProfile(user) }
  if (!supabase) return fallback
  const { data } = await supabase
    .from("profiles")
    .select("role, username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle()
  if (!data) return fallback
  return {
    role: (data.role as AccountRole) ?? fallback.role,
    profile: {
      username: data.username || fallback.profile.username,
      publicName: data.display_name || data.username || fallback.profile.publicName,
      avatarUrl: data.avatar_url ?? fallback.profile.avatarUrl,
    },
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<AccountRole | null>(null)
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [readiness, setReadiness] = useState<Readiness>({ bid: [], sell: [] })
  const [recovering, setRecovering] = useState(false)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === "PASSWORD_RECOVERY") setRecovering(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Keep role in sync with the signed-in user.
  const userId = user?.id
  useEffect(() => {
    if (!user) {
      setRole(null)
      setProfile(null)
      setReadiness({ bid: [], sell: [] })
      return
    }
    setRole(metadataRole(user))
    setProfile(metadataProfile(user))
    let cancelled = false
    void Promise.all([fetchAccount(user), getReadiness()]).then(
      ([next, ready]) => {
        if (cancelled) return
        setRole(next.role)
        setProfile(next.profile)
        setReadiness(ready)
      },
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const unwrap = (error: { message: string } | null) => {
    if (error) throw new Error(error.message)
  }

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return notConfigured()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    unwrap(error)
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    if (!supabase) return notConfigured()
    const firstName = input.firstName.trim()
    const lastName = input.lastName.trim()
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          first_name: firstName,
          last_name: lastName,
          display_name: `${firstName} ${lastName}`.trim(),
          role: input.role,
        },
      },
    })
    unwrap(error)
    // Supabase returns a user with no identities when the email already exists.
    if (data.user && data.user.identities?.length === 0)
      throw new Error("An account with this email already exists. Try signing in.")
    return { needsConfirmation: !data.session }
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!supabase) return notConfigured()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    unwrap(error)
  }, [])

  const resendConfirmation = useCallback(async (email: string) => {
    if (!supabase) return notConfigured()
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() })
    unwrap(error)
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) return notConfigured()
    const { error } = await supabase.auth.updateUser({ password })
    unwrap(error)
    setRecovering(false)
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    // "local" clears this browser's session even if the network call fails.
    const { error } = await supabase.auth.signOut({ scope: "local" })
    setUser(null)
    unwrap(error)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const [next, ready] = await Promise.all([fetchAccount(user), getReadiness()])
    setRole(next.role)
    setProfile(next.profile)
    setReadiness(ready)
  }, [user])

  const becomeArtist = useCallback(async () => {
    if (!supabase || !user) return notConfigured()
    const { error } = await supabase.rpc("become_artist")
    unwrap(error)
    setRole("artist")
  }, [user])

  // Memoised so consumers don't re-render on every provider render.
  const value = useMemo<AuthState>(
    () => ({
      user,
      role,
      profile,
      readiness,
      recovering,
      refreshProfile,
      loading,
      configured: Boolean(supabase),
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      resendConfirmation,
      updatePassword,
      becomeArtist,
    }),
    [
      user,
      role,
      profile,
      readiness,
      recovering,
      refreshProfile,
      loading,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      resendConfirmation,
      updatePassword,
      becomeArtist,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside AuthProvider")
  return context
}
