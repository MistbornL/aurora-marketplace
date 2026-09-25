// Builds a 3D stretched canvas at the artwork's true size from its photo,
// and exports it as a GLB that <model-viewer> can place on a wall.
// Units are metres. +Z faces out of the wall; the back sits at z = 0.
import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { API_URL } from "../../../lib/api-client"
import type { SizeCm } from "../../../lib/artwork-size"
import { supabase } from "../../../lib/supabase"

const MAX_TEXTURE = 2048
const DEFAULT_DEPTH_CM = 3 // a standard stretcher bar
const AR_MODEL_BUCKET = "ar-models"

async function loadImage(url: string) {
  const img = new Image()
  img.crossOrigin = "anonymous" // needed to read pixels into a texture
  img.decoding = "async"
  img.src = url
  await img.decode()
  return img
}

/** Draws the photo into a canvas with the artwork's aspect ratio (cover-crop). */
function toTextureCanvas(img: HTMLImageElement, size: SizeCm) {
  const aspect = size.width / size.height
  const w = aspect >= 1 ? MAX_TEXTURE : Math.round(MAX_TEXTURE * aspect)
  const h = aspect >= 1 ? Math.round(MAX_TEXTURE / aspect) : MAX_TEXTURE
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unavailable")
  // Photos are rarely cropped exactly to the canvas edge; fill without stretching.
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
  return canvas
}

function buildCanvasMesh(texCanvas: HTMLCanvasElement, size: SizeCm) {
  const W = size.width / 100
  const H = size.height / 100
  const D = (size.depth ?? DEFAULT_DEPTH_CM) / 100

  const texture = new THREE.CanvasTexture(texCanvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const face = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0 })
  const edge = new THREE.MeshStandardMaterial({ color: 0xe6dfd0, roughness: 0.95 })
  // BoxGeometry material order: +x, -x, +y, -y, +z (front), -z (back)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [edge, edge, edge, edge, face, edge])
  mesh.position.z = D / 2
  const group = new THREE.Group()
  group.add(mesh)
  return group
}

/**
 * Returns a blob URL for the GLB plus a small poster image, and the raw GLB
 * bytes so the caller can also cache it server-side (see `cacheArModel`).
 * The caller owns the blob URL and should revoke it when done.
 */
export async function buildArtworkGlb(imageUrl: string, size: SizeCm) {
  const img = await loadImage(imageUrl)
  const texCanvas = toTextureCanvas(img, size)
  const glb = (await new GLTFExporter().parseAsync(buildCanvasMesh(texCanvas, size), {
    binary: true,
    maxTextureSize: MAX_TEXTURE,
  })) as ArrayBuffer
  return {
    url: URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" })),
    poster: texCanvas.toDataURL("image/jpeg", 0.6),
    glb,
  }
}

/** Same rounding the server uses, so both sides land on the same cache path. */
function sizeKey(size: SizeCm) {
  const round = (n: number) => n.toFixed(1)
  return `${round(size.width)}x${round(size.height)}x${round(size.depth ?? 0)}`
}

/**
 * A previously cached real https URL for this artwork + size, if there is
 * one — a plain blob: URL (what we build in-browser) works for WebXR and iOS
 * Quick Look, but Android's Scene Viewer can only fetch a real URL.
 */
export async function cachedArModelUrl(artworkId: string, size: SizeCm) {
  if (!supabase) return null
  const path = `${artworkId}/${sizeKey(size)}.glb`
  const { data } = supabase.storage.from(AR_MODEL_BUCKET).getPublicUrl(path)
  try {
    const response = await fetch(data.publicUrl, { method: "HEAD" })
    return response.ok ? data.publicUrl : null
  } catch {
    return null
  }
}

/**
 * Uploads a freshly built GLB so later viewers — and Android's Scene Viewer
 * for this same visit — can use a real URL instead of the page's blob: one.
 * Best-effort: the in-page blob URL already works without this, so failures
 * (offline, storage hiccup) are swallowed rather than shown to the viewer.
 */
export async function cacheArModel(artworkId: string, size: SizeCm, glb: ArrayBuffer) {
  try {
    const params = new URLSearchParams({ w: String(size.width), h: String(size.height) })
    if (size.depth) params.set("d", String(size.depth))
    const response = await fetch(
      `${API_URL}/artworks/${encodeURIComponent(artworkId)}/ar-model?${params}`,
      { method: "POST", headers: { "Content-Type": "model/gltf-binary" }, body: glb },
    )
    if (!response.ok) return null
    const data = (await response.json()) as { url?: string }
    return data.url ?? null
  } catch {
    return null
  }
}
