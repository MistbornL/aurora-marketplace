// Physical artwork size in centimetres. Numeric columns (width_cm/height_cm)
// win; older lots only have a label such as "80 × 60 cm", read as width × height.

export type SizeCm = { width: number; height: number; depth: number | null }

const SIZE_RE = /(\d+(?:[.,]\d+)?)\s*[×xX*]\s*(\d+(?:[.,]\d+)?)(?:\s*[×xX*]\s*(\d+(?:[.,]\d+)?))?/

const toNum = (value: string | undefined) => (value == null ? null : Number(value.replace(",", ".")))
const inRange = (n: number | null | undefined, max: number): n is number => n != null && n > 0 && n <= max

/** Parses "80 × 60 cm" / "80x60" / "80 × 60 × 3 cm". */
export function parseSizeLabel(label: string | null | undefined): SizeCm | null {
  const match = label?.match(SIZE_RE)
  if (!match) return null
  const width = toNum(match[1])
  const height = toNum(match[2])
  const depth = toNum(match[3])
  if (!inRange(width, 1000) || !inRange(height, 1000)) return null
  return { width, height, depth: inRange(depth, 200) ? depth : null }
}

/** Best available size for an artwork, or null if we can't tell. */
export function artworkSizeCm(art: {
  widthCm?: number | null
  heightCm?: number | null
  depthCm?: number | null
  dimensions?: string | null
}): SizeCm | null {
  if (inRange(art.widthCm, 1000) && inRange(art.heightCm, 1000))
    return { width: art.widthCm, height: art.heightCm, depth: inRange(art.depthCm, 200) ? art.depthCm : null }
  return parseSizeLabel(art.dimensions)
}

const trim = (n: number) => String(Math.round(n * 10) / 10)

/** "60 × 80 cm" (or "60 × 80 × 3 cm"); `unit` lets Georgian use "სმ". */
export function formatSize(width: number, height: number, depth?: number | null, unit = "cm") {
  return `${trim(width)} × ${trim(height)}${depth ? ` × ${trim(depth)}` : ""} ${unit}`
}
