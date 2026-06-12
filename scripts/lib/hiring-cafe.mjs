/**
 * Hiring Cafe helpers — search state, row parsing, dedup, time-slot partitioning.
 * Pure functions (no Playwright) for tests and pipeline scripts.
 */

export const HC_DEPARTMENTS = ["Engineering", "Software Development"];

/** United States workplace filter — matches hiring.cafe `searchState.locations` shape. */
export const HC_US_LOCATION = {
  formatted_address: "United States",
  types: ["country"],
  geometry: {
    location: { lat: 34.0544, lon: -118.244 },
  },
  id: "user_country",
  address_components: [
    { long_name: "United States", short_name: "US", types: ["country"] },
  ],
  options: {
    flexible_regions: ["anywhere_in_continent", "anywhere_in_world"],
  },
};

/** US-only workplace filter for HC searchState.locations. */
export const HC_LOCATIONS = [HC_US_LOCATION];

/** Jobs posted on HC within this window (matches searchState.dateFetchedPastNDays). */
export const HC_DATE_FETCHED_PAST_DAYS = 2;

/** Apply-now window: Jobs tab keeps discoveries from the last 12 hours. */
export const APPLY_NOW_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Scrape search result pages 1–5 each pipeline run (HC `&page=` is 0-based). */
export const HC_MAX_PAGES = 5;

const HC_SHORT_JOB_ID_RE = /^[a-z0-9]{16}$/i;
const HC_JOB_URL_RE = /hiring\.cafe\/job\/([a-z0-9]{8,})/i;

export function buildHiringCafeSearchState(overrides = {}) {
  return {
    dateFetchedPastNDays: HC_DATE_FETCHED_PAST_DAYS,
    departments: HC_DEPARTMENTS,
    sortBy: "date",
    ...overrides,
  };
}

export function buildHiringCafeSearchUrl(overrides = {}) {
  const state = encodeURIComponent(JSON.stringify(buildHiringCafeSearchState(overrides)));
  return `https://hiring.cafe/?searchState=${state}`;
}

/**
 * HC paginates via `&page=` query param (0-based). Page 1 has no param; page 2 → &page=1.
 * @param {number} pageIndex 0-based page index (0 = first page)
 */
export function buildHiringCafePageUrl(pageIndex = 0, overrides = {}) {
  const base = buildHiringCafeSearchUrl(overrides);
  return pageIndex > 0 ? `${base}&page=${pageIndex}` : base;
}

/** Sheet column count (A–Q). */
export const HC_SHEET_COLUMN_COUNT = 17;

export const HC_SHEET_HEADERS = [
  "Company",
  "Title",
  "Location",
  "URL",
  "Category",
  "Fetched At",
  "Description",
  "Resume URL",
  "Cover Letter",
  "ATS Score",
  "Apply Status",
  "Applied At",
  "Notes",
  "Posted At",
  "ATS Match Summary",
  "Key Gaps",
  "Recommended Keywords",
];

/** 16-char slug used in hiring.cafe/job/{id} URLs (stored as requisition_id in SSR hits). */
export function getHcShortJobId(itemOrUrl) {
  if (typeof itemOrUrl === "string") {
    const m = itemOrUrl.match(HC_JOB_URL_RE);
    if (m?.[1] && HC_SHORT_JOB_ID_RE.test(m[1])) return m[1];
    return "";
  }
  const item = itemOrUrl ?? {};
  const req = String(item.requisition_id ?? "").trim();
  if (HC_SHORT_JOB_ID_RE.test(req)) return req;
  const fromUrl = getHcJobId(item);
  return HC_SHORT_JOB_ID_RE.test(fromUrl) ? fromUrl : "";
}

export function getHcJobPageUrl(itemOrShortId) {
  const id = typeof itemOrShortId === "string" ? itemOrShortId : getHcShortJobId(itemOrShortId);
  return id ? `https://hiring.cafe/job/${id}` : "";
}

