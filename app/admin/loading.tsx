/**
 * app/admin/loading.tsx
 *
 * Shown while the admin dashboard route segment is loading.
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#080808] px-4 py-8 sm:px-6 lg:px-8 dark:bg-[#080808]">
      <div className="mx-auto max-w-7xl">
        {/* Page header */}
        <div className="mb-8">
          <Skeleton className="mb-2 h-8 w-52 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded" />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* Sidebar skeleton */}
          <div className="flex w-full flex-col gap-2 lg:w-56 lg:shrink-0">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>

          {/* Content skeleton */}
          <div className="min-w-0 flex-1 space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
            {/* Content block */}
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
