import type { User } from "@supabase/supabase-js"
import { supabase } from "../../lib/supabase"
import type { AccountRole } from "../../types"
import { tr, type MessageKey } from "../../lib/i18n"

export type Profile = {
  id: string
  username: string
  bio: string
  website: string
  instagram: string
  x_handle: string
  avatar_url: string | null
  cover_url: string | null
  location: string
  role: AccountRole
  /** How the person appears publicly (artist page, bid history, chat). */
  name_display: NameDisplay
  /** Computed by the DB from name_display (read-only). */
  display_name: string
}

export type NameDisplay = "username" | "full_name" | "both"

const fallbackProfile = (user: User): Profile => ({
  id: user.id,
  username: String(
    user.user_metadata.username ||
      user.user_metadata.display_name ||
      user.email?.split("@")[0] ||
      "",
  ),
  bio: String(user.user_metadata.bio || ""),
  website: String(user.user_metadata.website || ""),
  instagram: String(user.user_metadata.instagram || ""),
  x_handle: String(user.user_metadata.x_handle || ""),
  avatar_url: user.user_metadata.avatar_url || null,
  cover_url: user.user_metadata.cover_url || null,
  location: String(user.user_metadata.location || ""),
  role: user.user_metadata.role === "artist" ? "artist" : "collector",
  name_display: "username",
  display_name: String(user.user_metadata.username || user.email?.split("@")[0] || ""),
})

export async function getProfile(user: User): Promise<Profile> {
  if (!supabase) return fallbackProfile(user)
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, bio, website, instagram, x_handle, avatar_url, cover_url, location, role, name_display, display_name",
    )
    .eq("id", user.id)
    .maybeSingle()
  if (error || !data) return fallbackProfile(user)
  return { ...fallbackProfile(user), ...data }
}

export async function saveProfile(
  user: User,
  profile: Profile,
  avatar?: File,
  cover?: File,
): Promise<Profile> {
  if (!supabase) throw new Error(tr("profile.error.notConfigured"))
  const client = supabase
  const upload = async (file: File, name: "avatar" | "cover") => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const path = `${user.id}/${name}.${extension}`
    const { error: uploadError } = await client.storage
      .from("avatars")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      })
    if (uploadError) throw uploadError
    // Cache-bust so the new image shows immediately after re-upload.
    return `${client.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
  }
  const avatar_url = avatar ? await upload(avatar, "avatar") : profile.avatar_url
  const cover_url = cover ? await upload(cover, "cover") : profile.cover_url
  const payload = {
    id: user.id,
    username: profile.username.trim(),
    bio: profile.bio.trim(),
    website: profile.website.trim(),
    instagram: profile.instagram.trim(),
    x_handle: profile.x_handle.trim(),
    avatar_url,
    cover_url,
    location: profile.location.trim(),
    name_display: profile.name_display,
  }
  // `role` is intentionally not part of the payload: it's server-controlled.
  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload)
    .select(
      "id, username, bio, website, instagram, x_handle, avatar_url, cover_url, location, role, name_display, display_name",
    )
    .single()
  if (error) throw error
  const { error: userError } = await supabase.auth.updateUser({ data: payload })
  if (userError) throw userError
  return data as Profile
}

// ── Private details (owner-only table `profile_private`) ─────────────────────
export type PrivateProfile = {
  first_name: string
  last_name: string
  phone: string
}

export const emptyPrivateProfile: PrivateProfile = {
  first_name: "",
  last_name: "",
  phone: "",
}

export async function getPrivateProfile(user: User): Promise<PrivateProfile> {
  const fallback = {
    first_name: String(user.user_metadata?.first_name ?? ""),
    last_name: String(user.user_metadata?.last_name ?? ""),
    phone: "",
  }
  if (!supabase) return fallback
  const { data } = await supabase
    .from("profile_private")
    .select("first_name, last_name, phone")
    .eq("id", user.id)
    .maybeSingle()
  return data ?? fallback
}

export async function savePrivateProfile(user: User, values: PrivateProfile) {
  if (!supabase) throw new Error(tr("profile.error.notConfigured"))
  const { error } = await supabase.from("profile_private").upsert({
    id: user.id,
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    phone: values.phone.trim(),
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

// ── Readiness: what's still missing before bidding / selling ─────────────────
export type MissingField = "name" | "phone" | "location" | "bio"
export type Readiness = { bid: MissingField[]; sell: MissingField[] }

export async function getReadiness(): Promise<Readiness> {
  if (!supabase) return { bid: [], sell: [] }
  const { data, error } = await supabase.rpc("account_readiness")
  if (error || !data) return { bid: [], sell: [] }
  return data as Readiness
}

/** Message keys — translate with t() when rendering. */
export const MISSING_LABELS: Record<MissingField, MessageKey> = {
  name: "profile.missing.name",
  phone: "profile.missing.phone",
  location: "profile.missing.location",
  bio: "profile.missing.bio",
}

/** Update just the public selling details (location / bio). */
export async function savePublicDetails(
  user: User,
  values: { location: string; bio: string },
) {
  if (!supabase) throw new Error(tr("profile.error.notConfigured"))
  const { error } = await supabase
    .from("profiles")
    .update({
      location: values.location.trim(),
      bio: values.bio.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
  if (error) throw new Error(error.message)
}

/** Remember the interface language (used for notification emails). */
export async function saveLocale(userId: string, locale: "en" | "ka") {
  if (!supabase) return
  await supabase.from("profiles").update({ locale }).eq("id", userId)
}

// ── Payout details (artists) — private, only admins see them at payout time ──
export type PayoutDetails = { holder: string; iban: string; bank: string }

export async function getPayoutDetails(userId: string): Promise<PayoutDetails> {
  if (!supabase) return { holder: "", iban: "", bank: "" }
  const { data } = await supabase
    .from("profile_private")
    .select("payout_holder, payout_iban, payout_bank")
    .eq("id", userId)
    .maybeSingle()
  return {
    holder: data?.payout_holder ?? "",
    iban: data?.payout_iban ?? "",
    bank: data?.payout_bank ?? "",
  }
}

export async function savePayoutDetails(userId: string, details: PayoutDetails) {
  if (!supabase) throw new Error("Supabase is not configured")
  const { error } = await supabase.from("profile_private").upsert({
    id: userId,
    payout_holder: details.holder.trim(),
    payout_iban: details.iban.replace(/\s+/g, "").toUpperCase(),
    payout_bank: details.bank.trim(),
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

/** Default delivery address saved from the last order. */
export async function getDeliveryDefaults(userId: string) {
  if (!supabase) return null
  const { data } = await supabase
    .from("profile_private")
    .select("first_name, last_name, phone, ship_city, ship_address")
    .eq("id", userId)
    .maybeSingle()
  return data
}
