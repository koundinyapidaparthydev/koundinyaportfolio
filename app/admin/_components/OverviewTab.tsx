"use client";

import { glass, glassCn } from "@/lib/glass";

/**
 * OverviewTab — rich visitor analytics dashboard.
 * Fetches data from GET /api/visitors (admin-only).
 */

import { useQuery } from "@tanstack/react-query";
import type { VisitorEntry } from "@/lib/visitorStore";

async function fetchVisitors(): Promise<VisitorEntry[]> {
  const res = await fetch("/api/visitors");
  if (!res.ok) throw new Error("Failed to load visitor data");
  return res.json() as Promise<VisitorEntry[]>;
}

// ── Small reusable primitives ────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={glassCn(
        "glass-panel p-5 transition-colors",
        accent && "border-indigo-500/30 bg-indigo-500/10"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p
        className={[
          "mt-2 text-3xl font-bold",
          accent ? "text-indigo-300" : "text-white",
        ].join(" ")}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
      {children}
    </p>
  );
}

/** Horizontal stacked bar for device/browser/OS breakdowns */
function BreakdownBar({
  title,
  items,
  colors,
  total,
}: {
  title: string;
  items: [string, number][];
  colors: string[];
  total: number;
}) {
  return (
    <div className={glassCn(glass.panel, "p-5")}>
      <SectionHeading>{title}</SectionHeading>
      {total === 0 ? (
        <p className="text-xs text-slate-600">No data yet.</p>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="flex h-2.5 overflow-hidden rounded-full">
            {items.map(([key, count], i) => {
              const pct = (count / total) * 100;
              return pct > 0 ? (
                <div
                  key={key}
                  className={colors[i % colors.length]}
                  style={{ width: `${pct}%` }}
                  title={`${key}: ${pct.toFixed(1)}%`}
                />
              ) : null;
            })}
          </div>
          {/* Legend */}
          <ul className="mt-3 space-y-1.5">
            {items.map(([key, count], i) => (
              <li key={key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-400">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${colors[i % colors.length]}`}
                  />
                  <span className="max-w-[120px] truncate">{key}</span>
                </span>
                <span className="tabular-nums text-slate-500">
                  {count}{" "}
                  <span className="text-slate-600">
                    ({((count / total) * 100).toFixed(0)}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ── Colour palettes ──────────────────────────────────────────────────────────

const DEVICE_COLORS = ["bg-indigo-500", "bg-violet-500", "bg-sky-500"];
const BROWSER_COLORS = [
  "bg-orange-500",
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-pink-500",
  "bg-yellow-500",
];
const OS_COLORS = [
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-fuchsia-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
];

// ── Helper to build frequency map ────────────────────────────────────────────

function freqMap(items: (string | undefined)[]): [string, number][] {
  const map: Record<string, number> = {};
  for (const v of items) {
    const key = v || "Unknown";
    map[key] = (map[key] ?? 0) + 1;
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OverviewTab() {
  const {
    data: visitors = [],
    isLoading,
    isError,
  } = useQuery<VisitorEntry[], Error>({
    queryKey: ["visitors"],
    queryFn: fetchVisitors,
    staleTime: 30_000,
  });

  // ── Derived stats ─────────────────────────────────────────────────────────
  const total = visitors.length;

  const todayStr = new Date().toDateString();
  const yesterdayStr = new Date(Date.now() - 86_400_000).toDateString();
  const todayCount = visitors.filter(
    (v) => new Date(v.timestamp).toDateString() === todayStr
  ).length;
  const yesterdayCount = visitors.filter(
    (v) => new Date(v.timestamp).toDateString() === yesterdayStr
  ).length;
  const todayDelta = todayCount - yesterdayCount;

  const uniqueIPs = new Set(visitors.map((v) => v.ip)).size;

  const browserEntries = freqMap(visitors.map((v) => v.browser?.split(" ")[0]));
  const topBrowser = browserEntries[0]?.[0] ?? "—";

  const lastVisit = visitors[0]
    ? new Date(visitors[0].timestamp).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  const cutoff30 = Date.now() - 30 * 86_400_000;
  const count30 = visitors.filter(
    (v) => new Date(v.timestamp).getTime() >= cutoff30
  ).length;
  const avg30 = count30 > 0 ? (count30 / 30).toFixed(1) : "0";

  // ── 7-day bar chart data ──────────────────────────────────────────────────
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    const dateStr = d.toDateString();
    const count = visitors.filter(
      (v) => new Date(v.timestamp).toDateString() === dateStr
    ).length;
    return { label, count };
  });
  const maxDay = Math.max(...last7Days.map((d) => d.count), 1);

  // ── Breakdown maps ────────────────────────────────────────────────────────
  const deviceEntries = freqMap(visitors.map((v) => v.device));
  const osEntries = freqMap(visitors.map((v) => v.os?.split(" ")[0]));

  const referrerEntries = freqMap(
    visitors.map((v) => {
      if (!v.referrer || v.referrer === "direct") return "Direct";
      try {
        return new URL(v.referrer).hostname.replace(/^www\./, "");
      } catch {
        return v.referrer;
      }
    })
  ).slice(0, 6);

  const countryEntries = freqMap(visitors.map((v) => v.country)).slice(0, 5);

  // Top pages
  const pageEntries = freqMap(visitors.map((v) => v.page || "/")).slice(0, 8);

  const recentActivity = visitors.slice(0, 10);

  // ── Render ────────────────────────────────────────────────────────────────
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
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Overview</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Live analytics from your portfolio&apos;s visitor tracker.
        </p>
      </div>

      {/* ── 6 Stat cards (2×3) ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Visitors" value={total} accent />
        <StatCard
          label="Today's Visitors"
          value={todayCount}
          sub={
            todayDelta === 0
              ? "Same as yesterday"
              : todayDelta > 0
              ? `↑ ${todayDelta} more than yesterday`
              : `↓ ${Math.abs(todayDelta)} fewer than yesterday`
          }
        />
        <StatCard label="Unique IPs" value={uniqueIPs} sub="distinct visitors" />
        <StatCard
          label="Top Browser"
          value={topBrowser}
          sub={browserEntries[0] ? `${browserEntries[0][1]} visits` : undefined}
        />
        <StatCard label="Last Visit" value={lastVisit} />
        <StatCard
          label="30-Day Avg / Day"
          value={avg30}
          sub={`${count30} visits in last 30 days`}
        />
      </div>

      {/* ── 7-day traffic chart ── */}
      <div className={glassCn(glass.panel, "p-5")}>
        <SectionHeading>Traffic — Last 7 Days</SectionHeading>
        <div className="flex items-end gap-2" style={{ height: 100 }}>
          {last7Days.map(({ label, count }) => {
            const pct = maxDay > 0 ? (count / maxDay) * 100 : 0;
            return (
              <div
                key={label}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span className="text-[10px] tabular-nums text-slate-500">
                  {count > 0 ? count : ""}
                </span>
                <div
                  className="w-full overflow-hidden rounded-t"
                  style={{ height: 68 }}
                >
                  <div
                    className="w-full rounded-t bg-indigo-500 transition-all duration-500"
                    style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-600">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3-column breakdown: Device | Browser | OS ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownBar
          title="By Device"
          items={deviceEntries}
          colors={DEVICE_COLORS}
          total={total}
        />
        <BreakdownBar
          title="By Browser"
          items={browserEntries.slice(0, 5)}
          colors={BROWSER_COLORS}
          total={total}
        />
        <BreakdownBar
          title="By OS"
          items={osEntries.slice(0, 5)}
          colors={OS_COLORS}
          total={total}
        />
      </div>

      {/* ── Top pages + Top referrers side by side ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top pages */}
        <div className={glassCn(glass.panel, "p-5")}>
          <SectionHeading>Top Pages</SectionHeading>
          {pageEntries.length === 0 ? (
            <p className="text-xs text-slate-600">No data yet.</p>
          ) : (
            <ul className="space-y-2">
              {pageEntries.map(([page, count]) => {
                const pct = total ? (count / total) * 100 : 0;
                return (
                  <li key={page} className="flex items-center gap-3">
                    <span className="w-28 truncate font-mono text-xs text-slate-400 sm:w-36">
                      {page}
                    </span>
                    <div className="flex-1 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs tabular-nums text-slate-500">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Top referrers */}
        <div className={glassCn(glass.panel, "p-5")}>
          <SectionHeading>Top Referrers</SectionHeading>
          {referrerEntries.length === 0 ? (
            <p className="text-xs text-slate-600">No data yet.</p>
          ) : (
            <ul className="space-y-2">
              {referrerEntries.map(([ref, count]) => {
                const pct = total ? (count / total) * 100 : 0;
                return (
                  <li key={ref} className="flex items-center gap-3">
                    <span className="w-28 truncate text-xs text-slate-400 sm:w-36">
                      {ref}
                    </span>
                    <div className="flex-1 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-1.5 rounded-full bg-violet-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs tabular-nums text-slate-500">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Geographic distribution ── */}
      {countryEntries.length > 0 && (
        <div className={glassCn(glass.panel, "p-5")}>
          <SectionHeading>Geographic Distribution (Top 5 Countries)</SectionHeading>
          <div className="flex flex-wrap gap-3">
            {countryEntries.map(([country, count]) => (
              <div
                key={country}
                className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-4 py-2"
              >
                <span className="text-xs font-semibold text-slate-300">{country}</span>
                <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Activity ── */}
      {recentActivity.length > 0 && (
        <div className={glassCn(glass.panel, "p-5")}>
          <SectionHeading>Recent Activity (last 10)</SectionHeading>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="pb-2 text-left font-medium text-slate-600">Time</th>
                  <th className="pb-2 text-left font-medium text-slate-600">Device</th>
                  <th className="pb-2 text-left font-medium text-slate-600">Browser</th>
                  <th className="pb-2 text-left font-medium text-slate-600">Country</th>
                  <th className="pb-2 text-left font-medium text-slate-600">Page</th>
                  <th className="pb-2 text-left font-medium text-slate-600">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentActivity.map((v) => (
                  <tr key={v.id} className="hover:bg-white/3">
                    <td className="py-2 pr-3 tabular-nums text-slate-500 whitespace-nowrap">
                      {new Date(v.timestamp).toLocaleString("en-US", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={[
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          v.device === "Desktop"
                            ? "border-indigo-500/20 bg-indigo-500/15 text-indigo-300"
                            : v.device === "Mobile"
                            ? "border-violet-500/20 bg-violet-500/15 text-violet-300"
                            : "border-sky-500/20 bg-sky-500/15 text-sky-300",
                        ].join(" ")}
                      >
                        {v.device}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-400">
                      {v.browser?.split(" ")[0] ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-slate-400">{v.country ?? "—"}</td>
                    <td className="py-2 pr-3 max-w-[160px] truncate font-mono text-slate-400">
                      {v.page}
                    </td>
                    <td className="py-2 text-slate-600">{v.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