export function stripHtml(html = "") {
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract plain-text job description from HC job detail payload. */
export function extractFullDescriptionFromJobPayload(jobPayload) {
  const job = jobPayload?.job ?? jobPayload ?? {};
  const info = job.job_information ?? {};
  const v5 = job.v5_processed_job_data ?? {};
  const v7 = job.v7_processed_job_data ?? {};

  const html =
    info.description ??
    info.job_description ??
    v5.job_description ??
    v5.full_job_description ??
    v7.job_description ??
    "";
  const plain = stripHtml(html);
  if (plain.length >= 120) return plain.slice(0, 12_000);

  const summary =
    v5.requirements_summary ??
    v7.experience_requirements?.requirements_summary ??
    info.requirements_summary ??
    "";
  return [plain, summary].filter(Boolean).join("\n\n").slice(0, 12_000);
}

function toIsoPosted(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

const RELATIVE_POSTED_RE =
  /\b(?:just\s*now|\d+\s*m(?:in(?:ute)?s?)?|\d+\s*h(?:r|our)?s?|\d+\s*d(?:ay)?s?)\b/i;

/**
 * Parse relative posted strings from HC UI ("48m", "1h", "2h", "3d", "Just now").
 * @param {string} text
 * @param {Date} [refNow]
 * @returns {string} ISO timestamp or ""
 */
function toRefDate(refNow = new Date()) {
  return refNow instanceof Date ? refNow : new Date(refNow);
}

export function parseRelativePostedTime(text, refNow = new Date()) {
  const raw = (text ?? "").trim();
  if (!raw) return "";

  const ref = toRefDate(refNow);
  const iso = toIsoPosted(raw);
  if (iso) return iso;

  const s = raw.toLowerCase();
  if (/^(just\s*now|now)$/.test(s)) return ref.toISOString();

  const compact = s.match(/^(\d+)\s*(m|h|d)(?:in(?:ute)?s?|r|our|ay)?s?$/i);
  if (compact) {
    const n = Number(compact[1]);
    const unit = compact[2].toLowerCase();
    const ms =
      unit === "m" ? n * 60_000 : unit === "h" ? n * 3_600_000 : n * 86_400_000;
    return new Date(ref.getTime() - ms).toISOString();
  }

  const ago = s.match(/^(\d+)\s*(m|h|d)(?:in(?:ute)?s?|r|our|ay)?s?\s*ago$/i);
  if (ago) {
    const n = Number(ago[1]);
    const unit = ago[2].toLowerCase();
    const ms =
      unit === "m" ? n * 60_000 : unit === "h" ? n * 3_600_000 : n * 86_400_000;
    return new Date(ref.getTime() - ms).toISOString();
  }

  return "";
}

/** Extract relative posted time from card / snippet text → ISO. */
export function extractRelativePostedFromText(text, refNow = new Date()) {
  const match = (text ?? "").match(RELATIVE_POSTED_RE);
  const token = match?.[0]?.trim() ?? "";
  return token ? parseRelativePostedTime(token, refNow) : "";
}

export function resolvePostedAt(value, refNow = new Date()) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const rel = parseRelativePostedTime(value, refNow);
    if (rel) return rel;
    if (RELATIVE_POSTED_RE.test(value)) {
      return extractRelativePostedFromText(value, refNow);
    }
  }
  return toIsoPosted(value);
}

/** Extract HC objectID / listing id from a raw API item or apply URL. */
export function getHcJobId(itemOrUrl) {
  if (typeof itemOrUrl === "string") {
    const m = itemOrUrl.match(HC_JOB_URL_RE);
    return m?.[1] ?? "";
  }
  const item = itemOrUrl ?? {};
  return String(
    item.objectID ?? item.id ?? item.jobId ?? item._id ?? item.listingId ?? ""
  ).trim();
}

