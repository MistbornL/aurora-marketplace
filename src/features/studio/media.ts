import { tr } from "../../lib/i18n"
import { requireSupabase } from "../../lib/supabase"

const MAX_IMAGE_BYTES = 6 * 1024 * 1024
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export function validateArtworkImage(file: File | undefined) {
  if (!file) return undefined
  if (!IMAGE_TYPES.has(file.type)) return tr("studio.validation.imageType")
  if (file.size > MAX_IMAGE_BYTES) return tr("studio.validation.imageSize")
  return undefined
}

export async function uploadArtworkImage(userId: string, file: File) {
  const supabase = requireSupabase()
  const validationError = validateArtworkImage(file)
  if (validationError) throw new Error(validationError)
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from("artwork-images")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    })
  if (error) throw error
  return supabase.storage.from("artwork-images").getPublicUrl(path).data
    .publicUrl
}
