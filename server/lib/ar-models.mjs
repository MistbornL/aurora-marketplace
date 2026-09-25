// Stores a client-built GLB (the "View on your wall" 3D canvas, built from
// the artwork photo at its true size) in Supabase Storage, so Android's Scene
// Viewer — which can't read a page's blob: URL, only a real https one — has
// something to fetch. WebXR (most of Chrome on Android) and iOS Quick Look
// already work straight from the in-page blob URL; this only unlocks Scene
// Viewer's non-WebXR fallback path.
//
// Same artwork id + size always maps to the same storage path, so the first
// visitor to view a given artwork "pays" the upload once and everyone after
// gets the cached URL — and it self-heals if the artist changes the size,
// since that changes the path.
import "./env.mjs"
import { httpError } from "./demo-store.mjs"

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const BUCKET = "ar-models"
const MAX_BYTES = 8 * 1024 * 1024
const GLB_MAGIC = Buffer.from("glTF", "ascii") // binary glTF file header

export const arModelsConfigured = Boolean(url && serviceKey)

function serviceHeaders() {
  // service_role JWTs also work as a Bearer token.
  return serviceKey.startsWith("sb_secret_")
    ? { apikey: serviceKey }
    : { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
}

/** widthCm/heightCm/depthCm -> a normalized, filesystem-safe cache key. */
export function arModelSizeKey(width, height, depth) {
  const round = (n) => (Number.isFinite(n) ? n.toFixed(1) : "0.0")
  return `${round(width)}x${round(height)}x${round(depth || 0)}`
}

export function publicArModelUrl(artworkId, sizeKey) {
  return `${url}/storage/v1/object/public/${BUCKET}/${artworkId}/${sizeKey}.glb`
}

export async function storeArModel(artworkId, sizeKey, bytes) {
  if (!arModelsConfigured) throw httpError(503, "AR model storage isn't configured")
  if (bytes.length < 16 || bytes.length > MAX_BYTES)
    throw httpError(413, "That model file is the wrong size")
  if (!bytes.subarray(0, 4).equals(GLB_MAGIC)) throw httpError(422, "Not a glTF binary file")

  const path = `${artworkId}/${sizeKey}.glb`
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "model/gltf-binary",
      "x-upsert": "true",
      ...serviceHeaders(),
    },
    body: bytes,
  })
  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw httpError(502, `Couldn't store the 3D model (${response.status}) ${text.slice(0, 200)}`)
  }
  return publicArModelUrl(artworkId, sizeKey)
}