/** Prefer real ATS apply URL over hiring.cafe/job/{id}. */
export function getHcApplyUrl(item) {
  const id = getHcJobId(item);
  const direct =
    item.hc_apply_url ??
    item.apply_url ??
    item.jobUrl ??
    item.applyUrl ??
    item.application_url ??
    "";
  if (direct && !/hiring\.cafe\/job\//i.test(direct)) return direct;
  if (direct) return direct;
  if (/^[a-z0-9]{8,}$/i.test(id)) return `https://hiring.cafe/job/${id}`;
  return "";
}

/**
 * Normalise a Hiring Cafe API / SSR item → scrape row:
 * [company, title, location, url, category, fetchedAt, postedAt, description]
 */
export function parseHcItemToRow(item, fetchedAt = new Date().toISOString()) {
  const v5 = item.v5_processed_job_data ?? {};
  const v7 = item.v7_processed_job_data ?? {};
  const info = item.job_information ?? {};

  const title =
    item.hc_title ??
    item.job_title ??
    info.title ??
    info.job_title_raw ??
    item.jobTitle ??
    item.title ??
    item.name ??
    "";
  const company =
    v5.company_name ??
    item.enriched_company_data?.name ??
    v7.company_profile?.name ??
    item.companyName ??
    item.company ??
    item.employer ??
    "Hiring Cafe";
  const location =
    v5.formatted_workplace_location ??
    (Array.isArray(v5.workplace_cities) ? v5.workplace_cities.join(", ") : "") ??
    item.location ??
    item.city ??
    item.locationName ??
    "";

  let salary = item.salary ?? item.compensation ?? "";
  if (!salary && v5.yearly_min_compensation != null) {
    const lo = Math.round(v5.yearly_min_compensation / 1000);
    const hi = Math.round((v5.yearly_max_compensation ?? v5.yearly_min_compensation) / 1000);
    salary = `$${lo}k-$${hi}k/yr`;
  } else if (!salary && v7.compensation_and_benefits?.salary) {
    const s = v7.compensation_and_benefits.salary;
    salary = `$${Math.round(s.low / 1000)}k-$${Math.round(s.high / 1000)}k/yr`;
  }

  const skills = Array.isArray(item.skills)
    ? item.skills.join(", ")
    : Array.isArray(v5.technical_tools)
      ? v5.technical_tools.join(", ")
      : (item.skills ?? "");

  const url = getHcApplyUrl(item);
  if (!title || !url) return null;

  const fullFromItem = extractFullDescriptionFromJobPayload(item);
  const summary =
    fullFromItem ||
    v5.requirements_summary ||
    v7.experience_requirements?.requirements_summary ||
    item.description ||
    item.summary ||
    stripHtml(info.description ?? "") ||
    "";
  const salaryLine = salary ? `Salary: ${salary}` : "";
  const skillsLine = skills ? `Skills: ${skills}` : "";
  const description = [salaryLine, skillsLine, summary].filter(Boolean).join("\n").slice(0, 12_000);

  const postedAt = resolvePostedAt(
    item.posted_at ??
      item.postedAt ??
      item.date_posted ??
      item.datePosted ??
      item.listed_at ??
      item.listedAt ??
      item.published_at ??
      item.publishedAt ??
      item.updated_at ??
      item.updatedAt ??
      item.created_at ??
      item.createdAt ??
      item.relative_posted ??
      item.timeAgo ??
      v5.date_posted ??
      v5.posted_at ??
      v5.listed_at ??
      v7.date_posted ??
      v7.posted_at ??
      "",
    new Date(fetchedAt)
  );

  return [
    company,
    title,
    location,
    url,
    "hiring-cafe",
    fetchedAt,
    postedAt,
    description,
  ];
}

/** Dedup key: apply URL, else HC job id from URL. */
export function getJobDedupKey(row) {
  const url = row?.[3] ?? "";
  if (!url) return "";
  const id = getHcJobId(url);
  if (id) return `hc:${id}`;
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

function roleDedupKey(row) {
  const company = (row?.[0] ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const title = (row?.[1] ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!company || !title) return "";
  return `role:${company}|${title}`;
}

/** Deduplicate scrape rows by HC job id / URL and company+title (first wins). */
export function dedupeHcRows(rows) {
  const seenKeys = new Set();
  const seenRoles = new Set();
  const out = [];
  for (const row of rows) {
    const key = getJobDedupKey(row);
    const role = roleDedupKey(row);
    if (!key) continue;
    if (seenKeys.has(key) || (role && seenRoles.has(role))) continue;
    seenKeys.add(key);
    if (role) seenRoles.add(role);
    out.push(row);
  }
  return out;
}

/**
 * Split sheet rows (14-col or 8-col scrape rows) by fetchedAt age.
 * @returns {{ keep: unknown[]; archive: unknown[] }}
 */
export function partitionRowsByFetchedAt(rows, maxAgeMs, now = Date.now()) {
  const keep = [];
  const archive = [];
  for (const row of rows) {
    const fetchedAt = row[5] ?? "";
    const age = fetchedAt ? now - new Date(fetchedAt).getTime() : Infinity;
    if (age > maxAgeMs) archive.push(row);
    else keep.push(row);
  }
  return { keep, archive };
}

/** Collect unique items from API payloads, __NEXT_DATA__, etc. */
export function extractHcItemsFromPayload(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const candidates = [
    data.hits,
    data.jobs,
    data.results,
    data.postings,
    data.ssrHits,
    data.listings,
  ];
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length > 0) return arr;
  }
  const pageProps = data?.props?.pageProps ?? data?.pageProps ?? {};
  for (const key of ["ssrHits", "jobs", "listings", "postings", "results", "hits"]) {
    if (Array.isArray(pageProps[key]) && pageProps[key].length > 0) {
      return pageProps[key];
    }
  }
  return [];
}
