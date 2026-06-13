/**
 * Filter/sort helpers for the All Jobs admin tab.
 */

import {
  filterByCountryLocation,
  type CountryLocationFilter,
} from "@/lib/admin/jobLocationMatch";
import { DEFAULT_ATS_MIN_SCORE } from "@/lib/admin/atsConfig";

export { DEFAULT_ATS_MIN_SCORE } from "@/lib/admin/atsConfig";

export {
  COUNTRY_LOCATION_FILTERS,
  DEFAULT_COUNTRY_LOCATION,
  matchesLocation,
  filterByCountryLocation,
  type CountryLocationFilter,
} from "@/lib/admin/jobLocationMatch";

export type TimeFilter = "10m" | "20m" | "30m" | "2h" | "12h" | "1d" | "2d" | "all";

/** Apply-now window: Jobs tab holds discoveries from the last 12 hours. */
export const APPLY_NOW_WINDOW_MS = 12 * 60 * 60_000;

/** Default time filter — aligned with 10-minute scrape interval. */
export const DEFAULT_TIME_FILTER: TimeFilter = "10m";

/** Matches GHA cron and `npm run job:pipeline:loop`. */
export const HC_PIPELINE_INTERVAL_MS = 10 * 60_000;

/** Filter jobs by whether the resume was AI-tailored for that role. */
export type ResumeModifiedFilter = "non-modified" | "modified" | "all";

export const DEFAULT_RESUME_MODIFIED_FILTER: ResumeModifiedFilter = "non-modified";

export const RESUME_MODIFIED_FILTER_OPTIONS: {
  id: ResumeModifiedFilter;
  label: string;
}[] = [
  { id: "non-modified", label: "Non-tailored (≥75% base resume)" },
  { id: "modified", label: "AI-tailored resumes" },
  { id: "all", label: "All jobs" },
];

export type SortColumn =
  | "company"
  | "title"
  | "location"
  | "postedAt"
  | "fetchedAt"
  | "atsScore";
export type SortDirection = "asc" | "desc";

export interface AllJobsSort {
  column: SortColumn;
  direction: SortDirection;
}

export const DEFAULT_ALL_JOBS_SORT: AllJobsSort = {
  column: "atsScore",
  direction: "desc",
};

export type PlatformFilter =
  | "all"
  | "greenhouse"
  | "workday"
  | "ashby"
  | "lever"
  | "smartrecruiters"
  | "icims"
  | "hiring-cafe"
  | "amazon"
  | "google"
  | "meta"
  | "apple"
  | "workable"
  | "other";

export interface AllJobsRow {
  company: string;
  title: string;
  location: string;
  url: string;
  category: string;
  /** Scrape-time / last-seen timestamp (sheet column F). */
  fetchedAt: string;
  /** ATS position posted date (sheet column N). */
  postedAt: string;
  description: string;
  atsScore?: string;
  atsMatchSummary?: string;
  keyGaps?: string;
  recommendedKeywords?: string;
  /** Sheet column R — "yes" when resume was AI-tailored. */
  resumeModified?: string;
  /** Sheet column S — ATS score before tailoring (for comparison). */
  preTailorAtsScore?: string;
  resumeUrl?: string;
  applyStatus?: string;
  appliedAt?: string;
}

/** Whether applied jobs appear in the list (hidden by default). */
export type AppliedVisibilityFilter = "hide-applied" | "include-applied";

export const DEFAULT_APPLIED_VISIBILITY_FILTER: AppliedVisibilityFilter = "hide-applied";

export const APPLIED_VISIBILITY_OPTIONS: {
  id: AppliedVisibilityFilter;
  label: string;
}[] = [
  { id: "hide-applied", label: "Active jobs" },
  { id: "include-applied", label: "All jobs + applied" },
];

/** True when the job was marked applied in the sheet (column K). */
export function isJobApplied(job: { applyStatus?: string }): boolean {
  return job.applyStatus?.trim().toLowerCase() === "applied";
}

export function filterByAppliedVisibility<T extends AllJobsRow>(
  jobs: T[],
  filter: AppliedVisibilityFilter
): T[] {
  if (filter === "include-applied") return jobs;
  return jobs.filter((j) => !isJobApplied(j));
}

export const NEW_JOB_WINDOW_MS = 30 * 60_000;

export const TIME_FILTERS: { id: TimeFilter; label: string; ms: number | null }[] = [
  { id: "10m", label: "⚡ Last 10 mins", ms: HC_PIPELINE_INTERVAL_MS },
  { id: "20m", label: "Last 20 mins", ms: 20 * 60_000 },
  { id: "30m", label: "Last 30 mins", ms: NEW_JOB_WINDOW_MS },
  { id: "2h", label: "Last 2 hrs", ms: 2 * 3_600_000 },
  { id: "12h", label: "✅ Apply now (12h)", ms: APPLY_NOW_WINDOW_MS },
  { id: "1d", label: "Last 24 hrs", ms: 24 * 3_600_000 },
  { id: "2d", label: "Last 48 hrs", ms: 48 * 3_600_000 },
  { id: "all", label: "All time", ms: null },
];

