import { useI18n } from "../lib/i18n"
import { useArtQuote } from "../lib/art-quotes"

/** One line about art with its author. Used in quiet moments: loading, waiting rooms, after a win. */
export function ArtQuote({ rotateMs = 0, className = "" }: { rotateMs?: number; className?: string }) {
  const { lang } = useI18n()
  const quote = useArtQuote(rotateMs)
  return (
    <figure key={quote.author + quote.en} className={`animate-in fade-in-0 duration-700 ${className}`}>
      <blockquote className="art-quote-text font-display italic leading-relaxed">“{lang === "ka" ? quote.ka : quote.en}”</blockquote>
      <figcaption className="mt-1 text-[11px] not-italic tracking-wide opacity-70">— {quote.author}</figcaption>
    </figure>
  )
}
