import { useEffect, useMemo, useRef, useState } from "react"
import { artworkSizeCm } from "../../lib/artwork-size"
import { useForm, type UseFormRegisterReturn } from "react-hook-form"
import { CalendarDays, Gavel, ImagePlus, Loader2, Lock, Radio, RefreshCw } from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "../../components/ui"
import { Calendar } from "../../components/ui/calendar"
import { dateFromAuctionValue, formatAuctionDateTime, isoToLocalValue } from "./date-utils"
import { validateArtworkImage } from "./media"
import { getReserve } from "./api"
import { categoryLabel, useI18n, type MessageKey } from "../../lib/i18n"
import { ARTWORK_CATEGORIES, createAuctionResolver } from "./schemas"
import type { AuctionData, AuctionFormData, ManagedAuction } from "./types"

type Props = {
  auction: ManagedAuction | null
  onClose: () => void
  onSubmit: (data: AuctionData) => Promise<void>
}

const DURATIONS = [1, 3, 7, 14].map((days) => ({ days }))

/** Next occurrence of a local time (e.g. 20:00), `addDays` days ahead at least. */
function nextAt(hour: number, addDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + addDays)
  date.setHours(hour, 0, 0, 0)
  if (date.getTime() <= Date.now() + 5 * 60_000) date.setDate(date.getDate() + 1)
  return formatAuctionDateTime(date, `${String(hour).padStart(2, "0")}:00`)
}

const START_PRESETS: Array<{ label: MessageKey; value: () => string }> = [
  { label: "studio.dialog.presetTonight", value: () => nextAt(20) },
  { label: "studio.dialog.presetTomorrow", value: () => nextAt(20, 1) },
  { label: "studio.dialog.presetIn3Days", value: () => nextAt(19, 3) },
]

const priceValue = (value: unknown) => (value === "" || value == null ? "" : Number(value))

/** Now + n days, rounded up to the next full hour, as the picker's local value. */
function inDays(days: number) {
  const date = new Date(Date.now() + days * 86_400_000)
  date.setMinutes(0, 0, 0)
  date.setHours(date.getHours() + 1)
  return formatAuctionDateTime(date, `${String(date.getHours()).padStart(2, "0")}:00`)
}

