/**
 * Country/region matching for job location strings (sheet column C).
 *
 * Empty locations are excluded from US/India filters and only appear when filter is "all".
 */

export type CountryLocationFilter = "all" | "us" | "in";

export const COUNTRY_LOCATION_FILTERS: {
  id: CountryLocationFilter;
  label: string;
}[] = [
  { id: "all", label: "All locations" },
  { id: "us", label: "🇺🇸 US" },
  { id: "in", label: "🇮🇳 India" },
];

/** US state / territory abbreviations for ", CA" style locations. */
const US_STATE_ABBRS =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";

const US_PATTERNS: RegExp[] = [
  /\bunited\s+states\b/i,
  /\bu\.?\s*s\.?\b/i,
  /\busa\b/i,
  /\bus-only\b/i,
  /\bremote[\s\-_]*united\s*states\b/i,
  /\bremote[\s\-_]*us\b/i,
  /,\s*us\b/i,
  /\(\s*us\s*\)/i,
  /\bnorth\s+america[\s\-—]*(us|usa|u\.s\.)\b/i,
  // Standalone "US" — avoid false positives like "Bus" or "focus"
  /(?<![a-zA-Z])us(?![a-zA-Z])/i,
  new RegExp(String.raw`,\s*(?:${US_STATE_ABBRS})\b`, "i"),
  new RegExp(String.raw`\(\s*(?:${US_STATE_ABBRS})\s*\)`, "i"),
  /\b(?:new\s+york|san\s+francisco|los\s+angeles|seattle|austin|boston|chicago|denver|atlanta|dallas|portland|san\s+diego|san\s+jose|washington\s+d\.?c\.?)\b/i,
];

const INDIA_PATTERNS: RegExp[] = [
  /\bindia\b/i,
  /\bbangalore\b/i,
  /\bbengaluru\b/i,
  /\bhyderabad\b/i,
  /\bmumbai\b/i,
  /\bdelhi\b/i,
  /\bnoida\b/i,
  /\bgurgaon\b/i,
  /\bgurugram\b/i,
  /\bpune\b/i,
  /\bchennai\b/i,
  /\bremote[\s\-_]*india\b/i,
];

function matchesAnyPattern(location: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(location));
}

export function isUnitedStatesLocation(location: string): boolean {
  const trimmed = (location ?? "").trim();
  if (!trimmed) return false;
  return matchesAnyPattern(trimmed, US_PATTERNS);
}

export function isIndiaLocation(location: string): boolean {
  const trimmed = (location ?? "").trim();
  if (!trimmed) return false;
  return matchesAnyPattern(trimmed, INDIA_PATTERNS);
}

/** Match a job location against a country filter. Empty location → false for us/in. */
export function matchesLocation(
  location: string,
  filter: CountryLocationFilter
): boolean {
  if (filter === "all") return true;
  const trimmed = (location ?? "").trim();
  if (!trimmed) return false;
  return filter === "us" ? isUnitedStatesLocation(trimmed) : isIndiaLocation(trimmed);
}

export function filterByCountryLocation<T extends { location: string }>(
  jobs: T[],
  filter: CountryLocationFilter
): T[] {
  if (filter === "all") return jobs;
  return jobs.filter((j) => matchesLocation(j.location, filter));
}
