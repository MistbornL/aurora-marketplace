import { useEffect, useState } from "react"
import { Landmark } from "lucide-react"
import { Button, Card, Input } from "../../components/ui"
import { useI18n } from "../../lib/i18n"
import { errorMessage, notify } from "../../lib/notify"
import { getPayoutDetails, savePayoutDetails, type PayoutDetails } from "../profile/api"

/** Where AURORA sends the artist's money. Private: only admins see it at payout. */
export function PayoutCard({ userId }: { userId: string }) {
  const { t } = useI18n()
  const [details, setDetails] = useState<PayoutDetails | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getPayoutDetails(userId).then((value) => {
      setDetails(value)
      setEditing(!value.iban)
    })
  }, [userId])

  if (!details) return null
  const set = (key: keyof PayoutDetails, value: string) => setDetails({ ...details, [key]: value })
  const ibanValid = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(details.iban.replace(/\s+/g, "").toUpperCase())

  async function save() {
    if (!details) return
    setSaving(true)
    try {
      await savePayoutDetails(userId, details)
      notify(t("pilot.payout.saved"), t("pilot.payout.savedText"))
      setEditing(false)
    } catch (error) {
      notify(t("pilot.payout.saveFailed"), errorMessage(error), "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      className={`mb-6 border p-5 ring-0 ${
        details.iban ? "border-border bg-surface" : "border-amber/40 bg-amber/[.06]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display font-semibold text-text">
            <Landmark className="size-4 text-amber" /> {t("pilot.payout.title")}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {details.iban ? t("pilot.payout.private") : t("pilot.payout.missing")}
          </p>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t("common.edit")}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Input
            value={details.holder}
            onChange={(e) => set("holder", e.target.value)}
            placeholder={t("pilot.payout.holder")}
            aria-label={t("pilot.payout.holder")}
            className="h-10"
          />
          <Input
            value={details.bank}
            onChange={(e) => set("bank", e.target.value)}
            placeholder={t("pilot.payout.bank")}
            aria-label={t("pilot.payout.bank")}
            className="h-10"
          />
          <Input
            value={details.iban}
            onChange={(e) => set("iban", e.target.value)}
            placeholder="GE00TB0000000000000000"
            aria-label="IBAN"
            className="h-10 font-mono"
          />
          <div className="flex items-center gap-2 sm:col-span-3">
            <Button
              onClick={() => void save()}
              disabled={saving || !details.holder.trim() || !ibanValid}
              className="h-10 font-semibold"
            >
              {saving ? t("common.saving") : t("common.save")}
            </Button>
            {details.iban && !ibanValid && (
              <span className="text-xs text-red-400">{t("pilot.payout.invalidIban")}</span>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 font-mono text-sm text-text-secondary">
          {details.holder} · {details.bank || "—"} · {details.iban}
        </p>
      )}
    </Card>
  )
}