export function AuctionDialog({ auction, onClose, onSubmit }: Props) {
  const { t, formatDate } = useI18n()
  // Older artworks only have a text label ("80 × 60 cm"); prefill the numbers from it.
  const knownSize = auction ? artworkSizeCm(auction) : null
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AuctionFormData>({
    resolver: createAuctionResolver(!auction, Boolean(auction && auction.bidCount > 0)),
    shouldFocusError: true,
    defaultValues: {
      title: auction?.title ?? "",
      category: auction?.category || "Painting",
      medium: auction?.medium ?? "",
      dimensions: auction?.dimensions ?? "",
      widthCm: knownSize?.width ?? "",
      heightCm: knownSize?.height ?? "",
      depthCm: knownSize?.depth ?? "",
      description: auction?.description ?? "",
      openingBid: auction?.openingBid ?? 50,
      bidIncrement: auction?.bidIncrement ?? 10,
      endsAt: auction ? isoToLocalValue(auction.endsAt) : inDays(7),
      format: auction?.format ?? "timed",
      startsAt: auction?.startsAt ? isoToLocalValue(auction.startsAt) : nextAt(20),
      buyNowPrice: auction?.buyNowPrice ?? "",
      reservePrice: "",
      isLive: auction ? auction.status === "live" || auction.status === "scheduled" : false,
    },
  })

  // The reserve is private — load it for the artist when editing.
  useEffect(() => {
    if (!auction?.hasReserve) return
    void getReserve(auction.id).then((value) => value != null && setValue("reservePrice", value))
  }, [auction?.id, auction?.hasReserve, setValue])

  const file = watch("image")?.[0]
  const category = watch("category")
  const description = watch("description") ?? ""
  const endsAt = watch("endsAt")
  const format = watch("format")
  const startsAt = watch("startsAt")
  const [customStart, setCustomStart] = useState(false)
  const opening = Number(watch("openingBid")) || 0
  const step = Number(watch("bidIncrement")) || 0
  const buyNowValue = watch("buyNowPrice")
  // A Buy It Now that's too close to the opening bid cannibalizes bidding —
  // 3x opening is a reasonable "instant sale, but bidding is still worth it" anchor.
  const suggestedBuyNow = opening > 0 ? Math.round((opening * 3) / 10) * 10 : 0
  const selectedDate = dateFromAuctionValue(endsAt)
  const selectedTime = endsAt.split("T")[1]?.slice(0, 5) ?? "12:00"
  const pricesLocked = Boolean(auction && auction.bidCount > 0)
  const startDate = dateFromAuctionValue(startsAt)
  const startLabel = startDate
    ? formatDate(startDate, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : undefined
  const [custom, setCustom] = useState(Boolean(auction))
  const [pending, setPending] = useState<"draft" | "live" | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const preview = useObjectUrl(file) ?? auction?.image ?? null
  const endsLabel = selectedDate
    ? formatDate(selectedDate, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : t("studio.dialog.pickDate")

  const submit = (publish: boolean) =>
    handleSubmit(async ({ image, ...values }) => {
      setPending(publish ? "live" : "draft")
      try {
        await onSubmit({ ...values, isLive: publish, image: image?.[0] })
      } finally {
        setPending(null)
      }
    })

  // Scroll to the first error so it's never hidden below the fold.
  useEffect(() => {
    const first = scrollRef.current?.querySelector("[data-error='true']")
    first?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [errors])

  const imageField = register("image")

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {/* Header */}
        <div className="border-b border-white/[.06] px-6 py-5">
          <DialogTitle className="font-display text-xl font-bold text-text">
            {auction ? t("studio.dialog.editTitle") : t("studio.dialog.newTitle")}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-text-secondary">
            {auction ? t("studio.dialog.editText") : t("studio.dialog.newText")}
          </DialogDescription>
          <p className="mt-2 text-[11px] text-text-muted">
            <span className="text-amber">*</span> {t("studio.dialog.required")}
          </p>
        </div>

        {/* Scrollable body */}
        <form
          ref={scrollRef as React.Ref<HTMLFormElement>}
          onSubmit={(event) => event.preventDefault()}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-6"
        >
          <div className="grid gap-8 md:grid-cols-[300px_minmax(0,1fr)]">
            {/* Image */}
            <div data-error={Boolean(errors.image)}>
              {!auction && (
                <Label className="mb-2 block text-xs font-medium text-text-secondary">
                  {t("studio.dialog.photo")}
                  <span className="ml-0.5 text-amber">*</span>
                </Label>
              )}
              <ImageDrop
                preview={preview}
                fileName={file?.name}
                register={imageField}
                onFiles={(files) => setValue("image", files, { shouldValidate: true })}
              />
              <ErrorText message={errors.image?.message} />
              <ul className="mt-3 space-y-1 text-[11px] leading-5 text-text-muted">
                <li>• {t("studio.dialog.imageFormats")}</li>
                <li>• {t("studio.dialog.imageTip")}</li>
              </ul>
            </div>

            {/* Details */}
            <div className="space-y-5">
              <FieldBlock label={t("studio.dialog.title")} htmlFor="auction-title" error={errors.title?.message} required>
                <Input
                  id="auction-title"
                  autoFocus
                  {...register("title")}
                  placeholder={t("studio.dialog.titlePlaceholder")}
                  className="h-11 text-base"
                />
              </FieldBlock>

              <div>
                <Label className="text-xs font-medium text-text-secondary">{t("studio.dialog.category")}</Label>
                <div role="radiogroup" className="mt-2 flex flex-wrap gap-2">
                  {ARTWORK_CATEGORIES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      role="radio"
                      aria-checked={category === item}
                      onClick={() => setValue("category", item)}
                      className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                        category === item
                          ? "bg-amber font-medium text-bg"
                          : "border border-white/10 text-text-secondary hover:border-white/25 hover:text-text"
                      }`}
                    >
                      {categoryLabel(t, item)}
                    </button>
                  ))}
                </div>
              </div>

              <FieldBlock label={t("studio.dialog.medium")} htmlFor="auction-medium">
                <Input id="auction-medium" {...register("medium")} placeholder={t("studio.dialog.mediumPlaceholder")} className="h-10" />
              </FieldBlock>

              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-text-secondary">{t("studio.dialog.size")}</legend>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    ["widthCm", "auction-width", t("studio.dialog.width"), "60"],
                    ["heightCm", "auction-height", t("studio.dialog.height"), "80"],
                    ["depthCm", "auction-depth", t("studio.dialog.depth"), "3"],
                  ] as const).map(([name, id, label, example]) => (
                    <div key={name} className="space-y-1">
                      <Label htmlFor={id} className="text-[11px] text-text-muted">{label}</Label>
                      <div className="relative">
                        <Input
                          id={id}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={0.1}
                          placeholder={example}
                          {...register(name, { setValueAs: priceValue })}
                          className="h-10 pr-10"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
                          {t("studio.dialog.cm")}
                        </span>
                      </div>
                      <ErrorText message={errors[name]?.message} />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] leading-5 text-text-muted">{t("studio.dialog.sizeHint")}</p>
              </fieldset>

              <FieldBlock
                label={t("studio.dialog.description")}
                htmlFor="auction-description"
                error={errors.description?.message}
                hint={`${description.length}/2000`}
              >
                <Textarea
                  id="auction-description"
                  rows={4}
                  {...register("description")}
                  placeholder={t("studio.dialog.descriptionPlaceholder")}
                />
              </FieldBlock>
            </div>
          </div>

          {/* Format */}
          <Section title={t("studio.dialog.auctionType")} aside={pricesLocked ? <LockedNote /> : null}>
            <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    key: "timed",
                    icon: <Gavel />,
                    title: t("studio.dialog.timed"),
                    text: t("studio.dialog.timedText"),
                  },
                  {
                    key: "live",
                    icon: <Radio />,
                    title: t("studio.dialog.live"),
                    text: t("studio.dialog.liveText"),
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="radio"
                  aria-checked={format === item.key}
                  disabled={pricesLocked}
                  onClick={() => setValue("format", item.key, { shouldValidate: false })}
                  className={`flex gap-3 rounded-2xl border p-4 text-left transition-colors disabled:opacity-60 [&_svg]:size-5 ${
                    format === item.key
                      ? "border-amber bg-amber/[.07]"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <span className={format === item.key ? "text-amber" : "text-text-muted"}>{item.icon}</span>
                  <span>
                    <span className="block text-sm font-semibold text-text">{item.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-text-muted">{item.text}</span>
                  </span>
                </button>
              ))}
            </div>
          </Section>

          {/* Pricing */}
          <Section title={t("studio.dialog.pricing")} aside={pricesLocked ? <LockedNote /> : null}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock label={t("studio.dialog.openingBid")} htmlFor="opening-bid" error={errors.openingBid?.message} required>
                <MoneyInput id="opening-bid" register={register("openingBid")} readOnly={pricesLocked} />
              </FieldBlock>
              <FieldBlock label={t("studio.dialog.bidStep")} htmlFor="bid-increment" error={errors.bidIncrement?.message} required>
                <MoneyInput id="bid-increment" register={register("bidIncrement")} readOnly={pricesLocked} />
              </FieldBlock>
              <FieldBlock
                label={t("studio.dialog.buyNow")}
                htmlFor="buy-now"
                error={errors.buyNowPrice?.message}
                hint={t("studio.dialog.buyNowHint")}
              >
                <MoneyInput
                  id="buy-now"
                  register={register("buyNowPrice", { setValueAs: priceValue })}
                  readOnly={pricesLocked}
                  placeholder="—"
                />
                {!pricesLocked && !buyNowValue && suggestedBuyNow > 0 && (
                  <button
                    type="button"
                    onClick={() => setValue("buyNowPrice", suggestedBuyNow, { shouldValidate: true })}
                    className="text-[11px] text-amber hover:text-amber/80"
                  >
                    {t("studio.dialog.buyNowSuggested", { amount: suggestedBuyNow })}
                  </button>
                )}
              </FieldBlock>
              <FieldBlock
                label={t("studio.dialog.reserve")}
                htmlFor="reserve"
                error={errors.reservePrice?.message}
                hint={t("studio.dialog.reserveHint")}
              >
                <MoneyInput
                  id="reserve"
                  register={register("reservePrice", { setValueAs: priceValue })}
                  readOnly={pricesLocked}
                  placeholder="—"
                />
              </FieldBlock>
            </div>
            <p className="mt-3 text-xs leading-5 text-text-muted">
              {t("studio.dialog.reserveNote")}
            </p>
            {opening > 0 && step > 0 && (
              <p className="mt-3 rounded-xl bg-white/[.03] px-3 py-2 text-xs text-text-muted">
                {t("studio.dialog.firstBid")} <span className="font-mono text-text">{opening}₾</span>,{" "}
                {t("studio.dialog.then")}{" "}
                <span className="font-mono text-text">
                  {opening + step}₾, {opening + step * 2}₾, {opening + step * 3}₾…
                </span>
              </p>
            )}
          </Section>

          {/* Live start */}
          {format === "live" && (
            <Section title={t("studio.dialog.liveStarts")} aside={<span className="text-xs text-amber">{startLabel}</span>}>
              <div data-error={Boolean(errors.startsAt)} className="flex flex-wrap gap-2">
                {START_PRESETS.map((item) => {
                  const value = item.value()
                  const active = !customStart && startsAt === value
                  return (
                    <button
                      key={item.label}
                      type="button"
                      disabled={pricesLocked}
                      onClick={() => {
                        setCustomStart(false)
                        setValue("startsAt", value, { shouldValidate: true })
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
                        active
                          ? "border-amber bg-amber/10 text-amber"
                          : "border-white/10 text-text-secondary hover:border-white/25 hover:text-text"
                      }`}
                    >
                      {t(item.label)}
                    </button>
                  )
                })}
                <button
                  type="button"
                  disabled={pricesLocked}
                  onClick={() => setCustomStart((value) => !value)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors ${
                    customStart
                      ? "border-amber bg-amber/10 text-amber"
                      : "border-white/10 text-text-secondary hover:border-white/25 hover:text-text"
                  }`}
                >
                  <CalendarDays className="size-4" /> {t("studio.dialog.custom")}
                </button>
              </div>
              {customStart && (
                <DateTimePicker
                  value={startsAt}
                  label={t("studio.dialog.startTime")}
                  onChange={(value) => setValue("startsAt", value, { shouldValidate: true })}
                />
              )}
              <p className="mt-3 rounded-xl bg-white/[.03] px-3 py-2 text-xs leading-5 text-text-muted">
                {t("studio.dialog.liveNote")}
              </p>
              <ErrorText message={errors.startsAt?.message} />
            </Section>
          )}

          {/* Duration */}
          {format === "timed" && (
          <Section title={t("studio.dialog.auctionEnds")} aside={<span className="text-xs text-amber">{endsLabel}</span>}>
            <div data-error={Boolean(errors.endsAt)} className="flex flex-wrap gap-2">
              {DURATIONS.map((item) => {
                const value = inDays(item.days)
                const active = !custom && endsAt === value
                return (
                  <button
                    key={item.days}
                    type="button"
                    onClick={() => {
                      setCustom(false)
                      setValue("endsAt", value, { shouldValidate: true })
                    }}
                    className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
                      active
                        ? "border-amber bg-amber/10 text-amber"
                        : "border-white/10 text-text-secondary hover:border-white/25 hover:text-text"
                    }`}
                  >
                    {t("studio.dialog.days", { count: item.days })}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setCustom((value) => !value)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors ${
                  custom
                    ? "border-amber bg-amber/10 text-amber"
                    : "border-white/10 text-text-secondary hover:border-white/25 hover:text-text"
                }`}
              >
                <CalendarDays className="size-4" /> {t("studio.dialog.custom")}
              </button>
            </div>
            {custom && (
              <div className="mt-4 grid gap-4 rounded-2xl border border-white/[.08] bg-black/20 p-4 sm:grid-cols-[auto_1fr] animate-in fade-in-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                  onSelect={(date) =>
                    date &&
                    setValue("endsAt", formatAuctionDateTime(date, selectedTime), { shouldValidate: true })
                  }
                  className="bg-transparent p-0 [--cell-size:--spacing(9)]"
                />
                <div className="space-y-2">
                  <Label htmlFor="auction-end-time" className="text-xs font-medium text-text-secondary">
                    {t("studio.dialog.endTime")}
                  </Label>
                  <Input
                    id="auction-end-time"
                    type="time"
                    value={selectedTime}
                    onChange={(event) =>
                      setValue(
                        "endsAt",
                        formatAuctionDateTime(selectedDate ?? new Date(), event.target.value),
                        { shouldValidate: true },
                      )
                    }
                    className="h-10 w-40"
                  />
                  <p className="text-xs leading-5 text-text-muted">
                    {t("studio.dialog.eveningTip")}
                  </p>
                </div>
              </div>
            )}
            <ErrorText message={errors.endsAt?.message} />
          </Section>
          )}
        </form>

        {/* Sticky actions */}
        <div className="flex flex-col-reverse gap-2 border-t border-white/[.06] bg-surface px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={onClose} className="h-11 text-text-secondary">
            {t("common.cancel")}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {!(auction && auction.bidCount > 0) && (
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={submit(false)}
                className="h-11 rounded-xl px-5"
              >
                {pending === "draft" && <Loader2 className="size-4 animate-spin" />}
                {t("studio.dialog.saveDraft")}
              </Button>
            )}
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={submit(true)}
              className="h-11 rounded-xl px-6 font-semibold"
            >
              {pending === "live" && <Loader2 className="size-4 animate-spin" />}
              {auction?.status === "live" || auction?.status === "scheduled"
                ? t("studio.dialog.saveChanges")
                : format === "live"
                  ? t("studio.dialog.scheduleLive")
                  : t("studio.dialog.publishNow")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DateTimePicker({
  value,
  label,
  onChange,
}: {
  value: string
  label: string
  onChange: (value: string) => void
}) {
  const selected = dateFromAuctionValue(value)
  const time = value.split("T")[1]?.slice(0, 5) ?? "20:00"
  return (
    <div className="mt-4 grid gap-4 rounded-2xl border border-white/[.08] bg-black/20 p-4 sm:grid-cols-[auto_1fr] animate-in fade-in-0">
      <Calendar
        mode="single"
        selected={selected}
        disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
        onSelect={(date) => date && onChange(formatAuctionDateTime(date, time))}
        className="bg-transparent p-0 [--cell-size:--spacing(9)]"
      />
      <div className="space-y-2">
        <Label className="text-xs font-medium text-text-secondary">{label}</Label>
        <Input
          type="time"
          aria-label={label}
          value={time}
          onChange={(event) => onChange(formatAuctionDateTime(selected ?? new Date(), event.target.value))}
          className="h-10 w-40"
        />
      </div>
    </div>
  )
}

function useObjectUrl(file: File | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!file || validateArtworkImage(file)) return setUrl(undefined)
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url
}

function ImageDrop({
  preview,
  fileName,
  register,
  onFiles,
}: {
  preview: string | null
  fileName?: string
  register: UseFormRegisterReturn
  onFiles: (files: FileList) => void
}) {
  const { t } = useI18n()
  const [dragging, setDragging] = useState(false)
  const inputId = useMemo(() => `artwork-image-${Math.random().toString(36).slice(2)}`, [])
  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        if (event.dataTransfer.files.length) onFiles(event.dataTransfer.files)
      }}
      className={`group relative flex aspect-[4/5] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
        dragging
          ? "border-amber bg-amber/10"
          : preview
            ? "border-transparent"
            : "border-white/15 bg-white/[.02] hover:border-amber/60 hover:bg-amber/[.04]"
      }`}
    >
      {preview ? (
        <>
          <img src={preview} alt={t("studio.dialog.imagePreview")} className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-xl bg-black/65 py-2 text-xs font-medium text-text opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
            <RefreshCw className="size-3.5" /> {t("studio.dialog.replaceImage")}
          </span>
          {fileName && (
            <span className="absolute left-3 top-3 max-w-[85%] truncate rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-text-secondary backdrop-blur">
              {fileName}
            </span>
          )}
        </>
      ) : (
        <div className="px-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber/10 text-amber">
            <ImagePlus className="size-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-text">{t("studio.dialog.dropHere")}</p>
          <p className="mt-1 text-xs text-text-muted">{t("studio.dialog.browse")}</p>
        </div>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        {...register}
      />
    </label>
  )
}

function Section({
  title,
  aside,
  children,
}: {
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-8 border-t border-white/[.06] pt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-text">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function FieldBlock({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div data-error={Boolean(error)} className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={htmlFor} className="text-xs font-medium text-text-secondary">
          {label}
          {required && <span className="ml-0.5 text-amber">*</span>}
        </Label>
        {hint && <span className="text-[11px] text-text-muted">{hint}</span>}
      </div>
      {children}
      <ErrorText message={error} />
    </div>
  )
}

function MoneyInput({
  id,
  register,
  readOnly,
  placeholder,
}: {
  id: string
  register: UseFormRegisterReturn
  readOnly?: boolean
  placeholder?: string
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-amber">₾</span>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min="1"
        readOnly={readOnly}
        placeholder={placeholder}
        {...register}
        className={`h-11 pl-8 font-mono text-base ${readOnly ? "opacity-60" : ""}`}
      />
    </div>
  )
}

function LockedNote() {
  const { t } = useI18n()
  return (
    <span className="flex items-center gap-1 text-xs text-text-muted">
      <Lock className="size-3.5" /> {t("studio.dialog.locked")}
    </span>
  )
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-1.5 text-xs text-red-400">
      {message}
    </p>
  )
}
