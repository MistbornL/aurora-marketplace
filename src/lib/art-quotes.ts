import { useEffect, useState } from "react"

/** Short, widely quoted lines about art, shown in waiting moments (loader, waiting room, after a win). */
export type ArtQuote = { en: string; ka: string; author: string }

export const ART_QUOTES: readonly ArtQuote[] = [
  { en: "Color is a power which directly influences the soul.", ka: "ფერი ძალაა, რომელიც უშუალოდ მოქმედებს სულზე.", author: "Wassily Kandinsky" },
  { en: "Creativity takes courage.", ka: "შემოქმედებას გაბედულება სჭირდება.", author: "Henri Matisse" },
  { en: "Every artist was first an amateur.", ka: "ყველა მხატვარი თავიდან მოყვარული იყო.", author: "Ralph Waldo Emerson" },
  { en: "Art washes away from the soul the dust of everyday life.", ka: "ხელოვნება სულიდან ყოველდღიურობის მტვერს ჩამორეცხავს.", author: "Pablo Picasso" },
  { en: "I paint myself because I am the subject I know best.", ka: "საკუთარ თავს ვხატავ, რადგან ეს ის თემაა, რომელსაც საუკეთესოდ ვიცნობ.", author: "Frida Kahlo" },
  { en: "I saw the angel in the marble and carved until I set him free.", ka: "მარმარილოში ანგელოზი დავინახე და ვკვეთდი, სანამ არ გავათავისუფლე.", author: "Michelangelo" },
  { en: "Art is not what you see, but what you make others see.", ka: "ხელოვნება ის კი არ არის, რასაც შენ ხედავ, არამედ ის, რასაც სხვებს დაანახებ.", author: "Edgar Degas" },
  { en: "A work which did not begin in emotion is not art.", ka: "ნამუშევარი, რომელიც ემოციით არ დაწყებულა, ხელოვნება არ არის.", author: "Paul Cézanne" },
  { en: "I found I could say things with color and shapes that I couldn’t say any other way.", ka: "მივხვდი, რომ ფერებითა და ფორმებით ისეთ რამეებს ვამბობდი, რასაც სხვაგვარად ვერ ვიტყოდი.", author: "Georgia O’Keeffe" },
  { en: "If you hear a voice within you say “you cannot paint,” then by all means paint.", ka: "თუ შენში ხმა გეუბნება „ვერ დახატავ“, აუცილებლად დახატე.", author: "Vincent van Gogh" },
  { en: "Have no fear of perfection — you’ll never reach it.", ka: "სრულყოფილების ნუ შეგეშინდება — მაინც ვერასოდეს მიაღწევ.", author: "Salvador Dalí" },
  { en: "I’m interested only in expressing basic human emotions.", ka: "მხოლოდ ადამიანის ძირითადი ემოციების გამოხატვა მაინტერესებს.", author: "Mark Rothko" },
]

const pick = (not?: number) => {
  let index = Math.floor(Math.random() * ART_QUOTES.length)
  if (index === not) index = (index + 1) % ART_QUOTES.length
  return index
}

/** A random quote that stays the same for the life of the component; optionally rotates. */
export function useArtQuote(rotateMs = 0) {
  const [index, setIndex] = useState(() => pick())
  useEffect(() => {
    if (!rotateMs) return
    const timer = setInterval(() => setIndex((current) => pick(current)), rotateMs)
    return () => clearInterval(timer)
  }, [rotateMs])
  return ART_QUOTES[index]
}
