/**
 * app/admin/loading.tsx
 *
 * Shown while the admin dashboard route segment is loading.
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#080808] px-3 py-8 sm:px-4 lg:px-6 dark:bg-[#080808]">
      <div className="mb-8">
        <Skeleton className="mb-2 h-8 w-52 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>

      <div className="mb-6 flex gap-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-lg" />
        ))}
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