export const PLATFORM_FILTERS: { id: PlatformFilter; label: string }[] = [
  { id: "all", label: "All platforms" },
  { id: "greenhouse", label: "Greenhouse" },
  { id: "ashby", label: "Ashby" },
  { id: "workday", label: "Workday" },
  { id: "lever", label: "Lever" },
  { id: "smartrecruiters", label: "SmartRecruiters" },
  { id: "icims", label: "iCIMS" },
  { id: "hiring-cafe", label: "Hiring Cafe" },
  { id: "amazon", label: "Amazon" },
  { id: "google", label: "Google" },
  { id: "meta", label: "Meta" },
  { id: "apple", label: "Apple" },
  { id: "workable", label: "Workable" },
  { id: "other", label: "Other" },
];

const MIN_DESCRIPTION_CHARS = 30;

/** Infer ATS platform from job URL (mirrors scrape-jobs.mjs). */
export function detectPlatformFromUrl(url = ""): PlatformFilter {
  const u = url.toLowerCase();
  if (u.includes("greenhouse.io") || u.includes("boards.greenhouse")) return "greenhouse";
  if (u.includes("myworkdayjobs.com") || u.includes("workday.com")) return "workday";
  if (u.includes("lever.co")) return "lever";
  if (u.includes("ashbyhq.com")) return "ashby";
  if (u.includes("smartrecruiters.com")) return "smartrecruiters";
  if (u.includes("icims.com")) return "icims";
  if (u.includes("hiring.cafe")) return "hiring-cafe";
  if (u.includes("amazon.jobs")) return "amazon";
  if (u.includes("careers.google.com")) return "google";
  if (u.includes("metacareers.com")) return "meta";
  if (u.includes("jobs.apple.com")) return "apple";
  if (u.includes("apply.workable.com")) return "workable";
  return "other";
}

