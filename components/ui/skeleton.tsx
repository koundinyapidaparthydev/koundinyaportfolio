import { cn } from "@/lib/utils";

/**
 * Skeleton — shadcn/ui-compatible animated placeholder.
 * Used by loading.tsx route segments to show content shapes while data loads.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
