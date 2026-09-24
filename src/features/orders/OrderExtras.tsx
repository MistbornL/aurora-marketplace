import { useCallback, useEffect, useState, type ReactNode } from "react"
import { AlertTriangle, Landmark, MapPin, Store, Truck } from "lucide-react"
import { Button, Card, Input, Textarea } from "../../components/ui"
import { useI18n, type MessageKey } from "../../lib/i18n"
import { errorMessage, notify } from "../../lib/notify"
import { useAuth } from "../auth/auth-context"
import { getDeliveryDefaults } from "../profile/api"
import {
  getPayoutAccount,
  getShipping,
  listReports,
  reportProblem,
  saveShipping,
  type Order,
  type OrderReport,
  type ReportReason,
  type Shipping,
} from "./api"

const EDITABLE = ["awaiting_payment", "payment_submitted", "paid"]

/** Loads the order's delivery details (buyer always; seller once paid). */
export function useShipping(orderId: string) {
  const [shipping, setShipping] = useState<Shipping | null | undefined>()
  const reload = useCallback(async () => {
    setShipping(await getShipping(orderId).catch(() => null))
  }, [orderId])
  useEffect(() => {
    void reload()
  }, [reload])
  return { shipping, reload }
}

// ── Delivery ────────────────────────────────────────────────────────────────
export function DeliveryCard({
  order,
  perspective,
  shipping,
  onSaved,
}: {
  order: Order
  perspective: "buyer" | "seller" | "admin"
  shipping: Shipping | null | undefined
  onSaved: () => Promise<void>
}) {
  const { t } = useI18n()
  const { user } = useAuth()
  const canEdit = perspective === "buyer" && EDITABLE.includes(order.status)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Shipping>({
    method: "courier",
    recipient: "",
    phone: "",
    city: "",
    address: "",
    notes: "",
  })
  const [saving, setSaving] = useState(false)

  // Start the form from the saved details, or from the profile the first time.
  useEffect(() => {
    if (shipping) return setDraft(shipping)
    if (!user || perspective !== "buyer") return
    void getDeliveryDefaults(user.id).then((defaults) => {
      if (!defaults) return
      setDraft((current) => ({
        ...current,
        recipient: current.recipient || `${defaults.first_name ?? ""} ${defaults.last_name ?? ""}`.trim(),
        phone: current.phone || defaults.phone || "",
        city: current.city || defaults.ship_city || "",
        address: current.address || defaults.ship_address || "",
      }))
    })
  }, [shipping, user, perspective])

  if (shipping === undefined) return null
  if (perspective !== "buyer" && !shipping) return null

  const showForm = canEdit && (!shipping || editing)
  const set = <K extends keyof Shipping>(key: K, value: Shipping[K]) => setDraft({ ...draft, [key]: value })

  async function save() {
    setSaving(true)
    try {
      await saveShipping(order.id, draft)
      notify(t("pilot.delivery.saved"), t("pilot.delivery.savedText"))
      setEditing(false)
      await onSaved()
    } catch (error) {
      notify(t("pilot.delivery.saveFailed"), errorMessage(error), "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border border-border bg-surface p-5 ring-0 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-text">
          <MapPin className="size-4 text-amber" /> {t("pilot.delivery.title")}
        </h2>
        {canEdit && shipping && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-amber hover:text-amber/80">
            {t("common.edit")}
          </button>
        )}
      </div>

      {showForm ? (
        <div className="space-y-3">
          {!shipping && <p className="text-sm text-text-secondary">{t("pilot.delivery.intro")}</p>}
          <div role="radiogroup" aria-label={t("pilot.delivery.method")} className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "courier", icon: <Truck />, label: "pilot.delivery.courier" },
                { value: "pickup", icon: <Store />, label: "pilot.delivery.pickup" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={draft.method === option.value}
                onClick={() => set("method", option.value)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm [&_svg]:size-4 ${
                  draft.method === option.value
                    ? "border-amber bg-amber/[.07] text-text"
                    : "border-white/10 text-text-secondary hover:border-white/25"
                }`}
              >
                {option.icon} {t(option.label)}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={draft.recipient}
              onChange={(e) => set("recipient", e.target.value)}
              placeholder={t("pilot.delivery.recipient")}
              aria-label={t("pilot.delivery.recipient")}
              className="h-10"
            />
            <Input
              value={draft.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder={t("pilot.delivery.phone")}
              aria-label={t("pilot.delivery.phone")}
              type="tel"
              className="h-10"
            />
            {draft.method === "courier" && (
              <>
                <Input
                  value={draft.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder={t("pilot.delivery.city")}
                  aria-label={t("pilot.delivery.city")}
                  className="h-10"
                />
                <Input
                  value={draft.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder={t("pilot.delivery.address")}
                  aria-label={t("pilot.delivery.address")}
                  className="h-10"
                />
              </>
            )}
          </div>
          <Textarea
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder={
              draft.method === "pickup" ? t("pilot.delivery.pickupNotes") : t("pilot.delivery.notes")
            }
            aria-label={t("pilot.delivery.notesLabel")}
            maxLength={300}
            className="min-h-16"
          />
          <div className="flex gap-2">
            <Button onClick={() => void save()} disabled={saving} className="h-10 font-semibold">
              {saving ? t("common.saving") : t("pilot.delivery.save")}
            </Button>
            {shipping && (
              <Button variant="ghost" className="h-10" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
            )}
          </div>
        </div>
      ) : shipping ? (
        <dl className="grid gap-1.5 text-sm">
          <Row label={t("pilot.delivery.method")}>
            {shipping.method === "pickup" ? t("pilot.delivery.pickup") : t("pilot.delivery.courier")}
          </Row>
          {shipping.recipient && <Row label={t("pilot.delivery.recipient")}>{shipping.recipient}</Row>}
          {shipping.phone && <Row label={t("pilot.delivery.phone")}>{shipping.phone}</Row>}
          {shipping.method === "courier" && (
            <Row label={t("pilot.delivery.address")}>
              {shipping.city}, {shipping.address}
            </Row>
          )}
          {shipping.notes && <Row label={t("pilot.delivery.notesLabel")}>{shipping.notes}</Row>}
        </dl>
      ) : null}
    </Card>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right text-text">{children}</dd>
    </div>
  )
}

// ── Problem reports ─────────────────────────────────────────────────────────
const REASONS: Array<{ value: ReportReason; label: MessageKey }> = [
  { value: "not_received", label: "pilot.report.reason.not_received" },
  { value: "not_as_described", label: "pilot.report.reason.not_as_described" },
  { value: "damaged", label: "pilot.report.reason.damaged" },
  { value: "payment", label: "pilot.report.reason.payment" },
  { value: "other", label: "pilot.report.reason.other" },
]

export const reasonLabel = (reason: ReportReason): MessageKey =>
  REASONS.find((item) => item.value === reason)?.label ?? "pilot.report.reason.other"

export function ReportProblem({ order }: { order: Order }) {
  const { t, formatDate } = useI18n()
  const { user } = useAuth()
  const [reports, setReports] = useState<OrderReport[]>([])
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>("not_received")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setReports(await listReports(order.id).catch(() => []))
  }, [order.id])
  useEffect(() => {
    void load()
  }, [load])

  if (["expired", "cancelled"].includes(order.status)) return null
  const mine = reports.filter((report) => report.reporterId === user?.id)
  const hasOpen = mine.some((report) => report.status === "open")

  async function send() {
    setSending(true)
    try {
      await reportProblem(order.id, reason, message)
      notify(t("pilot.report.sent"), t("pilot.report.sentText"))
      setOpen(false)
      setMessage("")
      await load()
    } catch (error) {
      notify(t("pilot.report.failed"), errorMessage(error), "error")
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="border border-border bg-surface p-5 ring-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-text">
          <AlertTriangle className="size-4 text-amber" /> {t("pilot.report.title")}
        </p>
        {!open && !hasOpen && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {t("pilot.report.open")}
          </Button>
        )}
      </div>
      {!open && !mine.length && <p className="mt-1 text-xs text-text-muted">{t("pilot.report.hint")}</p>}

      {mine.map((report) => (
        <div key={report.id} className="mt-3 rounded-xl bg-white/[.03] p-3 text-sm">
          <p className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-text">{t(reasonLabel(report.reason))}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                report.status === "open" ? "bg-amber/15 text-amber" : "bg-emerald-500/15 text-emerald-300"
              }`}
            >
              {report.status === "open" ? t("pilot.report.statusOpen") : t("pilot.report.statusResolved")}
            </span>
          </p>
          {report.message && <p className="mt-1 text-text-secondary">{report.message}</p>}
          {report.adminNote && (
            <p className="mt-2 text-xs text-emerald-200/90">
              {t("pilot.report.answer")} {report.adminNote}
            </p>
          )}
          <p className="mt-1 text-[11px] text-text-muted">{formatDate(report.createdAt, { dateStyle: "medium" })}</p>
        </div>
      ))}

      {open && (
        <div className="mt-3 space-y-3">
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value as ReportReason)}
            aria-label={t("pilot.report.reasonLabel")}
            className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-text"
          >
            {REASONS.map((item) => (
              <option key={item.value} value={item.value} className="bg-surface">
                {t(item.label)}
              </option>
            ))}
          </select>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("pilot.report.placeholder")}
            aria-label={t("pilot.report.messageLabel")}
            maxLength={2000}
            className="min-h-24"
          />
          <p className="text-[11px] text-text-muted">{t("pilot.report.paused")}</p>
          <div className="flex gap-2">
            <Button onClick={() => void send()} disabled={sending || message.trim().length < 5} className="h-10">
              {sending ? t("pilot.report.sending") : t("pilot.report.send")}
            </Button>
            <Button variant="ghost" className="h-10" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Admin: where to send the artist's money ─────────────────────────────────
export function PayoutAccount({ order }: { order: Order }) {
  const { t } = useI18n()
  const [account, setAccount] = useState<{ holder: string; iban: string; bank: string } | null | undefined>()
  useEffect(() => {
    void getPayoutAccount(order.id).then(setAccount, () => setAccount(null))
  }, [order.id])
  if (account === undefined) return null
  const missing = !account?.iban
  return (
    <div className={`mt-3 rounded-xl p-3 text-sm ${missing ? "bg-red-500/10 text-red-200" : "bg-white/[.03]"}`}>
      <p className="flex items-center gap-2 font-medium">
        <Landmark className="size-4" /> {t("pilot.payout.adminTitle")}
      </p>
      {missing ? (
        <p className="mt-1 text-xs">{t("pilot.payout.adminMissing")}</p>
      ) : (
        <p className="mt-1 font-mono text-xs text-text-secondary">
          {account!.holder} · {account!.bank} · {account!.iban}
        </p>
      )}
    </div>
  )
}
