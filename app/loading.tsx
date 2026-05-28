/**
 * app/loading.tsx
 *
 * Root-level loading UI shown by Next.js while the home-page
 * data is being fetched / the route segment is suspended.
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-background px-6 py-12">
      {/* Hero skeleton */}
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 py-24 text-center">
        {/* "Open to work" badge */}
        <Skeleton className="h-9 w-36 rounded-full" />
        {/* Heading */}
        <Skeleton className="h-16 w-3/4 rounded-xl" />
        <Skeleton className="h-8 w-1/2 rounded-lg" />
        {/* Bio */}
        <Skeleton className="h-5 w-full max-w-2xl rounded" />
        <Skeleton className="h-5 w-4/5 max-w-xl rounded" />
        {/* CTA buttons */}
        <div className="mt-4 flex gap-4">
          <Skeleton className="h-11 w-40 rounded-lg" />
          <Skeleton className="h-11 w-40 rounded-lg" />
        </div>
      </div>

      {/* Section skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="mx-auto mb-24 max-w-6xl">
          {/* Section heading */}
          <Skeleton className="mx-auto mb-12 h-10 w-48 rounded-lg" />
          {/* Cards row */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-52 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
