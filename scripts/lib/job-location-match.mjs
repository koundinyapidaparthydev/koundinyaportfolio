/**
 * US location matching for HC scrape rows (mirrors lib/admin/jobLocationMatch.ts).
 */

const US_STATE_ABBRS =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";

const US_PATTERNS = [
  /\bunited\s+states\b/i,
  /\bu\.?\s*s\.?\b/i,
  /\busa\b/i,
  /\bus-only\b/i,
  /\bremote[\s\-_]*united\s*states\b/i,
  /\bremote[\s\-_]*us\b/i,
  /,\s*us\b/i,
  /\(\s*us\s*\)/i,
  /\bnorth\s+america[\s\-—]*(us|usa|u\.s\.)\b/i,
  /(?<![a-zA-Z])us(?![a-zA-Z])/i,
  new RegExp(String.raw`,\s*(?:${US_STATE_ABBRS})\b`, "i"),
  new RegExp(String.raw`\(\s*(?:${US_STATE_ABBRS})\s*\)`, "i"),
  /\b(?:new\s+york|san\s+francisco|los\s+angeles|seattle|austin|boston|chicago|denver|atlanta|dallas|portland|san\s+diego|san\s+jose|washington\s+d\.?c\.?)\b/i,
];

const NON_US_PATTERNS = [
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
  /\bdubai\b/i,
  /\buae\b/i,
  /\bunited\s+arab\s+emirates\b/i,
  /\bsingapore\b/i,
  /,\s*sg\b/i,
  /\(\s*sg\s*\)/i,
  /\bunited\s+kingdom\b/i,
  /\buk\b/i,
  /\beurope\b/i,
  /\basia\b/i,
  /\bcanada\b/i,
  /\bgermany\b/i,
  /\bfrance\b/i,
  /\baustralia\b/i,
  /\bportugal\b/i,
  /\bireland\b/i,
  /\bukraine\b/i,
  /\bswitzerland\b/i,
  /\blondon\b/i,
  /\blisbon\b/i,
  /\bdublin\b/i,
  /\bkyiv\b/i,
];

function matchesAny(location, patterns) {
  return patterns.some((re) => re.test(location));
}

export function isUnitedStatesLocation(location = "") {
  const trimmed = String(location).trim();
  if (!trimmed) return false;
  return matchesAny(trimmed, US_PATTERNS);
}

/**
 * Post-scrape US filter for Hiring Cafe rows.
 * Rejects India/Bangalore/multi-country listings unless the location is US-clear.
 */
export function isUsHcJob(location = "") {
  const trimmed = String(location).trim();
  if (!trimmed) return false;
  if (matchesAny(trimmed, NON_US_PATTERNS)) return false;

  if (isUnitedStatesLocation(trimmed)) return true;

  const parts = trimmed.split(/\s+or\s+/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    if (parts.some((part) => matchesAny(part, NON_US_PATTERNS))) return false;
    if (parts.some((part) => isUnitedStatesLocation(part))) return true;
    // US-only multi-city cards (e.g. "Raleigh or Morrisville") with no non-US markers.
    return true;
  }

  return false;
}
