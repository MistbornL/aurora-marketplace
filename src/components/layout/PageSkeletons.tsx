import { useI18n } from "../../lib/i18n"
import { Skeleton } from "../ui"

/** Grid of artwork-card placeholders. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-white/[.06] bg-surface">
          <Skeleton className="h-[230px] rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <div className="flex items-end justify-between pt-3">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-9 w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Whole-page placeholder (first load, lazy routes). */
export function PageSkeleton() {
  const { t } = useI18n()
  return (
    <div className="min-h-screen bg-bg" aria-busy="true" aria-label={t("common.loading")}>
      <div className="flex h-16 items-center justify-between border-b border-white/[.06] px-4 sm:px-6 lg:px-10">
        <Skeleton className="h-6 w-28" />
        <div className="flex gap-2">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-10">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-3 h-4 w-40" />
        <div className="mt-10">
          <CardGridSkeleton />
        </div>
      </div>
    </div>
  )
}

/** Rows placeholder for lists (bids, studio auctions). */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[.06] bg-surface">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-white/[.05] p-4 last:border-b-0">
          <Skeleton className="size-14 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}
