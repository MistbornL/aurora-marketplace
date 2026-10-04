// Keeps the document title and social-preview tags in step with the page, for
// search engines that run JavaScript. Link-preview bots that don't are served
// by the API's /seo/artworks/:id endpoint (see vercel.json).
function setTag(selector: string, attr: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector)
  if (!tag) {
    tag = document.createElement("meta")
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute("content", content)
}

export function setPageMeta({
  title,
  description,
  image,
  url,
}: {
  title: string
  description?: string
  image?: string
  url?: string
}) {
  document.title = title
  const abs = (value: string) => (value.startsWith("http") ? value : `${location.origin}${value}`)
  setTag('meta[property="og:title"]', "property", "og:title", title)
  setTag('meta[name="twitter:title"]', "name", "twitter:title", title)
  if (description) {
    const text = description.replace(/\s+/g, " ").trim().slice(0, 200)
    setTag('meta[name="description"]', "name", "description", text)
    setTag('meta[property="og:description"]', "property", "og:description", text)
    setTag('meta[name="twitter:description"]', "name", "twitter:description", text)
  }
  if (image) {
    setTag('meta[property="og:image"]', "property", "og:image", abs(image))
    setTag('meta[name="twitter:image"]', "name", "twitter:image", abs(image))
  }
  if (url) setTag('meta[property="og:url"]', "property", "og:url", abs(url))
}
