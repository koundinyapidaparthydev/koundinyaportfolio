"use client";

/**
 * AllJobsTab — full job board with filters and per-row detail panel.
 * Data from GET /api/jobs (Google Sheet columns A–M).
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Job } from "@/app/api/jobs/route";
import {
  TIME_FILTERS,
  PLATFORM_FILTERS,
  SORT_OPTIONS,
  applyAllJobsFilters,
  detectPlatformFromUrl,
  filterByTime,
  formatRelativeTime,
  uniqueCategories,
  type TimeFilter,
  type SortMode,
  type PlatformFilter,
} from "@/lib/admin/allJobsFilters";

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch("/api/jobs");
  if (!res.ok) throw new Error("Failed to load jobs");
  const data = (await res.json()) as { jobs: Job[]; error?: string };
  if (data.error && data.jobs.length === 0) {
    throw new Error(data.error);
  }
  return data.jobs;
}

function formatAbsolute(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  travel: "✈️ Travel",
  "ai-agentic": "🤖 AI & Agentic",
  general: "🌐 General",
  "hiring-cafe": "☕ Hiring Cafe",
};

function categoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat || "—";
}

const PLATFORM_BADGE: Record<string, string> = {
  greenhouse: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  ashby: "bg-violet-500/15 text-violet-300 border-violet-500/20",
  workday: "bg-sky-500/15 text-sky-300 border-sky-500/20",
  lever: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  "hiring-cafe": "bg-orange-500/15 text-orange-300 border-orange-500/20",
  other: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-300">{value || "—"}</span>
    </div>
  );
}

function JobDetailPanel({ job, onClose }: { job: Job; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const platform = detectPlatformFromUrl(job.url);
  const now = Date.now();

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(job.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [job.url]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/8 bg-white/[0.03]">
      <div className="flex items-start justify-between gap-2 border-b border-white/8 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Job log · Row {job.rowIndex}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white leading-snug">
            {job.title || "Untitled"}
          </h3>
          <p className="text-xs text-slate-400">{job.company}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-white/5 hover:text-slate-300 xl:hidden"
          aria-label="Close details"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-2">
          <DetailRow
            label="Fetched"
            value={
              <>
                {formatRelativeTime(job.fetchedAt, now)}{" "}
                <span className="text-slate-500">({formatAbsolute(job.fetchedAt)})</span>
              </>
            }
          />
          <DetailRow label="Category" value={categoryLabel(job.category)} />
          <DetailRow label="Location" value={job.location} />
          <DetailRow
            label="Platform"
            value={
              <span
                className={[
                  "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                  PLATFORM_BADGE[platform] ?? PLATFORM_BADGE.other,
                ].join(" ")}
              >
                {platform}
              </span>
            }
          />
          {job.applyStatus && (
            <DetailRow label="Apply status" value={job.applyStatus} />
          )}
          {job.appliedAt && (
            <DetailRow label="Applied at" value={formatAbsolute(job.appliedAt)} />
          )}
          {job.atsScore && <DetailRow label="ATS score" value={job.atsScore} />}
        </div>

        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            URL
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-300 hover:bg-indigo-500/20"
            >
              {job.url || "—"}
            </a>
            <button
              type="button"
              onClick={() => void copyUrl()}
              className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-white"
            >
              {copied ? "Copied!" : "Copy URL"}
            </button>
          </div>
        </div>

        {job.description && (
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Description
            </p>
            <p className="max-h-40 overflow-y-auto rounded-lg border border-white/8 bg-white/[0.02] p-3 text-xs leading-relaxed text-slate-400">
              {job.description.length > 500
                ? `${job.description.slice(0, 500)}…`
                : job.description}
            </p>
          </div>
        )}

        {(job.resumeUrl || job.coverLetter) && (
          <div className="space-y-2">
            {job.resumeUrl && (
              <DetailRow
                label="Resume"
                value={
                  <a
                    href={job.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline"
                  >
                    Open resume
                  </a>
                }
              />
            )}
            {job.coverLetter && (
              <DetailRow label="Cover letter" value={job.coverLetter} />
            )}
          </div>
        )}

        {job.notes && (
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Notes
            </p>
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90 whitespace-pre-wrap">
              {job.notes}
            </p>
          </div>
        )}

        <p className="text-[10px] text-slate-600 italic">
          Scrape run logs are not stored separately — sheet fields above are the job record.
        </p>
      </div>
    </div>
  );
}

export default function AllJobsTab() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("2d");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [hasDescription, setHasDescription] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const {
    data: jobs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Job[], Error>({
    queryKey: ["all-jobs"],
    queryFn: fetchJobs,
    staleTime: 30_000,
  });

  const categories = useMemo(() => uniqueCategories(jobs), [jobs]);

  const filtered = useMemo(
    () =>
      applyAllJobsFilters(jobs, {
        search,
        category,
        timeFilter,
        platform,
        hasDescription,
        sort,
      }),
    [jobs, search, category, timeFilter, platform, hasDescription, sort]
  );

  const selectedJob = useMemo(
    () => (selectedUrl ? jobs.find((j) => j.url === selectedUrl) ?? null : null),
    [jobs, selectedUrl]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">All Jobs</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {filtered.length !== jobs.length
              ? `${filtered.length} of ${jobs.length} jobs`
              : `${jobs.length} job${jobs.length !== 1 ? "s" : ""} in sheet`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          Refresh
        </button>
      </div>

      {isError && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error?.message ?? "Failed to load jobs."}
        </p>
      )}

      {/* Search + sort + toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company, title, location, URL…"
          className="h-8 min-w-[200px] flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-slate-300 placeholder:text-slate-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="h-8 rounded-xl border border-white/10 bg-white/5 px-2 text-xs text-slate-300 focus:border-indigo-500/40 focus:outline-none"
        >
          {SORT_OPTIONS.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as PlatformFilter)}
          className="h-8 rounded-xl border border-white/10 bg-white/5 px-2 text-xs text-slate-300 focus:border-indigo-500/40 focus:outline-none"
        >
          {PLATFORM_FILTERS.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={hasDescription}
            onChange={(e) => setHasDescription(e.target.checked)}
            className="rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500/30"
          />
          Has description
        </label>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200/50 bg-slate-100 p-1 dark:border-transparent dark:bg-white/5">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={[
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
            category === "all"
              ? "bg-white text-indigo-600 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-300"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
          ].join(" ")}
        >
          All categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              category === cat
                ? "bg-white text-indigo-600 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-300"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
            ].join(" ")}
          >
            {categoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Time filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Fetched within:
        </span>
        {TIME_FILTERS.map(({ id, label }) => {
          const count = filterByTime(jobs, id).length;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTimeFilter(id)}
              className={[
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm transition-all duration-200",
                timeFilter === id
                  ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/20 dark:text-indigo-300"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:text-slate-200",
              ].join(" ")}
            >
              {label}
              {count > 0 && (
                <span
                  className={[
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    timeFilter === id
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-200"
                      : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
                  ].join(" ")}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main layout: table + detail panel */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        {/* Job list */}
        <div className="min-w-0 flex-1">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/3 py-16 text-center">
              <p className="text-sm text-slate-600">
                {jobs.length === 0
                  ? "No jobs in sheet — run the scraper or configure Google Sheets."
                  : "No jobs match the current filters."}
              </p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-22rem)] overflow-auto rounded-2xl border border-white/8">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
                  <tr className="border-b border-white/8">
                    {["Company", "Title", "Location", "Category", "Platform", "Fetched"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((job) => {
                    const plat = detectPlatformFromUrl(job.url);
                    const isSelected = selectedUrl === job.url;
                    return (
                      <tr
                        key={`${job.rowIndex}-${job.url}`}
                        onClick={() => setSelectedUrl(job.url)}
                        className={[
                          "cursor-pointer transition-colors",
                          isSelected
                            ? "bg-indigo-500/10"
                            : "hover:bg-white/3",
                        ].join(" ")}
                      >
                        <td className="max-w-[8rem] truncate px-3 py-2.5 text-xs font-medium text-slate-300">
                          {job.company}
                        </td>
                        <td className="max-w-[12rem] truncate px-3 py-2.5 text-xs text-slate-400">
                          {job.title}
                        </td>
                        <td className="max-w-[8rem] truncate px-3 py-2.5 text-xs text-slate-500">
                          {job.location || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                            {job.category || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span
                            className={[
                              "rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                              PLATFORM_BADGE[plat] ?? PLATFORM_BADGE.other,
                            ].join(" ")}
                          >
                            {plat}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] text-slate-500">
                          {formatRelativeTime(job.fetchedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel — side on desktop, below on mobile */}
        {selectedJob && (
          <div className="w-full shrink-0 xl:sticky xl:top-24 xl:w-96 xl:max-h-[calc(100vh-8rem)]">
            <JobDetailPanel job={selectedJob} onClose={() => setSelectedUrl(null)} />
          </div>
        )}
      </div>

      {!selectedJob && filtered.length > 0 && (
        <p className="text-center text-xs text-slate-600 xl:hidden">
          Tap a row to view job details and logs.
        </p>
      )}
      {!selectedJob && filtered.length > 0 && (
        <p className="hidden text-center text-xs text-slate-600 xl:block">
          Select a row to view job details in the side panel.
        </p>
      )}
    </div>
  );
}
