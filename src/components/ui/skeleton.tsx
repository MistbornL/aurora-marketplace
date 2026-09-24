import { cn } from "cn"

/** Shimmering placeholder block used while content loads. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-xl bg-white/[.06]", className)}
      {...props}
    />
  )
}

export { Skeleton }
