"use client";

/**
 * app/admin/error.tsx — Admin dashboard error boundary.
 *
 * Catches errors specific to the /admin route segment.
 * Shows an admin-specific error UI with retry and home actions.
 */

import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[Admin Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 bg-[#080808] px-6 text-center">
      {/* Icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>

      <div className="max-w-sm space-y-2">
        <h2 className="text-xl font-bold text-white">Dashboard error</h2>
        <p className="text-sm text-slate-400">
          The admin dashboard encountered an error. Try refreshing or navigate
          back to the dashboard.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-slate-500">
            Ref: {error.digest}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="glass-btn-primary px-5 py-2.5 text-sm font-medium"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="glass-btn px-5 py-2.5 text-sm font-medium text-slate-300"
        >
          Reload dashboard
        </Link>
        <Link
          href="/"
          className="text-sm text-slate-500 transition-colors hover:text-slate-300"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
