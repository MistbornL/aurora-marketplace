/**
 * A cinematic image behind the top of a page (same world as the landing film),
 * fading into the page colour so headings on top stay readable.
 * Parent needs `relative isolate`.
 */
export function PageBackdrop({ src, position = "center" }: { src: string; position?: string }) {
  return (
    <div aria-hidden className="page-backdrop pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden">
      <img src={src} alt="" decoding="async" fetchPriority="high" style={{ objectPosition: position }} />
    </div>
  )
}
