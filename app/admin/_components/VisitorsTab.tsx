"use client";

/**
 * VisitorsTab — paginated table of all recorded visitor events.
 * Fetches data from GET /api/visitors (admin-only).
 *
 * Features:
 * - Search by IP or page (client-side filter)
 * - Export filtered results as CSV
 * - Extended columns: Browser, OS, Country, Referrer
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { VisitorEntry } from "@/lib/visitorStore";

const PAGE_SIZE = 25;

async function fetchVisitors(): Promise<VisitorEntry[]> {
  const res = await fetch("/api/visitors");
  if (!res.ok) throw new Error("Failed to load visitor data");
  return res.json() as Promise<VisitorEntry[]>;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

const DEVICE_BADGE: Record<string, string> = {
  Desktop: "bg-indigo-500/15 text-indigo-300 border-indigo-500/20",
  Mobile: "bg-violet-500/15 text-violet-300 border-violet-500/20",
  Tablet: "bg-sky-500/15 text-sky-300 border-sky-500/20",
};

function exportCSV(visitors: VisitorEntry[]) {
  const headers = [
    "Timestamp",
    "IP",
    "Device",
    "Browser",
    "OS",
    "Country",
    "City",
    "Page",
    "Referrer",
    "Language",
    "Screen",
    "Timezone",
    "User Agent",
  ];
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = visitors.map((v) =>
    [
      v.timestamp,
      v.ip,
      v.device,
      v.browser ?? "",
      v.os ?? "",
      v.country ?? "",
      v.city ?? "",
      v.page,
      v.referrer ?? "",
      v.language ?? "",
      v.screen ?? "",
      v.timezone ?? "",
      v.userAgent,
    ]
      .map(escape)
      .join(",")
  );
  const csv = [headers.map(escape).join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `visitors-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function VisitorsTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const {
    data: visitors = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<VisitorEntry[], Error>({
    queryKey: ["visitors"],
    queryFn: fetchVisitors,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visitors;
    return visitors.filter(
      (v) =>
        v.ip.toLowerCase().includes(q) ||
        v.page.toLowerCase().includes(q) ||
        (v.country ?? "").toLowerCase().includes(q) ||
        (v.browser ?? "").toLowerCase().includes(q)
    );
  }, [visitors, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset to page 0 when search changes
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(0);
  };

  const TABLE_HEADERS = [
    "Timestamp",
    "IP",
    "Device",
    "Browser",
    "OS",
    "Country",
    "Page",
    "Referrer",
    "UA",
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        Failed to load visitor data.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header row ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Visitors</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {filtered.length !== visitors.length
              ? `${filtered.length} of ${visitors.length} visits`
              : `${visitors.length} recorded visit${visitors.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Filter by IP, page, country…"
            className="h-8 w-56 rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-slate-300 placeholder:text-slate-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
          />
          {/* Export */}
          <button
            type="button"
            onClick={() => exportCSV(filtered)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            Export CSV
          </button>
          {/* Refresh */}
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      {visitors.length === 0 ? (
        <div className="glass-panel py-16 text-center">
          <p className="text-sm text-slate-600">No visitors recorded yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel py-12 text-center">
          <p className="text-sm text-slate-600">No results for &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <>
          {/* ── Table ── */}
          <div className="glass-table overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="glass-table-head border-b border-[var(--glass-border)]">
                  {TABLE_HEADERS.map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {slice.map((v) => (
                  <tr key={v.id} className="transition-colors hover:bg-white/3">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                      {formatDate(v.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {v.ip}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-full border px-2 py-0.5 text-xs font-medium",
                          DEVICE_BADGE[v.device] ?? "bg-slate-800 text-slate-400",
                        ].join(" ")}
                      >
                        {v.device}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {v.browser?.split(" ")[0] ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {v.os?.split(" ")[0] ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {v.country ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {v.page}
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-3 text-xs text-slate-600">
                      {v.referrer && v.referrer !== "direct" ? (
                        (() => {
                          try {
                            return new URL(v.referrer).hostname.replace(
                              /^www\./,
                              ""
                            );
                          } catch {
                            return v.referrer;
                          }
                        })()
                      ) : (
                        <span className="italic text-slate-700">direct</span>
                      )}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-xs text-slate-700">
                      {v.userAgent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors enabled:hover:bg-white/10 enabled:hover:text-white disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors enabled:hover:bg-white/10 enabled:hover:text-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
