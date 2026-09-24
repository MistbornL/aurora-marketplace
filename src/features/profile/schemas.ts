import type { Resolver } from "react-hook-form"
import type { Profile } from "./api"
import { tr, type MessageKey } from "../../lib/i18n"

export type ProfileFormData = Pick<
  Profile,
  "username" | "location" | "website" | "instagram" | "bio" | "x_handle" | "name_display"
> & {
  avatar?: FileList
  cover?: FileList
  // Private (profile_private): never shown publicly.
  first_name: string
  last_name: string
  phone: string
}

export const profileResolver: Resolver<ProfileFormData> = async (values) => {
  const errors: Record<string, { type: string; message: string }> = {}
  if (values.username.trim().length < 3)
    errors.username = {
      type: "minLength",
      message: tr("profile.validation.usernameMin"),
    }
  if (values.name_display !== "username" && !(values.first_name.trim() && values.last_name.trim()))
    errors.name_display = {
      type: "required",
      message: tr("profile.validation.nameForPublic"),
    }
  if (values.phone && values.phone.replace(/\D/g, "").length < 7)
    errors.phone = { type: "pattern", message: tr("profile.validation.phone") }
  if (values.bio.length > 800)
    errors.bio = {
      type: "maxLength",
      message: tr("profile.validation.bioMax"),
    }
  return Object.keys(errors).length
    ? { values: {}, errors }
    : { values, errors: {} }
}

/** Labels/placeholders are message keys — translate with t() when rendering. */
export const profileTextFields = [
  { name: "username", label: "profile.field.username", placeholder: "profile.field.usernamePlaceholder" },
  { name: "location", label: "profile.field.location", placeholder: "profile.field.locationPlaceholder" },
  { name: "website", label: "profile.field.website", placeholder: "profile.field.websitePlaceholder" },
  { name: "instagram", label: "profile.field.instagram", placeholder: "profile.field.handlePlaceholder" },
  { name: "x_handle", label: "profile.field.xHandle", placeholder: "profile.field.handlePlaceholder" },
] as const satisfies ReadonlyArray<{ name: string; label: MessageKey; placeholder: MessageKey }>
