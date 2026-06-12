"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Job } from "@/app/api/jobs/route";
import {
  filterByCountryLocation,
  COUNTRY_LOCATION_FILTERS,
  formatRelativeTime,
} from "@/lib/admin/allJobsFilters";
import {
  AdminPageHeader,
  AdminSection,
  AdminStatCard,
} from "./AdminShell";
import { glass, glassCn } from "@/lib/glass";

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch("/api/jobs");
  if (!res.ok) throw new Error("Failed to load jobs");
  const data = (await res.json()) as { jobs: Job[] };
  return data.jobs;
}

function startOfToday(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(now = Date.now()) {
  const d = new Date(now);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function DiscoveriesTab({
  onViewJobs,
}: {
  onViewJobs?: () => void;
}) {
  const {
    data: jobs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Job[], Error>({
    queryKey: ["discoveries-jobs"],
    queryFn: fetchJobs,
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const now = Date.now();
    const todayStart = startOfToday(now);
    const weekStart = startOfWeek(now);

    const newToday = jobs.filter((j) => {
      const ts = j.fetchedAt ? new Date(j.fetchedAt).getTime() : 0;
      return ts >= todayStart;
    });

    const thisWeek = jobs.filter((j) => {
      const ts = j.fetchedAt ? new Date(j.fetchedAt).getTime() : 0;
      return ts >= weekStart;
    });

    const byLocation = COUNTRY_LOCATION_FILTERS.filter((f) => f.id !== "all").map(
      (f) => ({
        id: f.id,
        label: f.label,
        count: filterByCountryLocation(jobs, f.id).length,
      })
    );

    const companyCounts = new Map<string, number>();
    for (const job of thisWeek) {
      const name = job.company?.trim() || "Unknown";
      companyCounts.set(name, (companyCounts.get(name) ?? 0) + 1);
    }
    const topCompanies = Array.from(companyCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return { newToday, thisWeek, byLocation, topCompanies, now };
  }, [jobs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Discoveries"
        subtitle="Hiring Cafe engineering roles — Engineering + Software Development · last 2 days"
        actions={
          <div className="flex gap-2">
            {onViewJobs && (
              <button
                type="button"
                onClick={onViewJobs}
                className={glassCn(glass.btnPrimary, "px-3 py-1.5 text-xs font-medium")}
              >
                View all jobs
              </button>
            )}
            <button
              type="button"
              onClick={() => void refetch()}
              className={glassCn(glass.btn, "px-3 py-1.5 text-xs font-medium")}
            >
              Refresh
            </button>
          </div>
        }
      />

      {isError && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load job data.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label="Total HC jobs"
          value={jobs.length}
          accent
        />
        <AdminStatCard
          label="New today"
          value={stats.newToday.length}
          sub="Discovered since midnight"
        />
        <AdminStatCard
          label="This week"
          value={stats.thisWeek.length}
          sub="Mon–Sun discoveries"
        />
        <AdminStatCard
          label="With posted date"
          value={jobs.filter((j) => j.postedAt).length}
          sub="ATS / HC post time known"
        />
      </div>

      <AdminSection title="By location">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.byLocation.map(({ id, label, count }) => (
            <div key={id} className={glassCn(glass.panel, "p-4")}>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {label}
              </p>
              <p className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-300">
                {count}
              </p>
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection title="Top companies this week">
        <div className={glassCn(glass.panel, "divide-y divide-white/8")}>
          {stats.topCompanies.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No discoveries this week yet.</p>
          ) : (
            stats.topCompanies.map(([company, count]) => (
              <div
                key={company}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {company}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {count} role{count !== 1 ? "s" : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </AdminSection>

      <AdminSection title="Latest discoveries">
        <div className={glassCn(glass.panel, "divide-y divide-white/8")}>
          {stats.newToday.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No new jobs discovered today.</p>
          ) : (
            stats.newToday.slice(0, 10).map((job) => (
              <div key={job.url} className="flex flex-wrap items-center gap-2 px-5 py-3">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {job.company}
                </span>
                <span className="text-xs text-slate-500">·</span>
                <span className="truncate text-xs text-slate-400">{job.title}</span>
                <span className="ml-auto text-[10px] text-slate-500">
                  {job.fetchedAt
                    ? formatRelativeTime(job.fetchedAt, stats.now)
                    : "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </AdminSection>
    </div>
  );
}
