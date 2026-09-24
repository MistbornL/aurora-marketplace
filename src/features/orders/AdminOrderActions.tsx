import { useState } from "react"
import { Button, Input } from "../../components/ui"
import { errorMessage, notify } from "../../lib/notify"
import { useI18n } from "../../lib/i18n"
import { cancelOrder, confirmPayment, markPayoutSent, money, type Order } from "./api"

/** Admin-only buttons for one order. Each RPC re-checks the admin role. */
export function AdminOrderActions({ order, onDone }: { order: Order; onDone: () => void }) {
  const { t } = useI18n()
  const [reference, setReference] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  async function act(label: string, action: () => Promise<unknown>, success: string) {
    setBusy(label)
    try {
      await action()
      notify(success, t("orders.orderNumber", { reference: order.reference }))
      setReference("")
      onDone()
    } catch (error) {
      notify(t("orders.updateFailed"), errorMessage(error), "error")
    } finally {
      setBusy(null)
    }
  }

  const canConfirm = order.status === "awaiting_payment" || order.status === "payment_submitted"
  const canPayout = order.status === "delivered"
  const canCancel = !["completed", "expired", "cancelled"].includes(order.status)
  if (!canConfirm && !canPayout && !canCancel) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(canConfirm || canPayout) && (
        <Input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder={canConfirm ? t("orders.admin.bankRefPlaceholder") : t("orders.admin.payoutRefPlaceholder")}
          aria-label={t("orders.admin.reference")}
          className="h-9 w-48"
        />
      )}
      {canConfirm && (
        <Button
          size="sm"
          disabled={Boolean(busy)}
          onClick={() =>
            void act(
              "confirm",
              () => confirmPayment(order.id, reference.trim(), order.totalDue),
              t("orders.admin.markedPaid", { amount: money(order.totalDue) }),
            )
          }
        >
          {busy === "confirm" ? t("common.saving") : t("orders.admin.confirmReceived", { amount: money(order.totalDue) })}
        </Button>
      )}
      {canPayout && (
        <Button
          size="sm"
          disabled={Boolean(busy)}
          onClick={() =>
            void act(
              "payout",
              () => markPayoutSent(order.id, reference.trim()),
              t("orders.admin.payoutRecorded", { amount: money(order.sellerPayout) }),
            )
          }
        >
          {busy === "payout" ? t("common.saving") : t("orders.admin.payoutSent", { amount: money(order.sellerPayout) })}
        </Button>
      )}
      {canCancel && (
        <Button
          size="sm"
          variant="outline"
          disabled={Boolean(busy)}
          className="text-red-300 hover:text-red-200"
          title={t("orders.admin.cancelHint")}
          onClick={() => {
            if (!confirmCancel) return setConfirmCancel(true)
            setConfirmCancel(false)
            void act("cancel", () => cancelOrder(order.id), t("orders.cancelled.title"))
          }}
          onBlur={() => setConfirmCancel(false)}
        >
          {confirmCancel ? t("orders.admin.clickAgain") : t("orders.admin.cancelOrder")}
        </Button>
      )}
    </div>
  )
}
