#!/usr/bin/env node
/**
 * Job scraper — fetches engineering roles from each company and writes to Google Sheets.
 *
 * Required env vars:
 *   GOOGLE_SHEET_ID              — ID of the target Google Sheet
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — full service-account JSON as a string
 *
 * Supported ATS adapters:
 *   - Greenhouse public API (StubHub, AXS, Lyft, Airbnb, CLEAR, SeatGeek, Uber Freight)
 *   - Workday public REST API (Live Nation, Sabre, NCL, SeaWorld)
 *   - iCIMS RSS feed (Disney — descriptions fetched inline, no auth required)
 *   - Custom fetch adapter (Booking.com)
 *
 * Not scrapeable:
 *   - Universal Studios — Cloudflare-blocked
 *   - Royal Caribbean Group — SAP SuccessFactors (no public API)
 *   - Flywire — no active ATS board found
 */

import { google } from "googleapis";

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.error(
    "❌  Missing env vars: GOOGLE_SHEET_ID and/or GOOGLE_SERVICE_ACCOUNT_JSON"
  );
  process.exit(1);
}

const SHEET_NAME = "Jobs";
const HEADERS = ["Company", "Title", "Location", "URL", "Category", "Fetched At", "Description"];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isEngineeringRole(title = "") {
  const t = title.toLowerCase();
  return [
    "engineer",
    "software",
    "developer",
    "full stack",
    "fullstack",
    "frontend",
    "front-end",
    "backend",
    "back-end",
    "devops",
    "sre",
    "platform",
    "architect",
    "mobile",
    "ios",
    "android",
  ].some((k) => t.includes(k));
}

function now() {
  return new Date().toISOString();
}

/** Pause between company fetches to avoid hammering servers */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * fetch() with an AbortController timeout so a hanging server
 * never blocks the entire scraper run.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeoutMs  — default 12 s
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

/**
 * fetchWithTimeout with up to `maxRetries` retries on network errors or
 * 429 / 5xx responses. Waits 1 s × attempt before retrying.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} maxRetries
 * @param {number} timeoutMs
 */
async function fetchWithRetry(url, options = {}, maxRetries = 2, timeoutMs = 12000) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      // Retry on rate-limit or transient server errors
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        await delay(1000 * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) await delay(1000 * (attempt + 1));
    }
  }
  throw lastErr;
}

/**
 * Strip HTML tags and decode entities to plain text.
 * Greenhouse returns entity-encoded HTML (&lt;p&gt; etc.),
 * so we must decode entities FIRST, then strip tags.
 */
function stripHtml(html = "") {
  // Step 1: decode HTML entities first (Greenhouse double-encodes their HTML)
  let txt = html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

  // Step 2: convert structural tags to whitespace/bullets, then strip all tags
  txt = txt
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\u2022 ")
    .replace(/<h[1-6][^>]*>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]*>/g, "");

  return txt.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Run async tasks with bounded concurrency.
 * @param {any[]} items
 * @param {number} limit  max concurrent tasks
 * @param {(item: any, i: number) => Promise<any>} fn
 */
