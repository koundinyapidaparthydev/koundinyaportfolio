/**
 * Filter/sort helpers for the All Jobs admin tab.
 */

import {
  filterByCountryLocation,
  type CountryLocationFilter,
} from "@/lib/admin/jobLocationMatch";

export {
  COUNTRY_LOCATION_FILTERS,
  matchesLocation,
  filterByCountryLocation,
  type CountryLocationFilter,
} from "@/lib/admin/jobLocationMatch";

export type TimeFilter = "30m" | "2h" | "6h" | "12h" | "1d" | "2d" | "all";

/** Apply-now window: Jobs tab holds discoveries from the last 6 hours. */
export const APPLY_NOW_WINDOW_MS = 6 * 60 * 60_000;

/** Default time filter for the Hiring Cafe jobs tab. */
export const DEFAULT_TIME_FILTER: TimeFilter = "2h";

export type SortColumn =
  | "company"
  | "title"
  | "location"
  | "postedAt"
  | "fetchedAt";
export type SortDirection = "asc" | "desc";

export interface AllJobsSort {
  column: SortColumn;
  direction: SortDirection;
}

export const DEFAULT_ALL_JOBS_SORT: AllJobsSort = {
  column: "postedAt",
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
}

export const NEW_JOB_WINDOW_MS = 30 * 60_000;

export const TIME_FILTERS: { id: TimeFilter; label: string; ms: number | null }[] = [
  { id: "30m", label: "⚡ Last 30 mins", ms: NEW_JOB_WINDOW_MS },
  { id: "2h", label: "Last 2 hrs", ms: 2 * 3_600_000 },
  { id: "6h", label: "✅ Apply now (6h)", ms: APPLY_NOW_WINDOW_MS },
  { id: "12h", label: "Last 12 hrs", ms: 12 * 3_600_000 },
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
    direction: column === "postedAt" || column === "fetchedAt" ? "desc" : "asc",
  };
}

export function sortAllJobs<T extends AllJobsRow>(
  jobs: T[],
  sort: AllJobsSort = DEFAULT_ALL_JOBS_SORT
): T[] {
  const arr = [...jobs];
  const dir = sort.direction === "asc" ? 1 : -1;

  return arr.sort((a, b) => {
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
