/**
 * Country/region matching for job location strings (sheet column C).
 *
 * Only US, India, Dubai, and Singapore are supported. Jobs outside these
 * regions are excluded even when the location filter is "all".
 */

export type CountryLocationFilter = "all" | "us" | "in" | "dubai" | "sg";

export const COUNTRY_LOCATION_FILTERS: {
  id: CountryLocationFilter;
  label: string;
}[] = [
  { id: "all", label: "All locations" },
  { id: "us", label: "🇺🇸 US" },
  { id: "in", label: "🇮🇳 India" },
  { id: "dubai", label: "🇦🇪 Dubai" },
  { id: "sg", label: "🇸🇬 Singapore" },
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

/** True when location matches any supported region (US, India, Dubai, Singapore). */
export function isSupportedLocation(location: string): boolean {
  return (
    isUnitedStatesLocation(location) ||
    isIndiaLocation(location) ||
    isDubaiLocation(location) ||
    isSingaporeLocation(location)
  );
}

/** Match a job location against a country filter. Empty / unsupported → false. */
export function matchesLocation(
  location: string,
  filter: CountryLocationFilter
): boolean {
  if (filter === "all") return isSupportedLocation(location);
  const trimmed = (location ?? "").trim();
  if (!trimmed) return false;
  switch (filter) {
    case "us":
      return isUnitedStatesLocation(trimmed);
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