async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let qi = 0;
  async function worker() {
    while (qi < items.length) {
      const i = qi++; // synchronous — safe before await
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Description-fetching config
// ─────────────────────────────────────────────────────────────────────────────

const GREENHOUSE_SLUGS = {
  "StubHub":           "stubhubinc",
  "AXS":               "axs",
  "Lyft":              "lyft",
  "Airbnb":            "airbnb",
  "CLEAR":             "clear",
  "SeatGeek (Remote)": "seatgeek",  // both SeatGeek variants share the same board
  "SeatGeek (NY)":     "seatgeek",
  "Uber Freight":      "uberfreight",
};

const WORKDAY_CONFIG = {
  "Live Nation": { host: "livenation.wd503.myworkdayjobs.com", tenant: "livenation", site: "LNExternalSite" },
  "Sabre":       { host: "sabre.wd1.myworkdayjobs.com",       tenant: "sabre",       site: "SabreJobs" },
  "NCL":         { host: "nclh.wd108.myworkdayjobs.com",       tenant: "nclh",        site: "NCL_Shoreside_Careers" },
  "SeaWorld":    { host: "seaworldentertainment.wd1.myworkdayjobs.com", tenant: "seaworldentertainment", site: "SEA" },
};

/**
 * Fetch a plain-text job description for one row.
 * Returns an empty string if the ATS is not supported or the call fails.
 * @param {string[]} row — [company, title, location, url, category, fetchedAt]
 * @returns {Promise<string>}
 */
async function fetchDescription(row) {
  const [company, , , url] = row;

  // ── Greenhouse ──────────────────────────────────────────────────────────
  const ghSlug = GREENHOUSE_SLUGS[company];
  if (ghSlug) {
    const jobId = url.match(/\/jobs\/(\d+)/)?.[1];
    if (jobId) {
      try {
        const res = await fetchWithRetry(
          `https://boards-api.greenhouse.io/v1/boards/${ghSlug}/jobs/${jobId}`,
          { headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" } }
        );
        if (res.ok) {
          const { content = "" } = await res.json();
          return stripHtml(content).slice(0, 2500);
        }
      } catch { /* fall through */ }
    }
    return "";
  }

  // ── Workday ─────────────────────────────────────────────────────────────
  const wdConfig = WORKDAY_CONFIG[company];
  if (wdConfig) {
    const { host, tenant, site } = wdConfig;
    // Stored URL is https://{host}{externalPath}, e.g. /job/Location/Title_JOBID
    const path = url.startsWith(`https://${host}`) ? url.slice(`https://${host}`.length) : null;
    if (path) {
      try {
        const res = await fetchWithRetry(
          `https://${host}/wday/cxs/${tenant}/${site}/jobs${path}`,
          { headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" } }
        );
        if (res.ok) {
          const data = await res.json();
          const desc =
            data.jobPostingInfo?.jobDescription ??
            data.jobDescription ??
            (Array.isArray(data.bulletFields) ? data.bulletFields.join("\n") : "");
          return stripHtml(desc ?? "").slice(0, 2500);
        }
      } catch { /* fall through */ }
    }
    return "";
  }

  // Booking.com & others — no reliable public description API
  return "";
}

/**
 * Enrich a list of job rows with descriptions (5 concurrent fetches).
 * Rows that already carry an inline description (col 6 populated, e.g. Disney
 * RSS) are kept as-is; only rows without one hit the description API.
 * @param {string[][]} jobs
 * @returns {Promise<string[][]>}
 */
async function enrichWithDescriptions(jobs) {
  const alreadyHaveDesc = jobs.filter((row) => row[6]?.length > 0);
  const needsFetch = jobs.filter((row) => !row[6]?.length);

  if (needsFetch.length === 0) {
    console.log(`\n📝  All ${jobs.length} new jobs already have inline descriptions`);
    return alreadyHaveDesc;
  }

  console.log(`\n📝  Fetching descriptions for ${needsFetch.length} new jobs (5 concurrent)...`);
  const enriched = await mapConcurrent(needsFetch, 5, async (row) => {
    const desc = await fetchDescription(row);
    return [...row, desc];
  });
  const withDesc = enriched.filter((r) => r[6]?.length > 0).length;
  console.log(`  ✓  Descriptions retrieved: ${withDesc}/${needsFetch.length}\n`);
  return [...alreadyHaveDesc, ...enriched];
}

// ─────────────────────────────────────────────────────────────────────────────
// ATS Adapters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Greenhouse public jobs API.
 * @param {string} boardSlug
 * @param {string} company  — used as the company name unless locationMapper is provided
 * @param {string} category
 * @param {((location: string) => string | null) | null} locationMapper
 *   — optional: maps job.location.name to a company name (return null to skip the job)
 * @see https://developers.greenhouse.io/job-board.html
 */
async function fetchGreenhouse(boardSlug, company, category, locationMapper = null) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardSlug}/jobs`;
  try {
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" },
    });
    if (!res.ok) {
      console.warn(`  ⚠  Greenhouse ${boardSlug}: HTTP ${res.status}`);
      return [];
    }
    const { jobs = [] } = await res.json();
    const filtered = jobs.filter((j) => isEngineeringRole(j.title));

    if (locationMapper) {
      const rows = [];
      for (const j of filtered) {
        const mappedCompany = locationMapper(j.location?.name ?? "");
        if (!mappedCompany) continue; // skip unmatched locations
        rows.push([mappedCompany, j.title, j.location?.name ?? "", j.absolute_url ?? "", category, now()]);
      }
      const groups = [...new Set(rows.map((r) => r[0]))];
      groups.forEach((co) => console.log(`  ✓  ${co}: ${rows.filter((r) => r[0] === co).length} engineering roles (Greenhouse)`));
      return rows;
    }

    console.log(`  ✓  ${company}: ${filtered.length} engineering roles (Greenhouse)`);
    return filtered.map((j) => [
      company,
      j.title,
      j.location?.name ?? "",
      j.absolute_url ?? "",
      category,
      now(),
    ]);
  } catch (e) {
    console.warn(`  ⚠  Greenhouse ${boardSlug}:`, e.message);
    return [];
  }
}

/**
 * Disney — iCIMS public RSS feed.
 * The feed at jobs.disneycareers.com/rss/jobs returns all global openings with
 * full HTML job descriptions embedded in <description>. No auth required.
 * Filters to US-based software/tech engineering roles only.
 */
async function fetchDisney() {
  const DISNEY_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
  const softwarePat =
    /software engineer|software developer|frontend|front-end|backend|back-end|full.?stack|platform engineer|devops|site reliability|sre|data engineer|ml engineer|machine learning engineer|cloud engineer|infrastructure engineer|mobile engineer|ios engineer|android engineer|staff engineer|principal engineer|api engineer|tech lead/i;

  try {
    const res = await fetchWithTimeout(
      "https://jobs.disneycareers.com/rss/jobs",
      { headers: { "User-Agent": DISNEY_UA } }
    );
    if (!res.ok) {
      console.warn(`  ⚠  Disney RSS: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();

    /** Extract CDATA or plain content from an XML tag */
    function extractTag(str, tag) {
      const m = str.match(
        new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`)
      );
      return m ? (m[1] ?? m[2] ?? "").trim() : "";
    }

    const rows = [];
    for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const rawTitle = extractTag(item, "title");
      // iCIMS encodes location as " - (City, State, Country)" suffix in the title
      if (!rawTitle.includes("United States")) continue; // US roles only
      if (!softwarePat.test(rawTitle)) continue;         // software/tech roles only

      const title    = rawTitle.replace(/ - \([^)]+\)$/, "").trim();
      const location = rawTitle.match(/\(([^)]+)\)$/)?.[1] ?? "";
      const url      = item.match(/<link>([^\s<]+)/)?.[1]
                    ?? item.match(/<guid[^>]*>([^<]+)/)?.[1]
                    ?? "";
      if (!url) continue;

      const descHtml  = extractTag(item, "description");
      const description = stripHtml(descHtml).slice(0, 2500);

      rows.push(["Disney", title, location, url, "travel", now(), description]);
    }

    console.log(`  ✓  Disney: ${rows.length} US software engineering roles (iCIMS RSS)`);
    return rows;
  } catch (e) {
    console.warn("  ⚠  Disney:", e.message);
    return [];
  }
}

/**
 * Workday's unofficial public REST API (used by their own frontend)
 * Pattern: POST https://{host}/wday/cxs/{tenant}/{site}/jobs
 */
async function fetchWorkday(host, tenant, site, company, category, searchText = "engineer") {
  const url = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
  try {
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "JobScraper/1.0 (portfolio automation)",
      },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText,
      }),
    });
    if (!res.ok) {
      console.warn(`  ⚠  Workday ${host}: HTTP ${res.status}`);
      return [];
    }
    const { jobPostings = [] } = await res.json();
    const filtered = jobPostings.filter((j) => isEngineeringRole(j.title));
    console.log(`  ✓  ${company}: ${filtered.length} engineering roles (Workday)`);
    return filtered.map((j) => [
      company,
      j.title,
      j.locationsText ?? "",
      j.externalPath ? `https://${host}${j.externalPath}` : `https://${host}/en-US/${site}`,
      category,
      now(),
    ]);
  } catch (e) {
    console.warn(`  ⚠  Workday ${host}:`, e.message);
    return [];
  }
}

/**
 * Lever public posting API
 * @see https://hire.lever.co/developer/postings
 */
async function fetchLever(companySlug, company, category) {
  const url = `https://api.lever.co/v0/postings/${companySlug}?mode=json`;
  try {
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" },
    });
    if (!res.ok) {
      console.warn(`  ⚠  Lever ${companySlug}: HTTP ${res.status}`);
      return [];
    }
    const jobs = await res.json();
    const list = Array.isArray(jobs) ? jobs : [];
    const filtered = list.filter((j) => isEngineeringRole(j.text));
    console.log(`  ✓  ${company}: ${filtered.length} engineering roles (Lever)`);
    return filtered.map((j) => [
      company,
      j.text ?? "",
      j.categories?.location ?? "",
      j.hostedUrl ?? "",
      category,
      now(),
    ]);
  } catch (e) {
    console.warn(`  ⚠  Lever ${companySlug}:`, e.message);
    return [];
  }
}

