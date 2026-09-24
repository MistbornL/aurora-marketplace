import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button, Input } from "../../components/ui"
import { RowsSkeleton } from "../../components/layout/PageSkeletons"
import { useI18n } from "../../lib/i18n"
import { errorMessage, notify } from "../../lib/notify"
import { listReports, resolveReport, type OrderReport } from "../orders/api"
import { reasonLabel } from "../orders/OrderExtras"

/** Problem reports from buyers and artists. Open reports pause auto-release and payouts. */
export function ReportsTab({ onCount }: { onCount?: (open: number) => void }) {
  const { t, formatDate } = useI18n()
  const navigate = useNavigate()
  const [reports, setReports] = useState<OrderReport[] | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const rows = await listReports().catch(() => [])
    setReports(rows)
    onCount?.(rows.filter((row) => row.status === "open").length)
  }, [onCount])
  useEffect(() => {
    void load()
  }, [load])

  if (!reports) return <RowsSkeleton />
  if (!reports.length)
    return (
      <p className="rounded-2xl border border-dashed border-border px-6 py-14 text-center text-sm text-text-muted">
        {t("pilot.admin.reportsEmpty")}
      </p>
    )

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      {reports.map((report) => (
        <div key={report.id} className="border-b border-border p-4 last:border-b-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => navigate(`/orders/${report.orderId}`)} className="text-left">
              <p className="font-display font-semibold text-text">
                {report.orderTitle} <span className="text-text-muted">#{report.orderReference}</span>
              </p>
              <p className="text-xs text-text-muted">
                {t(reasonLabel(report.reason))} · {formatDate(report.createdAt, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </button>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                report.status === "open" ? "bg-amber/15 text-amber" : "bg-emerald-500/15 text-emerald-300"
              }`}
            >
              {report.status === "open" ? t("pilot.report.statusOpen") : t("pilot.report.statusResolved")}
            </span>
          </div>
          {report.message && <p className="mt-2 text-sm text-text-secondary">{report.message}</p>}
          {report.status === "resolved" ? (
            report.adminNote && <p className="mt-2 text-xs text-emerald-200/90">{report.adminNote}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                value={notes[report.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [report.id]: e.target.value })}
                placeholder={t("pilot.admin.resolveNote")}
                aria-label={t("pilot.admin.resolveNote")}
                className="h-9 min-w-60 flex-1"
              />
              <Button
                size="sm"
                disabled={busy === report.id || !(notes[report.id] ?? "").trim()}
                onClick={async () => {
                  setBusy(report.id)
                  try {
                    await resolveReport(report.id, notes[report.id] ?? "")
                    notify(t("pilot.admin.resolved"), `#${report.orderReference}`)
                    await load()
                  } catch (error) {
                    notify(t("common.somethingWrong"), errorMessage(error), "error")
                  } finally {
                    setBusy(null)
                  }
                }}
              >
                {t("pilot.admin.resolve")}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
