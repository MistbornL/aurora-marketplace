import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { Button, Card, Input, Label, Tabs, TabsList, TabsTrigger } from "../../components/ui"
import { RowsSkeleton } from "../../components/layout/PageSkeletons"
import { errorMessage, notify } from "../../lib/notify"
import { useI18n, type MessageKey } from "../../lib/i18n"
import { useAuth } from "../auth/auth-context"
import { AdminOrderActions } from "../orders/AdminOrderActions"
import {
  getSettings,
  money,
  saveSettings,
  useOrders,
  type Order,
  type PlatformSettings,
} from "../orders/api"
import { OrderRow } from "../orders/components"
import { EventsTab } from "./EventsTab"
import { ReportsTab } from "./ReportsTab"

type Tab = "payments" | "payouts" | "reports" | "events" | "all" | "settings"

/** Back office: confirm bank transfers, release payouts, tune fees. */
export default function AdminPage() {
  const { user, role, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()
  const isAdmin = role === "admin"
  const { orders, loading, error, reload } = useOrders({ all: isAdmin })
  const [tab, setTab] = useState<Tab>("payments")
  const [openReports, setOpenReports] = useState(0)

  const groups = useMemo(() => {
    const toConfirm = orders.filter((o) => o.status === "payment_submitted" || o.status === "awaiting_payment")
    // Submitted transfers first — those need a bank check now.
    toConfirm.sort((a, b) => Number(b.status === "payment_submitted") - Number(a.status === "payment_submitted"))
    const payouts = orders.filter((o) => o.status === "delivered")
    const earned = orders.filter((o) => ["paid", "shipped", "delivered", "completed"].includes(o.status))
    return {
      toConfirm,
      payouts,
      revenue: earned.reduce((sum, o) => sum + o.buyerPremium + o.sellerCommission, 0),
      held: orders
        .filter((o) => ["paid", "shipped", "delivered"].includes(o.status))
        .reduce((sum, o) => sum + o.sellerPayout, 0),
      gmv: earned.reduce((sum, o) => sum + o.hammerPrice, 0),
    }
  }, [orders])

  if (authLoading) return <Shell><RowsSkeleton /></Shell>
  if (!user || !isAdmin)
    return (
      <Shell>
        <p className="py-20 text-center text-sm text-text-secondary">{t("admin.staffOnly")}</p>
      </Shell>
    )

  const submitted = groups.toConfirm.filter((o) => o.status === "payment_submitted").length
  const tabs: Array<{ key: Tab; label: MessageKey; count?: number }> = [
    { key: "payments", label: "admin.tab.payments", count: submitted },
    { key: "payouts", label: "admin.tab.payouts", count: groups.payouts.length },
    { key: "reports", label: "pilot.admin.tabReports", count: openReports },
    { key: "events", label: "pilot.admin.tabEvents" },
    { key: "all", label: "admin.tab.all" },
    { key: "settings", label: "admin.tab.settings" },
  ]

  const list = (items: Order[], empty: string) =>
    items.length ? (
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {items.map((order) => (
          <div key={order.id} className="border-b border-border last:border-b-0">
            <OrderRow bare order={order} perspective="admin" onOpen={() => navigate(`/orders/${order.id}`)} />
            {order.status === "payment_submitted" && order.paymentReference && (
              <p className="-mt-2 px-4 pb-2 text-xs text-text-muted">
                {t("admin.buyersNote")} <span className="text-text-secondary">{order.paymentReference}</span> ·{" "}
                {t("admin.lookFor", { description: `TSISKARI ${order.reference}` })}
              </p>
            )}
            <div className="px-4 pb-4">
              <AdminOrderActions order={order} onDone={() => void reload()} />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="rounded-2xl border border-dashed border-border px-6 py-14 text-center text-sm text-text-muted">
        {empty}
      </p>
    )

  return (
    <Shell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-amber">{t("admin.eyebrow")}</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-text">{t("admin.title")}</h1>
        </div>
        <Button variant="outline" onClick={() => void reload()}>
          {t("common.refresh")}
        </Button>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("admin.stat.transfersToCheck")} value={String(submitted)} accent={submitted > 0} />
        <Stat label={t("admin.stat.revenue")} value={money(groups.revenue)} accent />
        <Stat label={t("admin.stat.held")} value={money(groups.held)} />
        <Stat label={t("admin.stat.volume")} value={money(groups.gmv)} />
      </div>

      <Tabs className="border-b border-border">
        <TabsList className="h-auto gap-6 rounded-none bg-transparent p-0">
          {tabs.map((item) => (
            <TabsTrigger
              key={item.key}
              active={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`rounded-none border-b-2 px-0 pb-3 text-[13px] ${
                tab === item.key ? "border-amber" : "border-transparent"
              }`}
            >
              {t(item.label)}
              {item.count ? (
                <span className="ml-1.5 rounded-full bg-amber px-1.5 text-[10px] font-bold text-bg">{item.count}</span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="py-6">
        {error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : tab === "reports" ? (
          <ReportsTab onCount={setOpenReports} />
        ) : tab === "events" ? (
          <EventsTab />
        ) : loading && tab !== "settings" ? (
          <RowsSkeleton />
        ) : tab === "payments" ? (
          list(groups.toConfirm, t("admin.empty.payments", { button: t("orders.pay.iSent") }))
        ) : tab === "payouts" ? (
          list(groups.payouts, t("admin.empty.payouts"))
        ) : tab === "all" ? (
          list(orders, t("admin.empty.all"))
        ) : (
          <SettingsForm />
        )}
      </div>
    </Shell>
  )
}

function SettingsForm() {
  const { t } = useI18n()
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSettings().then(setSettings, (error) => notify(t("admin.settings.loadFailed"), errorMessage(error), "error"))
  }, [])

  if (!settings) return <RowsSkeleton rows={2} />
  const set = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) =>
    setSettings({ ...settings, [key]: value })
  const numberField = (key: keyof PlatformSettings, label: string, hint: string, min: number, max: number) => (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        min={min}
        max={max}
        step={key.endsWith("Pct") ? 0.5 : 1}
        value={String(settings[key])}
        onChange={(event) => set(key, Number(event.target.value) as never)}
      />
    </Field>
  )

  return (
    <form
      className="grid max-w-3xl gap-8"
      onSubmit={async (event) => {
        event.preventDefault()
        setSaving(true)
        try {
          await saveSettings(settings)
          notify(t("admin.settings.saved"), t("admin.settings.savedDetail"))
        } catch (error) {
          notify(t("admin.settings.saveFailed"), errorMessage(error), "error")
        } finally {
          setSaving(false)
        }
      }}
    >
      <Card className="grid gap-5 border border-border bg-surface p-6 ring-0 sm:grid-cols-2">
        <h2 className="font-display font-semibold text-text sm:col-span-2">{t("admin.settings.feesTitle")}</h2>
        {numberField("sellerCommissionPct", t("admin.settings.sellerCommission"), t("admin.settings.sellerCommissionHint"), 0, 50)}
        {numberField("buyerPremiumPct", t("admin.settings.buyerPremium"), t("admin.settings.buyerPremiumHint"), 0, 50)}
        {numberField("paymentWindowHours", t("admin.settings.paymentWindow"), t("admin.settings.paymentWindowHint"), 1, 168)}
        {numberField("autoReleaseDays", t("admin.settings.autoRelease"), t("admin.settings.autoReleaseHint"), 1, 60)}
        {numberField("maxPaymentStrikes", t("admin.settings.strikes"), t("admin.settings.strikesHint"), 1, 10)}
        {numberField("liveBidSeconds", t("admin.settings.liveBid"), t("admin.settings.liveBidHint"), 10, 300)}
        {numberField("liveOpeningSeconds", t("admin.settings.liveOpening"), t("admin.settings.liveOpeningHint"), 10, 900)}
        {numberField("sellerDecisionHours", t("admin.settings.sellerDecision"), t("admin.settings.sellerDecisionHint"), 1, 72)}
      </Card>
      <Card className="grid gap-5 border border-border bg-surface p-6 ring-0 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="font-display font-semibold text-text">{t("admin.settings.bankTitle")}</h2>
          <p className="mt-1 text-xs text-text-muted">{t("admin.settings.bankHint")}</p>
        </div>
        <Field label={t("admin.settings.bankName")}>
          <Input value={settings.bankName} onChange={(event) => set("bankName", event.target.value)} />
        </Field>
        <Field label={t("admin.settings.accountHolder")}>
          <Input
            value={settings.bankAccountHolder}
            onChange={(event) => set("bankAccountHolder", event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("admin.settings.iban")}>
            <Input
              value={settings.bankIban}
              onChange={(event) => set("bankIban", event.target.value)}
              placeholder="GE00TB0000000000000000"
              className="font-mono"
            />
          </Field>
        </div>
      </Card>
      <div>
        <Button type="submit" disabled={saving} className="h-11 px-6 font-semibold">
          {saving ? t("common.saving") : t("admin.settings.save")}
        </Button>
      </div>
    </form>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-text-secondary">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-text-muted">{hint}</p>}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="border border-border bg-surface p-4 ring-0">
      <p className="text-[11px] uppercase tracking-[.08em] text-text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accent ? "text-amber" : "text-text"}`}>{value}</p>
    </Card>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-bg pb-20">
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-10">{children}</div>
    </main>
  )
}