/**
 * SmartRecruiters public API (Royal Caribbean)
 */
async function fetchSmartRecruiters(companyId, company, category) {
  const url = `https://api.smartrecruiters.com/v1/companies/${companyId}/postings?department=IT`;
  try {
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" },
    });
    if (!res.ok) {
      console.warn(`  ⚠  SmartRecruiters ${companyId}: HTTP ${res.status}`);
      return [];
    }
    const { content = [] } = await res.json();
    const filtered = content.filter((j) => isEngineeringRole(j.name));
    console.log(`  ✓  ${company}: ${filtered.length} engineering roles (SmartRecruiters)`);
    return filtered.map((j) => [
      company,
      j.name ?? "",
      j.location?.city ? `${j.location.city}, ${j.location.country}` : "",
      `https://jobs.smartrecruiters.com/${companyId}/${j.id}`,
      category,
      now(),
    ]);
  } catch (e) {
    console.warn(`  ⚠  SmartRecruiters ${companyId}:`, e.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Company definitions
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAllJobs() {
  console.log("🔍  Fetching jobs from all companies...\n");

  const tasks = [
    // ── Greenhouse ──────────────────────────────────────────────────
    fetchGreenhouse("stubhubinc", "StubHub", "travel"),
    fetchGreenhouse("axs", "AXS", "travel"),
    fetchGreenhouse("lyft", "Lyft", "travel"),
    fetchGreenhouse("airbnb", "Airbnb", "travel"),
    fetchGreenhouse("clear", "CLEAR", "travel"),

    // ── Workday ─────────────────────────────────────────────────────
    fetchWorkday(
      "livenation.wd503.myworkdayjobs.com",
      "livenation",
      "LNExternalSite",
      "Live Nation",
      "travel"
    ),
    fetchWorkday(
      "sabre.wd1.myworkdayjobs.com",
      "sabre",
      "SabreJobs",
      "Sabre",
      "travel"
    ),
    fetchWorkday(
      "nclh.wd108.myworkdayjobs.com",
      "nclh",
      "NCL_Shoreside_Careers",
      "NCL",
      "travel"
    ),
    fetchWorkday(
      "seaworldentertainment.wd1.myworkdayjobs.com",
      "seaworldentertainment",
      "SEA",
      "SeaWorld",
      "travel"
    ),

    // ── Greenhouse (SeatGeek — split by location into Remote and NY cards) ──
    fetchGreenhouse("seatgeek", "SeatGeek", "travel", (loc) => {
      if (/Remote.*United States/i.test(loc)) return "SeatGeek (Remote)";
      if (/New York/i.test(loc)) return "SeatGeek (NY)";
      return null; // skip UK / other international locations
    }),

    // ── Booking.com — uses a public REST API (data nested under j.data) ──
    (async () => {
      try {
        const res = await fetchWithTimeout(
          "https://jobs.booking.com/api/jobs?q=engineer&page=1&limit=50",
          { headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        const jobs = data.jobs ?? data.results ?? [];
        const filtered = jobs.filter((j) =>
          isEngineeringRole(j?.data?.title ?? j.title ?? j.name ?? "")
        );
        console.log(`  ✓  Booking.com: ${filtered.length} engineering roles`);
        return filtered.map((j) => {
          const d = j?.data ?? j;
          return [
            "Booking.com",
            d.title ?? d.name ?? "",
            d.full_location ?? d.location ?? d.city ?? "",
            d.apply_url ?? d.url ?? `https://jobs.booking.com/booking/jobs/${d.slug ?? d.req_id}`,
            "travel",
            now(),
          ];
        });
      } catch (e) {
        console.warn("  ⚠  Booking.com:", e.message);
        return [];
      }
    })(),

    // ── Disney — iCIMS public RSS feed (descriptions included inline) ──────
    fetchDisney(),

    // ── Universal Studios (NBCUniversal) — Cloudflare-blocked ───────────────
    // careers.nbcuniversal.com returns Cloudflare 403; no public ATS accessible.

    // ── Uber Freight — Greenhouse (api.uber.com is blocked) ──────────
    fetchGreenhouse("uberfreight", "Uber Freight", "travel"),
  ];

  const results = await Promise.allSettled(tasks);
  const allJobs = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  console.log(`\n📋  Total: ${allJobs.length} engineering roles fetched\n`);
  return allJobs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Sheets
// ─────────────────────────────────────────────────────────────────────────────

async function getSheets() {
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function ensureSheetAndHeaders(sheets) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: GOOGLE_SHEET_ID,
  });
  const existing = meta.data.sheets.map((s) => s.properties.title);

  if (!existing.includes(SHEET_NAME)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
      },
    });
    console.log(`📄  Created sheet "${SHEET_NAME}"`);
  }

  // Always sync headers (adds Description column if missing)
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A1:G1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS] },
  });
}

