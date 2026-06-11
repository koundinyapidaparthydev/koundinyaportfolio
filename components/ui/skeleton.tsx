import { cn } from "@/lib/utils";

/**
 * Skeleton — shadcn/ui-compatible animated placeholder.
 * Used by loading.tsx route segments to show content shapes while data loads.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-[var(--glass-bg-subtle)] ring-1 ring-[var(--glass-border)]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
