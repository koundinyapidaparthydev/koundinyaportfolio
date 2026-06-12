"use client";

/**
 * AllJobsTab — Hiring Cafe job board with search, location, and time filters.
 * Data from GET /api/jobs (Google Sheet columns A–Q).
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import type { Job } from "@/app/api/jobs/route";
import {
  TIME_FILTERS,
  DEFAULT_ALL_JOBS_SORT,
  DEFAULT_TIME_FILTER,
  DEFAULT_COUNTRY_LOCATION,
  DEFAULT_ATS_MIN_SCORE,
  applyAllJobsFilters,
  detectPlatformFromUrl,
  filterByTime,
  formatRelativeTime,
  formatOpenDate,
  toggleSortColumn,
  type TimeFilter,
  type SortColumn,
  type AllJobsSort,
} from "@/lib/admin/allJobsFilters";
import { glass, glassCn } from "@/lib/glass";
import { resolveCompanyLogo, companyInitial } from "@/lib/admin/companyLogos";
import { AdminPageHeader } from "./AdminShell";

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch("/api/jobs", { cache: "no-store" });
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

const PLATFORM_BADGE: Record<string, string> = {
  greenhouse: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  ashby: "bg-violet-500/15 text-violet-300 border-violet-500/20",
  workday: "bg-sky-500/15 text-sky-300 border-sky-500/20",
  lever: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  "hiring-cafe": "bg-orange-500/15 text-orange-300 border-orange-500/20",
  other: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

const TABLE_COLUMNS: { id: SortColumn; label: string }[] = [
  { id: "company", label: "Company" },
  { id: "title", label: "Title" },
  { id: "location", label: "Location" },
  { id: "atsScore", label: "ATS" },
  { id: "postedAt", label: "Posted" },
  { id: "fetchedAt", label: "Discovered" },
];

function CompanyLogo({ company, url, size = "sm" }: { company: string; url: string; size?: "sm" | "md" }) {
  const logo = resolveCompanyLogo(company, url);
  const [failed, setFailed] = useState(false);
  const dim = size === "md" ? "h-8 w-8 text-[11px]" : "h-6 w-6 text-[9px]";

  if (logo && !failed) {
    return (
      <img
        src={logo}
        alt=""
        className={`${dim} shrink-0 rounded object-contain`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded bg-white/10 font-bold text-slate-400`}
    >
      {companyInitial(company)}
    </span>
  );
}

function SortableHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: SortColumn;
  sort: AllJobsSort;
  onSort: (column: SortColumn) => void;
}) {
  const active = sort.column === column;
  const indicator = active ? (sort.direction === "asc" ? " ↑" : " ↓") : "";

  return (
    <th className="px-3 py-2.5 text-left">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={[
          "text-left text-[10px] font-semibold uppercase tracking-wider transition-colors",
          active ? "text-indigo-300" : "text-slate-500 hover:text-slate-300",
        ].join(" ")}
      >
        {label}
        {indicator}
      </button>
    </th>
  );
}

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
    <div className={glassCn(glass.adminPanel, "flex h-full flex-col")}>
      <div className="flex items-start justify-between gap-2 border-b border-white/8 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Job log · Row {job.rowIndex}
          </p>
          <h3 className="mt-1 text-sm font-semibold leading-snug text-white">{job.title || "Untitled"}</h3>
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
            label="Posted"
            value={
              job.postedAt ? (
                <>
                  {formatOpenDate(job.postedAt)}{" "}
                  <span className="text-slate-500">({formatRelativeTime(job.postedAt, now)})</span>
                </>
              ) : (
                "—"
              )
            }
          />
          {job.fetchedAt && (
            <DetailRow
              label="Discovered"
              value={
                <>
                  {formatRelativeTime(job.fetchedAt, now)}{" "}
                  <span className="text-slate-500">({formatAbsolute(job.fetchedAt)})</span>
                </>
              }
            />
          )}
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
          {job.applyStatus && <DetailRow label="Apply status" value={job.applyStatus} />}
          {job.appliedAt && <DetailRow label="Applied at" value={formatAbsolute(job.appliedAt)} />}
          {job.atsScore && (
            <DetailRow
              label="ATS score"
              value={
                <span
                  className={
                    Number(job.atsScore) >= DEFAULT_ATS_MIN_SCORE
                      ? "font-semibold text-emerald-400"
                      : undefined
                  }
                >
                  {job.atsScore}%
                </span>
              }
            />
          )}
          {job.atsMatchSummary && <DetailRow label="ATS summary" value={job.atsMatchSummary} />}
          {job.keyGaps && <DetailRow label="Key gaps" value={job.keyGaps} />}
          {job.recommendedKeywords && (
            <DetailRow label="Keywords" value={job.recommendedKeywords} />
          )}
        </div>

        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">URL</p>
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
              {job.description.length > 500 ? `${job.description.slice(0, 500)}…` : job.description}
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
            {job.coverLetter && <DetailRow label="Cover letter" value={job.coverLetter} />}
          </div>
        )}

        {job.notes && (
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Notes</p>
            <p className="whitespace-pre-wrap rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90">
              {job.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({
  job,
  isSelected,
  onSelect,
}: {
  job: Job;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={glassCn(
        glass.adminPanel,
        "w-full p-4 text-left transition-colors",
        isSelected && "ring-1 ring-indigo-500/40"
      )}
    >
      <div className="flex items-start gap-3">
        <CompanyLogo company={job.company} url={job.url} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{job.title}</p>
          <p className="truncate text-xs text-slate-500">{job.company}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{job.location || "—"}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
            <span>Posted: {job.postedAt ? formatOpenDate(job.postedAt) : "—"}</span>
            {job.fetchedAt && <span>· Discovered {formatRelativeTime(job.fetchedAt)}</span>}
          </div>
        </div>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={glassCn(glass.btnPrimary, "shrink-0 px-2.5 py-1 text-[10px] font-medium")}
        >
          Apply
        </a>
      </div>
    </motion.button>
  );
}

export default function AllJobsTab() {
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(DEFAULT_TIME_FILTER);
  const [sort, setSort] = useState<AllJobsSort>(DEFAULT_ALL_JOBS_SORT);
  const [hasDescription, setHasDescription] = useState(false);
  const [atsFriendly, setAtsFriendly] = useState(true);
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
    staleTime: 10_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const filtered = useMemo(
    () =>
      applyAllJobsFilters(jobs, {
        search,
        timeFilter,
        hasDescription,
        atsFriendly,
        countryLocation: DEFAULT_COUNTRY_LOCATION,
        sort,
      }),
    [jobs, search, timeFilter, hasDescription, atsFriendly, sort]
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
      <AdminPageHeader
        title="Hiring Cafe Jobs"
        subtitle="Engineering + Software Development · US · last 2 days"
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            className={glassCn(glass.btn, "px-3 py-1.5 text-xs font-medium")}
          >
            Refresh
          </button>
        }
      />

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {filtered.length !== jobs.length
          ? `${filtered.length} of ${jobs.length} jobs`
          : `${jobs.length} job${jobs.length !== 1 ? "s" : ""} in sheet`}
      </p>

      {isError && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error?.message ?? "Failed to load jobs."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company, title, location, URL…"
          className="glass-input h-9 min-w-[200px] flex-1 px-3 text-xs"
        />
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={hasDescription}
            onChange={(e) => setHasDescription(e.target.checked)}
            className="rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500/30"
          />
          Has description
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-300/90">
          <input
            type="checkbox"
            checked={atsFriendly}
            onChange={(e) => setAtsFriendly(e.target.checked)}
            className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30"
          />
          ATS-friendly (≥{DEFAULT_ATS_MIN_SCORE}%)
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Discovered within:
        </span>
        {TIME_FILTERS.map(({ id, label }) => {
          const count = filterByTime(jobs, id).length;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTimeFilter(id)}
              className={glassCn(
                "inline-flex items-center gap-1.5",
                timeFilter === id
                  ? glassCn(glass.adminPillActive, "text-indigo-600 dark:text-indigo-300")
                  : glass.adminPill
              )}
            >
              {label}
              {count > 0 && <span className={glass.pillBadge}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          {filtered.length === 0 ? (
            <div className={glassCn(glass.adminPanel, "py-16 text-center")}>
              <p className="text-sm text-slate-600">
                {jobs.length === 0
                  ? "No jobs in sheet — run the HC pipeline or configure Google Sheets."
                  : "No jobs match the current filters."}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filtered.map((job) => (
                  <JobCard
                    key={`${job.rowIndex}-${job.url}`}
                    job={job}
                    isSelected={selectedUrl === job.url}
                    onSelect={() => setSelectedUrl(job.url)}
                  />
                ))}
              </div>

              {/* Desktop table */}
              <div className={glassCn(glass.adminTable, "hidden max-h-[calc(100vh-22rem)] overflow-auto md:block")}>
                <table className="w-full text-sm">
                  <thead className={glassCn(glass.adminTableHead, "sticky top-0 z-10")}>
                    <tr className="border-b border-white/8">
                      {TABLE_COLUMNS.map(({ id, label }) => (
                        <SortableHeader
                          key={id}
                          label={label}
                          column={id}
                          sort={sort}
                          onSort={(column) => setSort((current) => toggleSortColumn(current, column))}
                        />
                      ))}
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Apply
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((job, i) => {
                      const isSelected = selectedUrl === job.url;
                      return (
                        <motion.tr
                          key={`${job.rowIndex}-${job.url}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.02, 0.4) }}
                          onClick={() => setSelectedUrl(job.url)}
                          className={[
                            "cursor-pointer transition-colors",
                            isSelected ? "bg-indigo-500/10" : "hover:bg-white/3",
                          ].join(" ")}
                        >
                          <td className="max-w-[10rem] px-3 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <CompanyLogo company={job.company} url={job.url} size="md" />
                              <span className="truncate text-xs font-medium text-slate-300">
                                {job.company}
                              </span>
                            </div>
                          </td>
                          <td className="max-w-[12rem] truncate px-3 py-2.5 text-xs text-slate-400">
                            {job.title}
                          </td>
                          <td className="max-w-[8rem] truncate px-3 py-2.5 text-xs text-slate-500">
                            {job.location || "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold">
                            {job.atsScore ? (
                              <span
                                className={
                                  Number(job.atsScore) >= DEFAULT_ATS_MIN_SCORE
                                    ? "text-emerald-400"
                                    : "text-slate-400"
                                }
                              >
                                {job.atsScore}%
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td
                            className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-slate-300"
                            title={job.postedAt ? formatAbsolute(job.postedAt) : undefined}
                          >
                            {job.postedAt ? formatOpenDate(job.postedAt) : "—"}
                          </td>
                          <td
                            className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500"
                            title={job.fetchedAt ? formatAbsolute(job.fetchedAt) : undefined}
                          >
                            {job.fetchedAt ? formatRelativeTime(job.fetchedAt) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={glassCn(glass.btn, "inline-flex px-2.5 py-1 text-[10px] font-medium")}
                            >
                              Apply
                            </a>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {selectedJob && (
          <div className="w-full shrink-0 xl:sticky xl:top-24 xl:w-96 xl:max-h-[calc(100vh-8rem)]">
            <JobDetailPanel job={selectedJob} onClose={() => setSelectedUrl(null)} />
          </div>
        )}
      </div>

      {!selectedJob && filtered.length > 0 && (
        <p className="text-center text-xs text-slate-600 xl:hidden">
          Tap a row to view job details.
        </p>
      )}
    </div>
  );
}
