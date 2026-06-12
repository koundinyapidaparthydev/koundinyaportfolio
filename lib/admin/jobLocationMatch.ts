/**
 * Country/region matching for job location strings (sheet column C).
 *
 * Production pipeline is US-only. Legacy region helpers remain for tests.
 */

export type CountryLocationFilter = "all" | "us" | "in" | "dubai" | "sg";

/** Default location filter for the All Jobs tab (US-only pipeline). */
export const DEFAULT_COUNTRY_LOCATION: CountryLocationFilter = "us";

/** US-only filters shown in the admin Jobs tab. */
export const COUNTRY_LOCATION_FILTERS: {
  id: CountryLocationFilter;
  label: string;
}[] = [{ id: "us", label: "🇺🇸 US" }];

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

const DUBAI_PATTERNS: RegExp[] = [
  /\bdubai\b/i,
  /\buae\b/i,
  /\bunited\s+arab\s+emirates\b/i,
  /\bremote[\s\-_]*(?:dubai|uae)\b/i,
];

const SINGAPORE_PATTERNS: RegExp[] = [
  /\bsingapore\b/i,
  /,\s*sg\b/i,
  /\(\s*sg\s*\)/i,
  /\bremote[\s\-_]*singapore\b/i,
];

function matchesAnyPattern(location: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(location));
}

export function isUnitedStatesLocation(location: string): boolean {
  const trimmed = (location ?? "").trim();
  if (!trimmed) return false;
  return matchesAnyPattern(trimmed, US_PATTERNS);
}

/** HC scrape + admin default: US signal required, non-US regions rejected. */
export function isUsHcJob(location: string): boolean {
  const trimmed = (location ?? "").trim();
  if (!trimmed) return false;
  if (
    isIndiaLocation(trimmed) ||
    isDubaiLocation(trimmed) ||
    isSingaporeLocation(trimmed)
  ) {
    return false;
  }
  return isUnitedStatesLocation(trimmed);
}

export function isIndiaLocation(location: string): boolean {
  const trimmed = (location ?? "").trim();
  if (!trimmed) return false;
  return matchesAnyPattern(trimmed, INDIA_PATTERNS);
}

export function isDubaiLocation(location: string): boolean {
  const trimmed = (location ?? "").trim();
  if (!trimmed) return false;
  return matchesAnyPattern(trimmed, DUBAI_PATTERNS);
}

export function isSingaporeLocation(location: string): boolean {
  const trimmed = (location ?? "").trim();
  if (!trimmed) return false;
  return matchesAnyPattern(trimmed, SINGAPORE_PATTERNS);
}

/** True when location is a US HC job (pipeline default). */
export function isSupportedLocation(location: string): boolean {
  return isUsHcJob(location);
}

/** Match a job location against a country filter. Empty / unsupported → false. */
export function matchesLocation(
  location: string,
  filter: CountryLocationFilter
): boolean {
  if (filter === "all" || filter === "us") return isUsHcJob(location);
  const trimmed = (location ?? "").trim();
  if (!trimmed) return false;
  switch (filter) {
    case "in":
      return isIndiaLocation(trimmed);
    case "dubai":
      return isDubaiLocation(trimmed);
    case "sg":
      return isSingaporeLocation(trimmed);
    default:
      return false;
  }
}

export function filterByCountryLocation<T extends { location: string }>(
  jobs: T[],
  filter: CountryLocationFilter
): T[] {
  return jobs.filter((j) => matchesLocation(j.location, filter));
}
