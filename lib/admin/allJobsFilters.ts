/**
 * Filter/sort helpers for the All Jobs admin tab.
 */

export type TimeFilter = "30m" | "2h" | "12h" | "1d" | "2d" | "all";
export type SortMode = "newest" | "company" | "title";
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
  fetchedAt: string;
  description: string;
}

export const NEW_JOB_WINDOW_MS = 30 * 60_000;

export const TIME_FILTERS: { id: TimeFilter; label: string; ms: number | null }[] = [
  { id: "30m", label: "⚡ Last 30 mins", ms: NEW_JOB_WINDOW_MS },
  { id: "2h", label: "Last 2 hrs", ms: 2 * 3_600_000 },
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

export const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "company", label: "Company A–Z" },
  { id: "title", label: "Title A–Z" },
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

export function filterByTime<T extends AllJobsRow>(
  jobs: T[],
  filter: TimeFilter,
  now = Date.now()
): T[] {
  if (filter === "all") return jobs;
  const { ms } = TIME_FILTERS.find((f) => f.id === filter)!;
  if (ms == null) return jobs;
  return jobs.filter(
    (j) => j.fetchedAt && now - new Date(j.fetchedAt).getTime() <= ms
  );
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

export function sortAllJobs<T extends AllJobsRow>(jobs: T[], mode: SortMode): T[] {
  const arr = [...jobs];
  switch (mode) {
    case "company":
      return arr.sort(
        (a, b) =>
          a.company.localeCompare(b.company) || a.title.localeCompare(b.title)
      );
    case "title":
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return arr.sort(
        (a, b) =>
          new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
      );
  }
}

export function applyAllJobsFilters<T extends AllJobsRow>(
  jobs: T[],
  opts: {
    search: string;
    category: string;
    timeFilter: TimeFilter;
    platform: PlatformFilter;
    hasDescription: boolean;
    sort: SortMode;
    now?: number;
  }
): T[] {
  let result = jobs;
  result = filterBySearch(result, opts.search);
  result = filterByCategory(result, opts.category);
  result = filterByTime(result, opts.timeFilter, opts.now);
  result = filterByPlatform(result, opts.platform);
  result = filterByHasDescription(result, opts.hasDescription);
  return sortAllJobs(result, opts.sort);
}

export function uniqueCategories(jobs: AllJobsRow[]): string[] {
  const set = new Set<string>();
  for (const j of jobs) {
    const c = (j.category ?? "").trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
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
