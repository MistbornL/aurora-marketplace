// A tiny event bus so any screen can say "this person just won a lot" and the
// SoldCelebration overlay (mounted once in the app shell) plays the moment.
export type SoldMoment = {
  title: string
  amount: number
  image?: string
  /** Where "Go to payment" leads — an order page, or the dashboard. */
  href?: string
}

const EVENT = "tsiskari:sold"
const shown = new Set<string>()

export function celebrateSold(moment: SoldMoment & { key?: string }) {
  // Never replay the same win (polling can see "ended" many times).
  const key = moment.key ?? `${moment.title}:${moment.amount}`
  if (shown.has(key)) return
  shown.add(key)
  window.dispatchEvent(new CustomEvent<SoldMoment>(EVENT, { detail: moment }))
}

export function onSold(handler: (moment: SoldMoment) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<SoldMoment>).detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