async function writeNewJobs(sheets, newJobs) {
  // Fetch existing URLs to deduplicate
  const existingResp = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!D2:D`, // URL column, skip header
  });
  const existingUrls = new Set(
    (existingResp.data.values ?? []).flat().filter(Boolean)
  );

  const deduped = newJobs.filter((row) => row[3] && !existingUrls.has(row[3]));

  if (deduped.length === 0) {
    console.log("✅  No new jobs to add (all already in sheet)");
    return;
  }

  // Fetch descriptions only for the genuinely new jobs
  const enriched = await enrichWithDescriptions(deduped);

  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A:G`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: enriched },
  });

  console.log(`✅  Added ${enriched.length} new jobs to Google Sheets`);
}

// Companies whose description APIs are inaccessible — skip during backfill to save time
const NO_DESCRIPTION_COMPANIES = new Set(["Live Nation", "Sabre", "NCL", "SeaWorld", "Booking.com",
  "Flywire", "Royal Caribbean Group", "Disney", "Universal Studios"]);

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const [jobs, sheets] = await Promise.all([fetchAllJobs(), getSheets()]);
  await ensureSheetAndHeaders(sheets);
  await migrateLegacyCompanyNames(sheets);
  await writeNewJobs(sheets, jobs);
  await backfillDescriptions(sheets);
}

