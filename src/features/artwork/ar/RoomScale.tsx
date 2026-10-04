import type { SizeCm } from "../../../lib/artwork-size"

const SOFA_CM = 210
const WALL_CM = 330
const VIEW_W = 330
const VIEW_H = 200

/**
 * A no-camera size check: the painting drawn at true scale on a wall next to a
 * standard sofa. Helps when AR can't find a wall, and sets expectations before.
 */
export function RoomScale({ image, size, title }: { image: string; size: SizeCm; title: string }) {
  const k = VIEW_W / WALL_CM // px per cm
  const floor = VIEW_H - 24
  // Keep very large works inside the picture.
  const fit = Math.min(1, (floor - 14) / (size.height * k), (VIEW_W - 24) / (size.width * k))
  const w = size.width * k * fit
  const h = size.height * k * fit
  const sofaW = SOFA_CM * k
  const sofaH = 85 * k
  const sofaX = VIEW_W - sofaW - 14
  const artX = Math.max(10, sofaX + sofaW / 2 - w / 2 - (w > sofaW ? 0 : 0))
  const artY = Math.max(8, floor - sofaH - 22 * k - h)

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={title}
      className="w-full rounded-2xl ring-1 ring-white/[.08]"
    >
      <rect width={VIEW_W} height={VIEW_H} fill="#2a2330" />
      <rect y={floor} width={VIEW_W} height={VIEW_H - floor} fill="#1b171d" />
      <rect y={floor - 1} width={VIEW_W} height="2" fill="#3a3040" />
      {/* sofa */}
      <g fill="#4a3d52">
        <rect x={sofaX} y={floor - sofaH} width={sofaW} height={sofaH} rx="10" />
        <rect x={sofaX - 8} y={floor - sofaH * 0.62} width="16" height={sofaH * 0.62} rx="6" fill="#56475e" />
        <rect x={sofaX + sofaW - 8} y={floor - sofaH * 0.62} width="16" height={sofaH * 0.62} rx="6" fill="#56475e" />
        <rect x={sofaX + 10} y={floor - sofaH * 0.55} width={sofaW - 20} height={sofaH * 0.4} rx="6" fill="#5f4f69" />
      </g>
      {/* painting */}
      <image
        href={image}
        x={artX}
        y={artY}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMid slice"
      />
      <rect x={artX} y={artY} width={w} height={h} fill="none" stroke="#f6a87b" strokeOpacity=".55" />
      <text x={artX + w / 2} y={artY - 5} textAnchor="middle" fontSize="9" fill="#f6a87b" fontFamily="ui-monospace,monospace">
        {size.width} × {size.height} cm
      </text>
    </svg>
  )
}
