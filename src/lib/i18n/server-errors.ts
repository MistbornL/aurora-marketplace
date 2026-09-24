// Database / API / Supabase Auth messages arrive in English. Known ones are
// translated; unknown ones pass through unchanged.
import type { MessageKey } from "./messages"

type Translate = (key: MessageKey, vars?: Record<string, string>) => string

const P: Array<[RegExp, MessageKey]> = [
  [/counter-offer must be higher than the top bid \((?<amount>[\d.]+)₾\)/i, "errors.counterTooLow"],
  [/Add your location and a short bio/i, "errors.publishNeedsProfile"],
  [/doesn.t match total due/i, "errors.amountMismatch"],
  [/can.t go back to draft/i, "errors.noBackToDraft"],
  [/is not accepting bids/i, "errors.notAcceptingBids"],
  [/^Auction not found/i, "errors.auctionNotFound"],
  [/Auctions end automatically/i, "errors.auctionsEndAutomatically"],
  [/Authentication required|Sign in to continue/i, "errors.signInRequired"],
  [/Bid must be at least (?<amount>[\d.]+)₾/i, "errors.bidMin"],
  [/Bidding hasn.t started yet/i, "errors.biddingNotStarted"],
  [/Bids must increase in (?<amount>[\d.]+)₾ steps/i, "errors.bidSteps"],
  [/Buy it now ended/i, "errors.buyNowEnded"],
  [/Complete your bidder profile .* to buy/i, "errors.completeProfileToBuy"],
  [/Complete your bidder profile/i, "errors.completeProfileToBid"],
  [/Live auctions need a start time/i, "errors.liveNeedsStart"],
  [/^Not allowed/i, "errors.notAllowed"],
  [/Only paid orders can be marked as shipped/i, "errors.onlyPaidShip"],
  [/Order can.t be cancelled/i, "errors.orderCantCancel"],
  [/Order can.t be marked paid/i, "errors.orderCantMarkPaid"],
  [/^Order not found/i, "errors.orderNotFound"],
  [/Payouts are released after delivery/i, "errors.payoutAfterDelivery"],
  [/Pricing is locked/i, "errors.pricingLocked"],
  [/cannot bid on their own|can.t bid on your own/i, "errors.ownAuction"],
  [/^Sign in to buy/i, "errors.signInToBuy"],
  [/^Sign in to place a bid/i, "errors.signInToBid"],
  [/counter-offer has expired/i, "errors.counterExpired"],
  [/decision window has closed/i, "errors.decisionClosed"],
  [/most you can bid is (?<amount>[\d.]+)₾/i, "errors.bidMax"],
  [/payment window has closed/i, "errors.paymentWindowClosed"],
  [/reserve is locked/i, "errors.reserveLocked"],
  [/reserve must be higher than the opening bid/i, "errors.reserveAboveOpening"],
  [/no counter-offer to answer/i, "errors.noCounter"],
  [/nothing to decide/i, "errors.nothingToDecide"],
  [/has no Buy it now price/i, "errors.noBuyNow"],
  [/auction has finished/i, "errors.auctionFinished"],
  [/no longer available/i, "errors.noLongerAvailable"],
  [/can.t be confirmed yet/i, "errors.orderCantConfirm"],
  [/isn.t waiting for payment/i, "errors.orderNotAwaitingPayment"],
  [/only auction your own artworks/i, "errors.ownArtworksOnly"],
  [/can.t buy your own artwork/i, "errors.cantBuyOwn"],
  [/already the highest bidder/i, "errors.alreadyHighest"],
  [/^Artwork not found/i, "errors.artworkNotFound"],
  [/Demo lots can.t be bought/i, "errors.demoNoBuyNow"],
  [/Enter a valid bid amount/i, "errors.invalidBid"],
  [/Enter a valid counter-offer/i, "errors.invalidCounter"],
  [/This auction has ended/i, "errors.auctionEnded"],
  [/Invalid login credentials/i, "errors.invalidLogin"],
  [/already registered|already exists/i, "errors.userExists"],
  [/Email not confirmed/i, "errors.emailNotConfirmed"],
  [/Password should be at least (?<amount>\d+)/i, "errors.weakPassword"],
  [/rate limit|too many requests/i, "errors.rateLimit"],
  [/Failed to fetch|NetworkError|Load failed/i, "errors.network"],
]

export function translateServerError(message: string, t: Translate) {
  for (const [pattern, key] of P) {
    const match = message.match(pattern)
    if (match) return t(key, match.groups ? { ...match.groups } : undefined)
  }
  return message
}