/**
 * One-time migration: rename legacy company name strings in the sheet to match
 * the updated card names in the UI.
 *
 * "SeatGeek" rows get split by location:
 *   "Remote - United States"  → "SeatGeek (Remote)"
 *   "New York, New York"      → "SeatGeek (NY)"
 *   other locations           → deleted (UK/international, not tracked)
 *
 * Safe to run on every scraper cycle — exits immediately once no legacy rows remain.
 */
async function migrateLegacyCompanyNames(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A2:G`,
  });
  const rows = res.data.values ?? [];

  /** @type {{ sheetRow: number; newName: string | null }[]} */
  const updates = [];
  /** Row numbers (1-indexed) to delete (international SeatGeek rows) */
  const rowsToDelete = [];

  rows.forEach((row, idx) => {
    const sheetRow = idx + 2; // 1-indexed; row 1 is the header
    if (row[0] === "SeatGeek") {
      const loc = row[2] ?? "";
      if (/Remote.*United States/i.test(loc)) {
        updates.push({ sheetRow, newName: "SeatGeek (Remote)" });
      } else if (/New York/i.test(loc)) {
        updates.push({ sheetRow, newName: "SeatGeek (NY)" });
      } else {
        rowsToDelete.push(sheetRow);
      }
    }
  });

  if (updates.length === 0 && rowsToDelete.length === 0) return; // nothing to do

  if (updates.length > 0) {
    // Use values.batchUpdate (range-based) so we don't need the numeric sheetId
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: updates.map(({ sheetRow, newName }) => ({
          range: `${SHEET_NAME}!A${sheetRow}`,
          values: [[newName]],
        })),
      },
    });
    console.log(`🔄  Migrated ${updates.length} legacy "SeatGeek" rows to split company names`);
  }

  // Delete international rows — look up the actual sheetId first
  if (rowsToDelete.length > 0) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID });
    const jobsSheet = meta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME);
    const jobsSheetId = jobsSheet?.properties?.sheetId ?? 0;
    const deleteRequests = rowsToDelete
      .slice()
      .sort((a, b) => b - a) // reverse order keeps row indices stable
      .map((r) => ({
        deleteDimension: {
          range: { sheetId: jobsSheetId, dimension: "ROWS", startIndex: r - 1, endIndex: r },
        },
      }));
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: { requests: deleteRequests },
    });
    console.log(`🗑   Removed ${rowsToDelete.length} international SeatGeek rows (not tracked)`);
  }
}


/**
 * Fill in descriptions for existing rows that are missing one (column G empty).
 * Does NOT touch fetchedAt or any other column — time filters remain accurate.
 */
async function backfillDescriptions(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A2:G`,
  });
  const rows = res.data.values ?? [];

  const needsDesc = rows
    .map((row, idx) => ({ row, sheetRow: idx + 2 })) // +2: header is row 1, data is 1-indexed
    .filter(({ row }) => (!row[6] || row[6].trim() === "") && !NO_DESCRIPTION_COMPANIES.has(row[0]));

  if (needsDesc.length === 0) {
    console.log("📝  All existing rows already have descriptions");
    return;
  }

  console.log(`\n📝  Backfilling descriptions for ${needsDesc.length} existing rows (5 concurrent)...`);

  const enriched = await mapConcurrent(needsDesc, 5, async ({ row, sheetRow }) => {
    const desc = await fetchDescription(row);
    return { desc, sheetRow };
  });

  const updateData = enriched
    .filter(({ desc }) => desc?.length > 0)
    .map(({ desc, sheetRow }) => ({
      range: `${SHEET_NAME}!G${sheetRow}`,
      values: [[desc]],
    }));

  if (updateData.length === 0) {
    console.log("  ℹ️  No new descriptions to write (remaining rows have empty content in the ATS)");
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: GOOGLE_SHEET_ID,
    requestBody: { valueInputOption: "RAW", data: updateData },
  });

  console.log(`✅  Backfilled descriptions for ${updateData.length} rows`);
}

main().catch((err) => {
  console.error("💥  Scraper crashed:", err);
  process.exit(1);
});
