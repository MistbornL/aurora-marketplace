import { tr } from "../../lib/i18n"
import type { Resolver } from "react-hook-form"
import { validateArtworkImage } from "./media"
import type { AuctionFormData } from "./types"

export const ARTWORK_CATEGORIES = [
  "Painting",
  "Drawing",
  "Photography",
  "Digital Art",
  "Sculpture",
  "Handmade",
] as const

export const createAuctionResolver =
  (requireImage: boolean, timingLocked = false): Resolver<AuctionFormData> =>
  async (values) => {
    const errors: Record<string, { type: string; message: string }> = {}
    if (values.title.trim().length < 2)
      errors.title = { type: "minLength", message: tr("studio.validation.title") }
    if (!(Number(values.openingBid) > 0))
      errors.openingBid = {
        type: "positive",
        message: tr("studio.validation.openingBid"),
      }
    if (!(Number(values.bidIncrement) > 0))
      errors.bidIncrement = {
        type: "positive",
        message: tr("studio.validation.bidStep"),
      }
    if (values.format === "live") {
      if (!values.startsAt)
        errors.startsAt = { type: "required", message: tr("studio.validation.startRequired") }
      else if (!timingLocked && new Date(values.startsAt).getTime() <= Date.now() + 60_000)
        errors.startsAt = { type: "future", message: tr("studio.validation.startFuture") }
    } else if (!values.endsAt)
      errors.endsAt = {
        type: "required",
        message: tr("studio.validation.endRequired"),
      }
    else if (!timingLocked && new Date(values.endsAt).getTime() <= Date.now())
      errors.endsAt = {
        type: "future",
        message: tr("studio.validation.endFuture"),
      }
    const opening = Number(values.openingBid)
    const buyNow = values.buyNowPrice === "" ? null : Number(values.buyNowPrice)
    const reserve = values.reservePrice === "" ? null : Number(values.reservePrice)
    if (buyNow != null && !(buyNow > opening))
      errors.buyNowPrice = { type: "min", message: tr("studio.validation.buyNowAboveOpening") }
    if (reserve != null && !(reserve > opening))
      errors.reservePrice = { type: "min", message: tr("studio.validation.reserveAboveOpening") }
    else if (reserve != null && buyNow != null && buyNow < reserve)
      errors.buyNowPrice = { type: "min", message: tr("studio.validation.buyNowBelowReserve") }
    const width = values.widthCm === "" ? null : Number(values.widthCm)
    const height = values.heightCm === "" ? null : Number(values.heightCm)
    const depth = values.depthCm === "" ? null : Number(values.depthCm)
    if ((width == null) !== (height == null)) {
      const field = width == null ? "widthCm" : "heightCm"
      errors[field] = { type: "required", message: tr("studio.validation.sizeBoth") }
    }
    for (const [field, n, max] of [["widthCm", width, 1000], ["heightCm", height, 1000], ["depthCm", depth, 200]] as const)
      if (n != null && !(n > 0 && n <= max))
        errors[field] = { type: "range", message: tr("studio.validation.sizeRange", { max }) }
    if (values.description.length > 2000)
      errors.description = {
        type: "maxLength",
        message: tr("studio.validation.descriptionLong"),
      }
    const file = values.image?.[0]
    if (requireImage && !file)
      errors.image = { type: "required", message: tr("studio.validation.imageRequired") }
    else if (file) {
      // validateArtworkImage returns an error message, or undefined when valid.
      const imageError = validateArtworkImage(file)
      if (imageError) errors.image = { type: "validate", message: imageError }
    }
    return Object.keys(errors).length
      ? { values: {}, errors }
      : { values, errors: {} }
  }
