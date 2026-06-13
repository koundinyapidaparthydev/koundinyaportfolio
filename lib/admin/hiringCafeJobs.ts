/** Same search filters as the GHA scrape pipeline (no HC `locations` in searchState). */
export const HC_DEPARTMENTS = ["Engineering", "Software Development"] as const;
export const HC_DATE_FETCHED_PAST_DAYS = 2;

export function buildHiringCafeSearchUrl(): string {
  const state = {
    dateFetchedPastNDays: HC_DATE_FETCHED_PAST_DAYS,
    departments: [...HC_DEPARTMENTS],
    sortBy: "date",
  };
  return `https://hiring.cafe/?searchState=${encodeURIComponent(JSON.stringify(state))}`;
}

/** Open on Hiring Cafe to cross-check scraped listings. */
export const HIRING_CAFE_SEARCH_URL = buildHiringCafeSearchUrl();

/** Default API response: Hiring Cafe rows only. */
export function isHiringCafeJob(job: { category: string; url: string }): boolean {
  if (job.category === "hiring-cafe") return true;
  return job.url.toLowerCase().includes("hiring.cafe");
}