function isoTimestamp(iso: string): number | null {
  if (!iso?.trim()) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Discovery time for time-slot filters (fetchedAt = first seen in apply-now window). */
export function jobTimeTimestamp(job: AllJobsRow): number | null {
  return isoTimestamp(job.fetchedAt) ?? isoTimestamp(job.postedAt);
}

/**
 * Time-window filters use discovery time (fetchedAt), then ATS post date.
 */
export function filterByTime<T extends AllJobsRow>(
  jobs: T[],
  filter: TimeFilter,
  now = Date.now()
): T[] {
  if (filter === "all") return jobs;
  const { ms } = TIME_FILTERS.find((f) => f.id === filter)!;
  if (ms == null) return jobs;
  return jobs.filter((j) => {
    const ts = jobTimeTimestamp(j);
    if (ts === null) return false;
    return now - ts <= ms;
  });
}

export function filterBySearch<T extends AllJobsRow>(jobs: T[], q: string): T[] {
  if (!q.trim()) return jobs;
  const lower = q.toLowerCase();
  return jobs.filter(
    (j) =>
      j.company.toLowerCase().includes(lower) ||
      j.title.toLowerCase().includes(lower) ||
      j.location.toLowerCase().includes(lower) ||
      j.url.toLowerCase().includes(lower)
  );
}

export function filterByCategory<T extends AllJobsRow>(
  jobs: T[],
  category: string
): T[] {
  if (category === "all") return jobs;
  return jobs.filter((j) => j.category === category);
}

export function filterByPlatform<T extends AllJobsRow>(
  jobs: T[],
  platform: PlatformFilter
): T[] {
  if (platform === "all") return jobs;
  return jobs.filter((j) => detectPlatformFromUrl(j.url) === platform);
}

export function filterByHasDescription<T extends AllJobsRow>(
  jobs: T[],
  required: boolean
): T[] {
  if (!required) return jobs;
  return jobs.filter((j) => (j.description ?? "").trim().length >= MIN_DESCRIPTION_CHARS);
}

export function parseAtsScore(value?: string): number | null {
  if (!value?.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** True when this job has an AI-tailored resume stored. */
export function isResumeModified(job: {
  resumeModified?: string;
  resumeUrl?: string;
}): boolean {
  const flag = (job.resumeModified ?? "").trim().toLowerCase();
  if (flag === "yes") return true;
  if (flag === "no") return false;
  return !!(job.resumeUrl ?? "").trim();
}

/** Keep jobs at or above the ATS threshold (requires a numeric ATS score). */
export function filterByAtsFriendly<T extends AllJobsRow>(
  jobs: T[],
  enabled: boolean,
  minScore = DEFAULT_ATS_MIN_SCORE
): T[] {
  if (!enabled) return jobs;
  return jobs.filter((j) => {
    const score = parseAtsScore(j.atsScore);
    return score !== null && score >= minScore;
  });
}

/**
 * Filter by base vs AI-tailored resume.
 * - non-modified: base resume only, ATS ≥ minScore
 * - modified: AI-tailored rows
 * - all: no filter
 */
export function filterByResumeModified<T extends AllJobsRow>(
  jobs: T[],
  filter: ResumeModifiedFilter,
  minScore = DEFAULT_ATS_MIN_SCORE
): T[] {
  if (filter === "all") return jobs;
  if (filter === "modified") {
    return jobs.filter((j) => isResumeModified(j));
  }
  return jobs.filter((j) => {
    if (isResumeModified(j)) return false;
    const score = parseAtsScore(j.atsScore);
    return score !== null && score >= minScore;
  });
}

export function toggleSortColumn(
  current: AllJobsSort,
  column: SortColumn
): AllJobsSort {
  if (current.column === column) {
    return {
      column,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }
  return {
    column,
    direction:
      column === "postedAt" || column === "fetchedAt" || column === "atsScore"
        ? "desc"
        : "asc",
  };
}

export function sortAllJobs<T extends AllJobsRow>(
  jobs: T[],
  sort: AllJobsSort = DEFAULT_ALL_JOBS_SORT
): T[] {
  const arr = [...jobs];
  const dir = sort.direction === "asc" ? 1 : -1;

  return arr.sort((a, b) => {
    if (sort.column === "atsScore") {
      const aScore = parseAtsScore(a.atsScore);
      const bScore = parseAtsScore(b.atsScore);
      if (aScore === null && bScore === null) return 0;
      if (aScore === null) return 1;
      if (bScore === null) return -1;
      return (aScore - bScore) * dir;
    }

    if (sort.column === "postedAt" || sort.column === "fetchedAt") {
      const aT =
        sort.column === "postedAt"
          ? isoTimestamp(a.postedAt)
          : isoTimestamp(a.fetchedAt);
      const bT =
        sort.column === "postedAt"
          ? isoTimestamp(b.postedAt)
          : isoTimestamp(b.fetchedAt);
      if (aT === null && bT === null) return 0;
      if (aT === null) return 1;
      if (bT === null) return -1;
      return (aT - bT) * dir;
    }

    let cmp = 0;
    switch (sort.column) {
      case "company":
        cmp =
          a.company.localeCompare(b.company) || a.title.localeCompare(b.title);
        break;
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "location":
        cmp = (a.location ?? "").localeCompare(b.location ?? "");
        break;
    }
    return cmp * dir;
  });
}

export interface AllJobsFilterOpts {
  search: string;
  timeFilter: TimeFilter;
  hasDescription: boolean;
  resumeModifiedFilter: ResumeModifiedFilter;
  appliedVisibility?: AppliedVisibilityFilter;
  atsMinScore?: number;
  countryLocation: CountryLocationFilter;
  sort?: AllJobsSort;
  now?: number;
}

export function applyAllJobsFilters<T extends AllJobsRow>(
  jobs: T[],
  opts: AllJobsFilterOpts
): T[] {
  let result = jobs;
  result = filterBySearch(result, opts.search);
  result = filterByTime(result, opts.timeFilter, opts.now);
  result = filterByCountryLocation(result, opts.countryLocation);
  result = filterByHasDescription(result, opts.hasDescription);
  result = filterByAppliedVisibility(
    result,
    opts.appliedVisibility ?? DEFAULT_APPLIED_VISIBILITY_FILTER
  );
  // When cross-checking a specific title, show all matches regardless of resume filter.
  const applyResumeFilter = opts.resumeModifiedFilter !== "all" && !opts.search.trim();
  if (applyResumeFilter) {
    result = filterByResumeModified(
      result,
      opts.resumeModifiedFilter,
      opts.atsMinScore
    );
  }
  return sortAllJobs(result, opts.sort ?? DEFAULT_ALL_JOBS_SORT);
}

export function uniqueCategories(jobs: AllJobsRow[]): string[] {
  const set = new Set<string>();
  for (const j of jobs) {
    const c = (j.category ?? "").trim();
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  if (!iso) return "—";
  const diff = now - new Date(iso).getTime();
  if (Number.isNaN(diff)) return iso;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

/** Absolute calendar date for ATS position open date (sheet column N). */
export function formatOpenDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
  } catch {
    return iso;
  }
}
