/**
 * useResume — React Query hooks for the /api/resume endpoint.
 *
 * useResume()       – fetches the full resume (read-only consumers)
 * useUpdateResume() – admin mutation with optimistic UI + cache invalidation
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { Resume } from "@/types/resume";

// Stable query key — used by both the query and mutation to share cache
export const RESUME_QUERY_KEY = ["resume"] as const;

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchResume(): Promise<Resume> {
  const res = await fetch("/api/resume", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch resume (${res.status})`);
  }
  return res.json() as Promise<Resume>;
}

async function putResume(data: Resume): Promise<Resume> {
  const res = await fetch("/api/resume", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let message = `Save failed (${res.status})`;
    try {
      const payload = await res.json();
      if (typeof payload?.error === "string") message = payload.error;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(message);
  }
  return res.json() as Promise<Resume>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Read-only hook — returns the full resume from the cache or network.
 * Data is considered fresh for 60 s (configurable via QueryClient defaults).
 */
export function useResume(): UseQueryResult<Resume, Error> {
  return useQuery<Resume, Error>({
    queryKey: RESUME_QUERY_KEY,
    queryFn: fetchResume,
    staleTime: 60_000,
  });
}

// Context type stored during optimistic update
interface OptimisticContext {
  previous: Resume | undefined;
}

/**
 * Admin mutation hook — PUT /api/resume with optimistic UI.
 *
 * Behaviour:
 * 1. Cancel any in-flight resume queries to prevent race conditions.
 * 2. Snapshot the current cache value so we can roll back on error.
 * 3. Immediately write the new value into the cache (optimistic update).
 * 4. On error → restore the snapshot.
 * 5. On settle (success or error) → invalidate so the cache refreshes
 *    from the server to confirm the persisted state.
 */
export function useUpdateResume(): UseMutationResult<
  Resume,
  Error,
  Resume,
  OptimisticContext
> {
  const queryClient = useQueryClient();

  return useMutation<Resume, Error, Resume, OptimisticContext>({
    mutationFn: putResume,

    onMutate: async (newResume: Resume): Promise<OptimisticContext> => {
      // Stop any outgoing refetches so they don't overwrite our optimistic value
      await queryClient.cancelQueries({ queryKey: RESUME_QUERY_KEY });

      // Snapshot the previous value
      const previous = queryClient.getQueryData<Resume>(RESUME_QUERY_KEY);

      // Optimistically update the UI immediately
      queryClient.setQueryData<Resume>(RESUME_QUERY_KEY, newResume);

      return { previous };
    },

    onError: (_err, _newResume, context) => {
      // Roll back to the last known-good value
      if (context?.previous !== undefined) {
        queryClient.setQueryData<Resume>(RESUME_QUERY_KEY, context.previous);
      }
    },

    onSettled: () => {
      // Always refetch after mutation to sync server truth into the cache
      void queryClient.invalidateQueries({ queryKey: RESUME_QUERY_KEY });
    },
  });
}
