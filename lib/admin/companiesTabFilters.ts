/**
 * Filter/sort helpers for the Companies admin tab.
 */

import {
  NEW_JOB_WINDOW_MS,
  TIME_FILTERS,
  filterByTime as filterJobsByTime,
  type TimeFilter,
} from "@/lib/admin/allJobsFilters";

export { NEW_JOB_WINDOW_MS };

/** Time windows shared with All Jobs (excludes "all time" — Companies focuses on recent scrapes). */
export type CompaniesTimeFilter = Exclude<TimeFilter, "all">;

export const COMPANIES_TIME_FILTERS = TIME_FILTERS.filter(
  (f): f is { id: CompaniesTimeFilter; label: string; ms: number | null } =>
    f.id !== "all"
);

export type CompanyCategory = "travel" | "ai-agentic" | "general" | "hiring-cafe";

export type CompanySortMode = "name" | "jobCount" | "category";

export type RoleSortMode = "newest" | "ats" | "title";

export type LocationFilter = "all" | "remote" | "onsite";

export const CATEGORY_OPTIONS: { id: CompanyCategory; label: string }[] = [
  { id: "travel", label: "✈️ Travel" },
  { id: "ai-agentic", label: "🤖 AI & Agentic" },
  { id: "general", label: "🌐 General" },
  { id: "hiring-cafe", label: "☕ Hiring Cafe" },
];

export const CATEGORY_BADGE: Record<
  CompanyCategory,
  { label: string; className: string }
> = {
  travel: {
    label: "Travel",
    className:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/25",
  },
  "ai-agentic": {
    label: "AI",
    className:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
  },
  general: {
    label: "General",
    className:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25",
  },
  "hiring-cafe": {
    label: "Hiring Cafe",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
  },
};

export interface CompanyJobRow {
  company: string;
  title: string;
  location: string;
  url: string;
  category: string;
  fetchedAt: string;
  description: string;
}

export function filterJobsByCompaniesTime(
  jobs: CompanyJobRow[],
  filter: CompaniesTimeFilter,
  now = Date.now()
): CompanyJobRow[] {
  return filterJobsByTime(jobs, filter, now);
}

export function filterCompaniesBySearch<T extends { name: string }>(
  companies: T[],
  q: string
): T[] {
  if (!q.trim()) return companies;
  const lower = q.toLowerCase();
  return companies.filter((c) => c.name.toLowerCase().includes(lower));
}

export function filterCompaniesByCategories<T extends { category: CompanyCategory }>(
  companies: T[],
  selected: Set<CompanyCategory>
): T[] {
  if (selected.size === 0) return companies;
  return companies.filter((c) => selected.has(c.category));
}

export function sortCompanies<T extends { name: string; category: CompanyCategory }>(
  companies: T[],
  mode: CompanySortMode,
  jobCounts: Record<string, number>
): T[] {
  const arr = [...companies];
  switch (mode) {
    case "jobCount":
      return arr.sort(
        (a, b) =>
          (jobCounts[b.name] ?? 0) - (jobCounts[a.name] ?? 0) ||
          a.name.localeCompare(b.name)
      );
    case "category":
      return arr.sort(
        (a, b) =>
          a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
      );
    default:
      return arr.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export function filterRolesBySearch(jobs: CompanyJobRow[], q: string): CompanyJobRow[] {
  if (!q.trim()) return jobs;
  const lower = q.toLowerCase();
  return jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(lower) ||
      j.company.toLowerCase().includes(lower)
  );
}

export function filterRolesByLocation(
  jobs: CompanyJobRow[],
  filter: LocationFilter
): CompanyJobRow[] {
  if (filter === "all") return jobs;
  return jobs.filter((j) => {
    const combined = (j.location + " " + j.description).toLowerCase();
    if (filter === "remote") return combined.includes("remote");
    return !combined.includes("remote") && !combined.includes("hybrid");
  });
}

export function sortRoles(
  jobs: CompanyJobRow[],
  mode: RoleSortMode,
  scores: Map<string, number>
): CompanyJobRow[] {
  const arr = [...jobs];
  switch (mode) {
    case "ats":
      return arr.sort((a, b) => (scores.get(b.url) ?? 0) - (scores.get(a.url) ?? 0));
    case "title":
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return arr.sort(
        (a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
      );
  }
}

export function toggleCategoryFilter(
  current: Set<CompanyCategory>,
  category: CompanyCategory
): Set<CompanyCategory> {
  const next = new Set(current);
  if (next.has(category)) next.delete(category);
  else next.add(category);
  return next;
}

/** Row updates for refreshLastSeenAt — only URLs still on the board. */
export function buildLastSeenUpdates(
  sheetUrls: string[],
  scrapedUrls: Set<string>,
  timestamp: string
) {
  return sheetUrls
    .map((url, idx) => ({ url, sheetRow: idx + 2 }))
    .filter(({ url }) => url && scrapedUrls.has(url))
    .map(({ sheetRow }) => ({
      range: `Jobs!F${sheetRow}`,
      values: [[timestamp]],
    }));
}
