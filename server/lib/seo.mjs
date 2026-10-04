// Search / link-preview support for a single-page app: the browser app can't
// give crawlers per-artwork tags, so Vercel rewrites crawler requests for
// /artworks/:id to /api/seo/artworks/:id (see vercel.json), which returns a
// tiny HTML page with the right Open Graph tags + schema.org data. Real
// visitors are redirected straight to the app.
const appUrl = (process.env.APP_URL || "https://tsiskariart.ge").replace(/\/$/, "")

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

const absolute = (src) => (!src ? `${appUrl}/og-image.jpg` : /^https?:/.test(src) ? src : `${appUrl}${src.startsWith("/") ? "" : "/"}${src}`)

export function artworkPage(art) {
  const url = `${appUrl}/artworks/${art.id}`
  const title = `${art.title} — ${art.artist} · TSISKARI`
  const description = String(
    art.description || `${art.title} by ${art.artist}. Current bid ${art.currentBid}₾ — live auction on TSISKARI.`,
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
  const image = absolute(art.image)
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: art.title,
    description,
    image,
    url,
    brand: { "@type": "Brand", name: "TSISKARI" },
    creator: { "@type": "Person", name: art.artist },
    offers: {
      "@type": "Offer",
      price: String(art.currentBid ?? 0),
      priceCurrency: "GEL",
      availability: ["live", "closing", "upcoming"].includes(art.status)
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
      url,
    },
  }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TSISKARI">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<script>location.replace(${JSON.stringify(url)})</script>
</head><body><h1>${esc(art.title)}</h1><p>${esc(art.artist)}</p><img src="${esc(image)}" alt="${esc(art.title)}"><p>${esc(description)}</p><p><a href="${esc(url)}">${esc(url)}</a></p></body></html>`
}

export function artworksSitemap({ artworks, artists }) {
  const urls = [
    ...artworks.map((a) => ({ loc: `${appUrl}/artworks/${a.id}`, freq: "hourly", prio: "0.8" })),
    ...artists.map((a) => ({ loc: `${appUrl}/artists/${a.id}`, freq: "daily", prio: "0.6" })),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url><loc>${esc(u.loc)}</loc><changefreq>${u.freq}</changefreq><priority>${u.prio}</priority></url>`)
  .join("\n")}
</urlset>
`
}
