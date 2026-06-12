#!/usr/bin/env node
/**
 * Job scraper — fetches engineering roles from configured companies → Google Sheets.
 *
 * Required env:
 *   GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON
 *
 * Optional env:
 *   DRY_RUN=true              — fetch + log summary; no sheet writes or WhatsApp
 *   COMPANY=<name>            — scrape one company only (implies SCRAPE_ONLY)
 *   SCRAPE_ONLY=true          — fetch only; skip Google Sheets writes
 *   ENGINEERING_FILTER=off    — include all titles (skip keyword filter)
 *   ENGINEERING_KEYWORDS      — comma-separated override for title keywords
 *   WHATSAPP_*                — new-job notifications (see sendWhatsAppNotification)
 *   ENRICH_PLAYWRIGHT=true    — after scrape, run scripts/enrich-descriptions.mjs
 *
 * Active ATS adapters:
 *   Greenhouse, Workday, Lever, Ashby, SmartRecruiters, iCIMS (Disney), Booking.com,
 *   Hiring.cafe (Playwright), Amazon/Google/Meta/Apple custom APIs
 *
 * Implemented but not wired (add slug in fetchAllJobs when board is known):
 *   Workable  — fetchWorkable(slug) → apply.workable.com API
 *   BreezyHR  — fetchBreezyHR(slug) → {slug}.breezy.hr/json
 *   Recruitee — fetchRecruitee(slug) → {slug}.recruitee.com/api/offers/
 *
 * Not scrapeable: Universal Studios (Cloudflare), Flywire (no public board)
 */

import { pathToFileURL } from "url";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";
import { wrapSheetsClient } from "./lib/sheets-rate-limit.mjs";
import { APPLY_NOW_WINDOW_MS } from "./lib/hiring-cafe.mjs";
import { scrapeAllHiringCafeJobs } from "./lib/hiring-cafe-scraper.mjs";
import { google } from "googleapis";

loadEnvLocal();

try {
  validatePipelineEnv("scrape");
} catch (err) {
  console.error(`❌  ${err.message}`);
  process.exit(1);
}

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const DRY_RUN = process.env.DRY_RUN === "true";
const ENGINEERING_FILTER_OFF = process.env.ENGINEERING_FILTER === "off";
const ENRICH_PLAYWRIGHT = process.env.ENRICH_PLAYWRIGHT === "true";

/** Read at call time — run-company-pipeline reuses this module across companies. */
function getCompanyFilter() {
  return process.env.COMPANY?.trim() || null;
}

function isScrapeOnly() {
  return process.env.SCRAPE_ONLY === "true" || !!getCompanyFilter();
}

const SHEET_NAME = "Jobs";
// A–G: scraped | H–M: legacy apply columns | N: posted | O–Q: ATS analysis
const HEADERS = [
  "Company", "Title", "Location", "URL", "Category", "Fetched At", "Description",
  "Resume URL", "Cover Letter", "ATS Score", "Apply Status", "Applied At", "Notes",
  "Posted At", "ATS Match Summary", "Key Gaps", "Recommended Keywords",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_ENGINEERING_KEYWORDS = [
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
  "machine learning",
  "ml ",
  " data ",
  "infrastructure",
  "security engineer",
  "staff",
  "principal",
];

const ENGINEERING_KEYWORDS = (process.env.ENGINEERING_KEYWORDS ?? "")
  .split(",")
  .map((k) => k.trim().toLowerCase())
  .filter(Boolean);

function isEngineeringRole(title = "") {
  if (ENGINEERING_FILTER_OFF) return true;
  const t = title.toLowerCase();
  const keywords =
    ENGINEERING_KEYWORDS.length > 0 ? ENGINEERING_KEYWORDS : DEFAULT_ENGINEERING_KEYWORDS;
  return keywords.some((k) => t.includes(k));
}

/** Infer ATS platform from job URL for scrape summaries. */
function detectPlatformFromUrl(url = "") {
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
  if (u.includes("jobs.booking.com")) return "booking";
  if (u.includes("apply.workable.com")) return "workable";
  if (u.includes("breezy.hr")) return "breezy";
  if (u.includes("recruitee.com")) return "recruitee";
  return "other";
}

function now() {
  return new Date().toISOString();
}

/** Normalize ATS posted/created timestamps to ISO strings for column N. */
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

function looksLikeIsoTimestamp(s) {
  if (!s || typeof s !== "string") return false;
  return !Number.isNaN(Date.parse(s)) && s.length < 40;
}

/**
 * Normalize in-memory scrape rows to
 * [company, title, location, url, category, fetchedAt, postedAt, description].
 */
function normalizeScrapeRow(row) {
  const company = row[0] ?? "";
  const title = row[1] ?? "";
  const location = row[2] ?? "";
  const url = row[3] ?? "";
  const category = row[4] ?? "";
  const fetchedAt = row[5] ?? now();
  let postedAt = "";
  let description = "";

  if (row.length === 7) {
    if (looksLikeIsoTimestamp(row[6])) {
      postedAt = toIsoPosted(row[6]);
    } else {
      description = row[6] ?? "";
    }
  } else if (row.length >= 8) {
    postedAt = toIsoPosted(row[6]);
    description = row[7] ?? "";
  }

  return [company, title, location, url, category, fetchedAt, postedAt, description];
}

/** Map in-memory row → 17-column sheet row (A–Q). */
function toSheetRow(row) {
  const r = normalizeScrapeRow(row);
  return [
    r[0], r[1], r[2], r[3], r[4], r[5], r[7],
    "", "", "", "", "", "",
    r[6],
    "", "", "",
  ];
}

function padRowTo17(row) {
  const out = [...row];
  while (out.length < 17) out.push("");
  return out;
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
  // Original companies
  "StubHub":           "stubhubinc",
  "AXS":               "axs",
  "Lyft":              "lyft",
  "Airbnb":            "airbnb",
  "CLEAR":             "clear",
  "SeatGeek (Remote)": "seatgeek",
  "SeatGeek (NY)":     "seatgeek",
  "Uber Freight":      "uberfreight",
  // New companies
  "Coinbase":          "coinbase",
  "DoorDash":          "doordashglobal",  // migrated from 'doordash' (404)
  "Reddit":            "reddit",
  "Figma":             "figma",
  "Discord":           "discord",
  "Dropbox":           "dropbox",
  "Duolingo":          "duolingo",
  "Brex":              "brex",
  // Plaid moved to ASHBY_IDENTIFIERS — 'plaid' Greenhouse slug returns 404
  "Roblox":            "roblox",
  // General Full Stack companies
  "Snap Inc.":         "snapinc",
  "Stripe":            "stripe",
  "Databricks":        "databricks",
  "Twilio":            "twilio",
  "Cloudflare":        "cloudflare",
  "Datadog":           "datadog",
  "MongoDB":           "mongodb",
  "Riot Games":        "riotgames",
  "Vercel":            "vercel",
  "Instacart":         "instacart",
  "Pinterest":         "pinterest",
  // AI Agentics companies
  "Anthropic":         "anthropic",
  "Workato":           "workato",
  "Make (Celonis US)": "celonis",
  "Glean":             "gleanwork",      // 'glean' returns 404; correct slug is 'gleanwork'
  "Moveworks":         "moveworks",
  "Weights & Biases":  "weights_and_biases", // 'wandb' returns 404; correct slug is 'weights_and_biases'
  "Codeium / Windsurf":"codeium",
};

const WORKDAY_CONFIG = {
  // Original companies
  "Live Nation":   { host: "livenation.wd503.myworkdayjobs.com",            tenant: "livenation",            site: "LNExternalSite" },
  "Sabre":         { host: "sabre.wd1.myworkdayjobs.com",                   tenant: "sabre",                 site: "SabreJobs" },
  "NCL":           { host: "nclh.wd108.myworkdayjobs.com",                  tenant: "nclh",                  site: "NCL_Shoreside_Careers" },
  "SeaWorld":      { host: "seaworldentertainment.wd1.myworkdayjobs.com",   tenant: "seaworldentertainment", site: "SEA" },
  // New companies
  "Expedia Group": { host: "expedia.wd5.myworkdayjobs.com",                 tenant: "expedia",               site: "Expedia_Group_External" },
  "Hilton":        { host: "hilton.wd5.myworkdayjobs.com",                  tenant: "hilton",                site: "HJobs" },
  // General Full Stack companies
  "Adobe":          { host: "adobe.wd5.myworkdayjobs.com",                  tenant: "adobe",                 site: "external_experienced" },
  "Intuit":         { host: "intuit.wd1.myworkdayjobs.com",                 tenant: "intuit",                site: "Intuit_Careers" },
  "Qualcomm":       { host: "qualcomm.wd5.myworkdayjobs.com",               tenant: "qualcomm",              site: "External" },
  "PayPal":         { host: "paypal.wd1.myworkdayjobs.com",                 tenant: "paypal",                site: "jobs" },
  "Capital One":    { host: "capitalone.wd12.myworkdayjobs.com",            tenant: "capitalone",            site: "Capital_One" },
  "JPMorgan Chase": { host: "jpmc.wd5.myworkdayjobs.com",                   tenant: "jpmc",                  site: "technology" },
  "Shopify":        { host: "shopify.wd5.myworkdayjobs.com",                tenant: "shopify",               site: "Shopify" },
  "Zendesk":        { host: "zendesk.wd1.myworkdayjobs.com",                tenant: "zendesk",               site: "zendesk" },
  // AI Agentics companies
  "Salesforce":     { host: "salesforce.wd12.myworkdayjobs.com",            tenant: "salesforce",            site: "External_Career_Site" },
  "Microsoft":      { host: "microsoft.wd3.myworkdayjobs.com",              tenant: "microsoft",             site: "External" },
  "ServiceNow":     { host: "servicenow.wd5.myworkdayjobs.com",             tenant: "servicenow",            site: "External" },
};

/** Lever board slugs for description fetching */
const LEVER_SLUGS = {
  "Yelp":       "yelp",
  "Postman":    "postman",
  "Thumbtack":  "thumbtack",
};

/** Ashby company identifiers for description fetching */
const ASHBY_IDENTIFIERS = {
  "Linear":             "linear",
  "Replit":             "replit",
  "Retool":             "retool",
  "Ramp":               "ramp",
  "Confluent":          "confluent",
  "Snowflake":          "snowflake",
  // Fintech — Plaid migrated from Greenhouse (404) to Ashby (91 jobs)
  "Plaid":              "plaid",
  // AI Agentics companies
  "OpenAI":             "openai",
  "Cursor":             "cursor",
  "Zapier":             "zapier",
  "LangChain":          "langchain",
  "Cohere":             "cohere",
  "Harvey AI":          "harvey",
  "Sierra AI":          "sierra",
  "Cognition AI":       "cognition",
  "Dust.tt":            "dust",
  "Writer":             "writer",
  "Runway ML":          "runwayml",
  "Notion":             "notion",
  "Ema":                "ema",
  "Hebbia":             "hebbia-ai",
  "Mistral AI":         "mistral",
  "Adept AI":           "adept",
  "Pathos AI":          "pathosai",
  "Slack":              "slack",
};

/**
 * Fetch a plain-text job description for one row.
 * Returns an empty string if the ATS is not supported or the call fails.
 * @param {string[]} row — [company, title, location, url, category, fetchedAt, postedAt?, description?]
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

  // ── Lever ────────────────────────────────────────────────────────────────
  const leverSlug = LEVER_SLUGS[company];
  if (leverSlug || url.includes("lever.co")) {
    // URL format: https://jobs.lever.co/{slug}/{postingId}
    const postingId = url.match(/jobs\.lever\.co\/[^/]+\/([a-f0-9-]{36})/i)?.[1];
    const slug = leverSlug ?? url.match(/jobs\.lever\.co\/([^/]+)\//)?.[1];
    if (slug && postingId) {
      try {
        const res = await fetchWithRetry(
          `https://api.lever.co/v0/postings/${slug}/${postingId}`,
          { headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" } }
        );
        if (res.ok) {
          const data = await res.json();
          const lists = (data.lists ?? []).map((l) => `${l.text}:\n${(l.content ?? "").replace(/<li>/g, "\n• ").replace(/<\/li>/g, "")}`);
          const desc = [data.descriptionPlain ?? data.description ?? "", ...lists].join("\n\n");
          return stripHtml(desc).slice(0, 2500);
        }
      } catch { /* fall through */ }
    }
    return "";
  }

  // ── Ashby ─────────────────────────────────────────────────────────────────
  const ashbyId = ASHBY_IDENTIFIERS[company];
  if (ashbyId || url.includes("ashbyhq.com")) {
    // URL format: https://jobs.ashbyhq.com/{identifier}/{postingId}
    const postingId = url.match(/jobs\.ashbyhq\.com\/[^/]+\/([a-f0-9-]{36})/i)?.[1];
    const identifier = ashbyId ?? url.match(/jobs\.ashbyhq\.com\/([^/]+)\//)?.[1];
    if (identifier && postingId) {
      try {
        const res = await fetchWithRetry(
          `https://api.ashbyhq.com/posting-api/job-board/${identifier}/posting/${postingId}`,
          { headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" } }
        );
        if (res.ok) {
          const data = await res.json();
          const desc = data.descriptionHtml ?? data.description ?? "";
          return stripHtml(desc).slice(0, 2500);
        }
      } catch { /* fall through */ }
    }
    return "";
  }

  // Booking.com, SmartRecruiters & others — no reliable public description API
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
  const normalized = jobs.map(normalizeScrapeRow);
  const alreadyHaveDesc = normalized.filter((row) => row[7]?.length > 0);
  const needsFetch = normalized.filter((row) => !row[7]?.length);

  if (needsFetch.length === 0) {
    console.log(`\n📝  All ${jobs.length} new jobs already have inline descriptions`);
    return alreadyHaveDesc;
  }

  console.log(`\n📝  Fetching descriptions for ${needsFetch.length} new jobs (5 concurrent)...`);
  const enriched = await mapConcurrent(needsFetch, 5, async (row) => {
    const desc = await fetchDescription(row);
    return [...row.slice(0, 7), desc];
  });
  const withDesc = enriched.filter((r) => r[7]?.length > 0).length;
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
        rows.push([
          mappedCompany,
          j.title,
          j.location?.name ?? "",
          j.absolute_url ?? "",
          category,
          now(),
          j.first_published ?? j.updated_at ?? "",
        ]);
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
      j.first_published ?? j.updated_at ?? "",
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

      const pubDate = extractTag(item, "pubDate");
      rows.push(["Disney", title, location, url, "travel", now(), pubDate, description]);
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
function buildWorkdayJobUrl(host, site, externalPath) {
  if (!externalPath) return `https://${host}/en-US/${site}`;
  if (/^https?:\/\//i.test(externalPath)) return externalPath;
  const path = externalPath.startsWith("/") ? externalPath : `/${externalPath}`;
  if (path.startsWith("/job/") && !path.includes("/en-US/")) {
    return `https://${host}/en-US/${site}${path}`;
  }
  return `https://${host}${path}`;
}

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
      buildWorkdayJobUrl(host, site, j.externalPath),
      category,
      now(),
      j.postedOn ?? j.postedDate ?? "",
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
      j.createdAt ?? "",
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
      j.releasedDate ?? "",
    ]);
  } catch (e) {
    console.warn(`  ⚠  SmartRecruiters ${companyId}:`, e.message);
    return [];
  }
}

/**
 * Ashby public job board API.
 * @see https://api.ashbyhq.com/posting-api/job-board/{identifier}
 */
async function fetchAshby(identifier, company, category) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${identifier}`;
  try {
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" },
    });
    if (!res.ok) {
      console.warn(`  ⚠  Ashby ${identifier}: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const jobs = data.jobPostings ?? data.jobs ?? [];
    const filtered = jobs.filter((j) => isEngineeringRole(j.title));
    console.log(`  ✓  ${company}: ${filtered.length} engineering roles (Ashby)`);
    return filtered.map((j) => [
      company,
      j.title ?? "",
      j.locationName ?? j.location ?? "",
      j.jobUrl ?? `https://jobs.ashbyhq.com/${identifier}/${j.id}`,
      category,
      now(),
      j.publishedAt ?? j.updatedAt ?? "",
    ]);
  } catch (e) {
    console.warn(`  ⚠  Ashby ${identifier}:`, e.message);
    return [];
  }
}

/**
 * BreezyHR public JSON feed.
 * Pattern: GET https://{slug}.breezy.hr/json
 */
async function fetchBreezyHR(slug, company, category) {
  const url = `https://${slug}.breezy.hr/json`;
  try {
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" },
    });
    if (!res.ok) {
      console.warn(`  ⚠  BreezyHR ${slug}: HTTP ${res.status}`);
      return [];
    }
    const jobs = await res.json();
    const list = Array.isArray(jobs) ? jobs : [];
    const filtered = list.filter((j) => isEngineeringRole(j.name ?? j.title ?? ""));
    console.log(`  ✓  ${company}: ${filtered.length} engineering roles (BreezyHR)`);
    return filtered.map((j) => [
      company,
      j.name ?? j.title ?? "",
      j.location?.name ?? j.city ?? "",
      j.url ?? `https://${slug}.breezy.hr/p/${j.friendly_id ?? j.id}`,
      category,
      now(),
      j.published_date ?? j.created_at ?? "",
    ]);
  } catch (e) {
    console.warn(`  ⚠  BreezyHR ${slug}:`, e.message);
    return [];
  }
}

/**
 * Workable public API.
 * Pattern: GET https://apply.workable.com/api/v1/widget/listing/{slug}
 */
async function fetchWorkable(slug, company, category) {
  const url = `https://apply.workable.com/api/v1/widget/listing/${slug}`;
  try {
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "JobScraper/1.0 (portfolio automation)",
      },
      body: JSON.stringify({ query: "engineer", location: [], department: [], worktype: [] }),
    });
    if (!res.ok) {
      console.warn(`  ⚠  Workable ${slug}: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const jobs = data.results ?? [];
    const filtered = jobs.filter((j) => isEngineeringRole(j.title ?? j.name ?? ""));
    console.log(`  ✓  ${company}: ${filtered.length} engineering roles (Workable)`);
    return filtered.map((j) => [
      company,
      j.title ?? j.name ?? "",
      j.location?.location_str ?? j.city ?? "",
      j.url ?? `https://apply.workable.com/${slug}/j/${j.shortcode}`,
      category,
      now(),
      j.published ?? j.created_at ?? "",
    ]);
  } catch (e) {
    console.warn(`  ⚠  Workable ${slug}:`, e.message);
    return [];
  }
}

/**
 * Hiring Cafe — department-based search, full pagination (Playwright).
 * @see scripts/lib/hiring-cafe-scraper.mjs
 */
async function fetchHiringCafe() {
  try {
    return await scrapeAllHiringCafeJobs(isEngineeringRole);
  } catch (e) {
    console.warn("  ⚠  Hiring Cafe:", e.message);
    return [];
  }
}

/**
 * Recruitee public API.
 * Pattern: GET https://{slug}.recruitee.com/api/offers/
 */
async function fetchRecruitee(slug, company, category) {
  const url = `https://${slug}.recruitee.com/api/offers/`;
  try {
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" },
    });
    if (!res.ok) {
      console.warn(`  ⚠  Recruitee ${slug}: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const jobs = data.offers ?? [];
    const filtered = jobs.filter((j) => isEngineeringRole(j.title ?? j.position ?? ""));
    console.log(`  ✓  ${company}: ${filtered.length} engineering roles (Recruitee)`);
    return filtered.map((j) => [
      company,
      j.title ?? j.position ?? "",
      j.city ?? j.location ?? "",
      j.careers_url ?? `https://${slug}.recruitee.com/o/${j.slug}`,
      category,
      now(),
      j.published_at ?? j.created_at ?? "",
    ]);
  } catch (e) {
    console.warn(`  ⚠  Recruitee ${slug}:`, e.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// General Full Stack — custom FAANG adapters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Amazon Jobs — public search JSON API.
 */
async function fetchAmazon(category = "general") {
  const params = new URLSearchParams({
    offset:       "0",
    result_limit: "20",
    sort:         "recent",
    base_query:   "software engineer",
  });
  const url = `https://www.amazon.jobs/en/search.json?${params}`;
  try {
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });
    if (!res.ok) {
      console.warn(`  ⚠  Amazon: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const jobs  = data.jobs ?? data.results ?? [];
    const filtered = jobs.filter((j) => isEngineeringRole(j.title ?? ""));
    console.log(`  ✓  Amazon: ${filtered.length} engineering roles`);
    return filtered.map((j) => [
      "Amazon",
      j.title ?? "",
      j.normalized_location ?? j.city ?? "",
      j.job_path ? `https://www.amazon.jobs${j.job_path}` : "",
      category,
      now(),
      j.posted_date ?? j.create_date ?? "",
    ]).filter((r) => r[3]);
  } catch (e) {
    console.warn("  ⚠  Amazon:", e.message);
    return [];
  }
}

/**
 * Google Careers — unofficial public JSON search API.
 */
async function fetchGoogle(category = "general") {
  const params = new URLSearchParams({
    q:               "software engineer",
    num:             "20",
    start:           "0",
    jlo:             "en_US",
    employment_type: "FULL_TIME",
  });
  const url = `https://careers.google.com/api/v3/search/?${params}`;
  try {
    const res = await fetchWithRetry(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept":     "application/json",
      },
    });
    if (!res.ok) {
      console.warn(`  ⚠  Google: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const jobs  = data.jobs ?? [];
    const filtered = jobs.filter((j) => isEngineeringRole(j.title ?? ""));
    console.log(`  ✓  Google: ${filtered.length} engineering roles`);
    return filtered.map((j) => [
      "Google",
      j.title ?? "",
      j.locations?.[0]?.display ?? j.locations?.[0]?.city ?? "",
      j.id ? `https://careers.google.com/jobs/results/${j.id}` : "",
      category,
      now(),
      j.publish_time ?? j.updated ?? "",
    ]).filter((r) => r[3]);
  } catch (e) {
    console.warn("  ⚠  Google:", e.message);
    return [];
  }
}

/**
 * Meta Careers — best-effort scrape of their public search page.
 * Meta's career site is a React SPA; we attempt their internal JSON endpoint.
 */
async function fetchMeta(category = "general") {
  try {
    const res = await fetchWithRetry(
      "https://www.metacareers.com/jobs?q=software+engineer&is_leadership=0&is_remote_only=0",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept":     "text/html,application/xhtml+xml,application/json",
        },
      }
    );
    if (!res.ok) {
      console.warn(`  ⚠  Meta: HTTP ${res.status}`);
      return [];
    }
    const text = await res.text();
    // Try to find embedded JSON jobs data in a script tag or JSON-LD
    const match = text.match(/"jobs"\s*:\s*(\[[\s\S]*?\](?=\s*[,}]))/);
    if (!match) {
      console.warn("  ⚠  Meta: no parseable jobs found (JS-rendered page)");
      return [];
    }
    const jobs = JSON.parse(match[1]);
    const filtered = jobs.filter((j) => isEngineeringRole(j.title ?? j.name ?? ""));
    console.log(`  ✓  Meta: ${filtered.length} engineering roles`);
    return filtered.map((j) => [
      "Meta",
      j.title ?? j.name ?? "",
      j.location ?? j.locations?.[0] ?? "",
      j.url ?? (j.id ? `https://www.metacareers.com/jobs/${j.id}` : ""),
      category,
      now(),
      j.posted_date ?? j.created_time ?? "",
    ]).filter((r) => r[3]);
  } catch (e) {
    console.warn("  ⚠  Meta:", e.message);
    return [];
  }
}

/**
 * Apple Jobs — public role search API.
 */
async function fetchApple(category = "general") {
  try {
    const res = await fetchWithRetry(
      "https://jobs.apple.com/api/role/search?q=software+engineer&page=0&locale=en-us",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept":     "application/json",
        },
      }
    );
    if (!res.ok) {
      console.warn(`  ⚠  Apple: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const jobs  = data.searchResults ?? data.results ?? data.jobs ?? [];
    const filtered = jobs.filter((j) => isEngineeringRole(j.postingTitle ?? j.title ?? ""));
    console.log(`  ✓  Apple: ${filtered.length} engineering roles`);
    return filtered.map((j) => [
      "Apple",
      j.postingTitle ?? j.title ?? "",
      Array.isArray(j.locations) ? j.locations.map((l) => l.name ?? l).join(", ") : (j.location ?? ""),
      j.id ? `https://jobs.apple.com/en-us/details/${j.id}` : "",
      category,
      now(),
      j.postedDate ?? j.postDate ?? "",
    ]).filter((r) => r[3]);
  } catch (e) {
    console.warn("  ⚠  Apple:", e.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Company definitions
// ─────────────────────────────────────────────────────────────────────────────

function printScrapeSummary(allJobs, { taskCount = 0, rejected = 0 } = {}) {
  const byPlatform = {};
  const byCompany = {};

  for (const row of allJobs) {
    const company = row[0] ?? "Unknown";
    byCompany[company] = (byCompany[company] ?? 0) + 1;
    const platform = detectPlatformFromUrl(row[3] ?? "");
    byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📊  Scrape summary");
  console.log(`   Sources: ${taskCount}  |  Jobs fetched: ${allJobs.length}  |  Rejected: ${rejected}`);
  if (ENGINEERING_FILTER_OFF) {
    console.log("   Title filter: OFF (ENGINEERING_FILTER=off)");
  } else if (ENGINEERING_KEYWORDS.length > 0) {
    console.log(`   Title filter: custom (${ENGINEERING_KEYWORDS.length} keywords)`);
  } else {
    console.log(`   Title filter: default (${DEFAULT_ENGINEERING_KEYWORDS.length} keywords)`);
  }
  if (DRY_RUN) console.log("   Mode: DRY_RUN (no sheet writes)");

  const platformLines = Object.entries(byPlatform)
    .sort((a, b) => b[1] - a[1])
    .map(([p, n]) => `      ${p}: ${n}`);
  if (platformLines.length) {
    console.log("\n   By platform (from URLs):");
    for (const line of platformLines) console.log(line);
  }

  const topCompanies = Object.entries(byCompany)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  if (topCompanies.length) {
    console.log("\n   Top companies:");
    for (const [name, n] of topCompanies) {
      console.log(`      ${name}: ${n}`);
    }
    const rest = Object.keys(byCompany).length - topCompanies.length;
    if (rest > 0) console.log(`      … +${rest} more companies`);
  }

  if (rejected > 0) {
    console.log(`\n   ❌ ${rejected} source(s) threw (see warnings above)`);
  }
  console.log("═══════════════════════════════════════════════════════════\n");
}

/** @returns {{ name: string, run: () => Promise<any[]> }[]} */
function buildScrapeTaskDefs() {
  return [
    // ── Greenhouse — Original ────────────────────────────────────────────
    { name: "StubHub", run: () => fetchGreenhouse("stubhubinc", "StubHub", "travel") },
    { name: "AXS", run: () => fetchGreenhouse("axs", "AXS", "travel") },
    { name: "Lyft", run: () => fetchGreenhouse("lyft", "Lyft", "travel") },
    { name: "Airbnb", run: () => fetchGreenhouse("airbnb", "Airbnb", "travel") },
    { name: "CLEAR", run: () => fetchGreenhouse("clear", "CLEAR", "travel") },
    { name: "Uber Freight", run: () => fetchGreenhouse("uberfreight", "Uber Freight", "travel") },

    // ── Greenhouse — SeatGeek (split by location) ────────────────────────
    {
      name: "SeatGeek",
      run: () => fetchGreenhouse("seatgeek", "SeatGeek", "travel", (loc) => {
        if (/Remote.*United States/i.test(loc)) return "SeatGeek (Remote)";
        if (/New York/i.test(loc)) return "SeatGeek (NY)";
        return null;
      }),
    },

    // ── Greenhouse — New tech companies ──────────────────────────────────
    { name: "Coinbase", run: () => fetchGreenhouse("coinbase", "Coinbase", "fintech") },
    { name: "DoorDash", run: () => fetchGreenhouse("doordashglobal", "DoorDash", "general") },
    { name: "Reddit", run: () => fetchGreenhouse("reddit", "Reddit", "social") },
    { name: "Figma", run: () => fetchGreenhouse("figma", "Figma", "general") },
    { name: "Discord", run: () => fetchGreenhouse("discord", "Discord", "social") },
    { name: "Dropbox", run: () => fetchGreenhouse("dropbox", "Dropbox", "saas") },
    { name: "Duolingo", run: () => fetchGreenhouse("duolingo", "Duolingo", "edtech") },
    { name: "Brex", run: () => fetchGreenhouse("brex", "Brex", "general") },
    { name: "Plaid", run: () => fetchAshby("plaid", "Plaid", "fintech") },
    { name: "Roblox", run: () => fetchGreenhouse("roblox", "Roblox", "gaming") },

    // ── Workday — Original ───────────────────────────────────────────────
    {
      name: "Live Nation",
      run: () => fetchWorkday("livenation.wd503.myworkdayjobs.com", "livenation", "LNExternalSite", "Live Nation", "travel"),
    },
    {
      name: "Sabre",
      run: () => fetchWorkday("sabre.wd1.myworkdayjobs.com", "sabre", "SabreJobs", "Sabre", "travel"),
    },
    {
      name: "NCL",
      run: () => fetchWorkday("nclh.wd108.myworkdayjobs.com", "nclh", "NCL_Shoreside_Careers", "NCL", "travel"),
    },
    {
      name: "SeaWorld",
      run: () => fetchWorkday("seaworldentertainment.wd1.myworkdayjobs.com", "seaworldentertainment", "SEA", "SeaWorld", "travel"),
    },

    // ── Workday — New companies ───────────────────────────────────────────
    {
      name: "Expedia Group",
      run: () => fetchWorkday("expedia.wd5.myworkdayjobs.com", "expedia", "Expedia_Group_External", "Expedia Group", "travel"),
    },
    {
      name: "Hilton",
      run: () => fetchWorkday("hilton.wd5.myworkdayjobs.com", "hilton", "HJobs", "Hilton", "travel"),
    },

    // ── Lever ────────────────────────────────────────────────────────────
    { name: "Yelp", run: () => fetchLever("yelp", "Yelp", "local") },
    { name: "Postman", run: () => fetchLever("postman", "Postman", "saas") },
    { name: "Thumbtack", run: () => fetchLever("thumbtack", "Thumbtack", "marketplace") },

    // ── Ashby ────────────────────────────────────────────────────────────
    { name: "Linear", run: () => fetchAshby("linear", "Linear", "saas") },
    { name: "Replit", run: () => fetchAshby("replit", "Replit", "devtools") },
    { name: "Retool", run: () => fetchAshby("retool", "Retool", "saas") },

    // ── SmartRecruiters ───────────────────────────────────────────────────
    { name: "Royal Caribbean Group", run: () => fetchSmartRecruiters("RoyalCaribbeanGroup", "Royal Caribbean Group", "travel") },

    // ── iCIMS RSS ────────────────────────────────────────────────────────
    { name: "Disney", run: () => fetchDisney() },

    // ── Booking.com — Custom REST API ─────────────────────────────────────
    {
      name: "Booking.com",
      run: async () => {
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
            d.posted_date ?? d.published_date ?? d.created_at ?? "",
          ];
        });
      } catch (e) {
        console.warn("  ⚠  Booking.com:", e.message);
        return [];
      }
      },
    },

    // ── General Full Stack — Greenhouse ───────────────────────────────────
    { name: "Snap Inc.", run: () => fetchGreenhouse("snapinc", "Snap Inc.", "general") },
    { name: "Stripe", run: () => fetchGreenhouse("stripe", "Stripe", "general") },
    { name: "Databricks", run: () => fetchGreenhouse("databricks", "Databricks", "general") },
    { name: "Twilio", run: () => fetchGreenhouse("twilio", "Twilio", "general") },
    { name: "Cloudflare", run: () => fetchGreenhouse("cloudflare", "Cloudflare", "general") },
    { name: "Datadog", run: () => fetchGreenhouse("datadog", "Datadog", "general") },
    { name: "MongoDB", run: () => fetchGreenhouse("mongodb", "MongoDB", "general") },
    { name: "Riot Games", run: () => fetchGreenhouse("riotgames", "Riot Games", "general") },
    { name: "Vercel", run: () => fetchGreenhouse("vercel", "Vercel", "general") },
    { name: "Instacart", run: () => fetchGreenhouse("instacart", "Instacart", "general") },
    { name: "Pinterest", run: () => fetchGreenhouse("pinterest", "Pinterest", "general") },

    // ── General Full Stack — Ashby ────────────────────────────────────────
    { name: "Ramp", run: () => fetchAshby("ramp", "Ramp", "general") },
    { name: "Confluent", run: () => fetchAshby("confluent", "Confluent", "general") },
    { name: "Snowflake", run: () => fetchAshby("snowflake", "Snowflake", "general") },

    // ── General Full Stack — Workday ──────────────────────────────────────
    { name: "Adobe", run: () => fetchWorkday("adobe.wd5.myworkdayjobs.com", "adobe", "external_experienced", "Adobe", "general") },
    { name: "Intuit", run: () => fetchWorkday("intuit.wd1.myworkdayjobs.com", "intuit", "Intuit_Careers", "Intuit", "general") },
    { name: "Qualcomm", run: () => fetchWorkday("qualcomm.wd5.myworkdayjobs.com", "qualcomm", "External", "Qualcomm", "general") },
    { name: "PayPal", run: () => fetchWorkday("paypal.wd1.myworkdayjobs.com", "paypal", "jobs", "PayPal", "general") },
    { name: "Capital One", run: () => fetchWorkday("capitalone.wd12.myworkdayjobs.com", "capitalone", "Capital_One", "Capital One", "general") },
    { name: "JPMorgan Chase", run: () => fetchWorkday("jpmc.wd5.myworkdayjobs.com", "jpmc", "technology", "JPMorgan Chase", "general") },
    { name: "Shopify", run: () => fetchWorkday("shopify.wd5.myworkdayjobs.com", "shopify", "Shopify", "Shopify", "general") },
    { name: "Zendesk", run: () => fetchWorkday("zendesk.wd1.myworkdayjobs.com", "zendesk", "zendesk", "Zendesk", "general") },

    // ── General Full Stack — FAANG (custom adapters) ──────────────────────
    { name: "Amazon", run: () => fetchAmazon("general") },
    { name: "Google", run: () => fetchGoogle("general") },
    { name: "Meta", run: () => fetchMeta("general") },
    { name: "Apple", run: () => fetchApple("general") },

    // ── AI Agentics — Greenhouse ─────────────────────────────────────────
    { name: "Anthropic", run: () => fetchGreenhouse("anthropic", "Anthropic", "ai-agentics") },
    { name: "Workato", run: () => fetchGreenhouse("workato", "Workato", "ai-agentics") },
    { name: "Make (Celonis US)", run: () => fetchGreenhouse("celonis", "Make (Celonis US)", "ai-agentics") },
    { name: "Glean", run: () => fetchGreenhouse("gleanwork", "Glean", "ai-agentics") },
    { name: "Moveworks", run: () => fetchGreenhouse("moveworks", "Moveworks", "ai-agentics") },
    { name: "Weights & Biases", run: () => fetchGreenhouse("weights_and_biases", "Weights & Biases", "ai-agentics") },
    { name: "Codeium / Windsurf", run: () => fetchGreenhouse("codeium", "Codeium / Windsurf", "ai-agentics") },

    // ── AI Agentics — Ashby ──────────────────────────────────────────────
    { name: "OpenAI", run: () => fetchAshby("openai", "OpenAI", "ai-agentics") },
    { name: "Cursor", run: () => fetchAshby("cursor", "Cursor", "ai-agentics") },
    { name: "Notion", run: () => fetchAshby("notion", "Notion", "ai-agentics") },
    { name: "Zapier", run: () => fetchAshby("zapier", "Zapier", "ai-agentics") },
    { name: "LangChain", run: () => fetchAshby("langchain", "LangChain", "ai-agentics") },
    { name: "Cohere", run: () => fetchAshby("cohere", "Cohere", "ai-agentics") },
    { name: "Mistral AI", run: () => fetchAshby("mistral", "Mistral AI", "ai-agentics") },
    { name: "Hebbia", run: () => fetchAshby("hebbia-ai", "Hebbia", "ai-agentics") },
    { name: "Harvey AI", run: () => fetchAshby("harvey", "Harvey AI", "ai-agentics") },
    { name: "Sierra AI", run: () => fetchAshby("sierra", "Sierra AI", "ai-agentics") },
    { name: "Ema", run: () => fetchAshby("ema", "Ema", "ai-agentics") },
    { name: "Adept AI", run: () => fetchAshby("adept", "Adept AI", "ai-agentics") },
    { name: "Cognition AI", run: () => fetchAshby("cognition", "Cognition AI", "ai-agentics") },
    { name: "Dust.tt", run: () => fetchAshby("dust", "Dust.tt", "ai-agentics") },
    { name: "Linear", run: () => fetchAshby("linear", "Linear", "ai-agentics") },
    { name: "Retool", run: () => fetchAshby("retool", "Retool", "ai-agentics") },
    { name: "Writer", run: () => fetchAshby("writer", "Writer", "ai-agentics") },
    { name: "Runway ML", run: () => fetchAshby("runwayml", "Runway ML", "ai-agentics") },
    { name: "Pathos AI", run: () => fetchAshby("pathosai", "Pathos AI", "ai-agentics") },
    { name: "Slack", run: () => fetchAshby("slack", "Slack", "ai-agentics") },

    // ── AI Agentics — Workday ─────────────────────────────────────────────
    { name: "Salesforce", run: () => fetchWorkday("salesforce.wd12.myworkdayjobs.com", "salesforce", "External_Career_Site", "Salesforce", "ai-agentics") },
    { name: "Microsoft", run: () => fetchWorkday("microsoft.wd3.myworkdayjobs.com", "microsoft", "External", "Microsoft", "ai-agentics") },
    { name: "ServiceNow", run: () => fetchWorkday("servicenow.wd5.myworkdayjobs.com", "servicenow", "External", "ServiceNow", "ai-agentics") },

    // ── Hiring Cafe — easy-apply aggregator (Playwright) ─────────────────
    { name: "Hiring Cafe", run: () => fetchHiringCafe("hiring-cafe") },
  ];
}

async function fetchAllJobs() {
  const allDefs = buildScrapeTaskDefs();
  const companyFilter = getCompanyFilter();
  let defs = allDefs;
  if (companyFilter) {
    defs = allDefs.filter((d) => d.name === companyFilter);
    if (defs.length === 0) {
      throw new Error(`Unknown company: ${companyFilter}`);
    }
    // Linear/Retool appear in both saas + ai-agentics — scrape once per company
    if (defs.length > 1) defs = [defs[0]];
    console.log(`🔍  Fetching jobs for ${companyFilter}...\n`);
  } else {
    console.log("🔍  Fetching jobs from all companies...\n");
  }

  const tasks = defs.map((d) => d.run());
  const results = await Promise.allSettled(tasks);
  const rejected = results.filter((r) => r.status === "rejected");
  for (const r of rejected) {
    console.warn("  ⚠  Scrape source rejected:", r.reason?.message ?? r.reason);
  }
  const allJobs = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .map(normalizeScrapeRow);

  printScrapeSummary(allJobs, { taskCount: tasks.length, rejected: rejected.length });
  return { allJobs, rejected: rejected.length, taskCount: tasks.length };
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
  return wrapSheetsClient(google.sheets({ version: "v4", auth }));
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

  // Always sync headers (A–Q, 17 columns)
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A1:Q1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS] },
  });
}

/**
 * Bump column F ("Fetched At") for jobs still on the board at scrape time.
 *
 * Column F is scrape-time, NOT the ATS posted date. On first discovery we set
 * it to now(); on every subsequent scrape where the URL is still live we
 * refresh it so the admin time filters reflect *last seen*, not first seen.
 * Not used by the Hiring Cafe pipeline (discovery time = fetchedAt).
 */
async function refreshLastSeenAt(sheets, scrapedJobs) {
  const scrapedUrls = new Set(scrapedJobs.map((row) => row[3]).filter(Boolean));
  if (scrapedUrls.size === 0) return 0;

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!D2:D`,
  });
  const urlRows = resp.data.values ?? [];
  if (urlRows.length === 0) return 0;

  const timestamp = now();
  const updateData = urlRows
    .map((row, idx) => ({ url: row[0] ?? "", sheetRow: idx + 2 }))
    .filter(({ url }) => url && scrapedUrls.has(url))
    .map(({ sheetRow }) => ({
      range: `${SHEET_NAME}!F${sheetRow}`,
      values: [[timestamp]],
    }));

  if (updateData.length === 0) return 0;

  if (DRY_RUN) {
    console.log(`🏃  DRY_RUN: would refresh last-seen for ${updateData.length} existing jobs`);
    return updateData.length;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: GOOGLE_SHEET_ID,
    requestBody: { valueInputOption: "RAW", data: updateData },
  });
  console.log(`🔄  Refreshed last-seen for ${updateData.length} existing jobs`);
  return updateData.length;
}

/**
 * Fill column N ("Posted At") for existing rows when the scraper has ATS posted dates
 * and the sheet cell is still empty. Does not overwrite user-entered values.
 */
async function syncPostedAt(sheets, scrapedJobs) {
  const postedByUrl = new Map();
  for (const row of scrapedJobs) {
    const normalized = normalizeScrapeRow(row);
    const url = normalized[3];
    const postedAt = normalized[6];
    if (url && postedAt) postedByUrl.set(url, postedAt);
  }
  if (postedByUrl.size === 0) return 0;

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!D2:N`,
  });
  const urlRows = resp.data.values ?? [];
  if (urlRows.length === 0) return 0;

  const updateData = urlRows
    .map((row, idx) => ({
      url: row[0] ?? "",
      postedAt: row[10] ?? "",
      sheetRow: idx + 2,
    }))
    .filter(({ url, postedAt }) => url && !postedAt && postedByUrl.has(url))
    .map(({ url, sheetRow }) => ({
      range: `${SHEET_NAME}!N${sheetRow}`,
      values: [[postedByUrl.get(url)]],
    }));

  if (updateData.length === 0) return 0;

  if (DRY_RUN) {
    console.log(`🏃  DRY_RUN: would backfill posted-at for ${updateData.length} existing jobs`);
    return updateData.length;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: GOOGLE_SHEET_ID,
    requestBody: { valueInputOption: "RAW", data: updateData },
  });
  console.log(`📅  Backfilled posted-at for ${updateData.length} existing jobs`);
  return updateData.length;
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

  if (DRY_RUN) {
    console.log(
      `🏃  DRY_RUN: ${deduped.length} new URLs (${newJobs.length} fetched, ${existingUrls.size} already in sheet)`
    );
    return deduped;
  }

  if (deduped.length === 0) {
    console.log("✅  No new jobs to add (all already in sheet)");
    return [];
  }

  // Fetch descriptions only for the genuinely new jobs
  const enriched = await enrichWithDescriptions(deduped);

  // Append A–G + N scraped fields; H–M empty, K blank until generate sets pending
  const rows14 = enriched.map((row) => toSheetRow(row));

  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A:Q`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows14 },
  });

  console.log(`✅  Added ${enriched.length} new jobs to Google Sheets`);
  return enriched;
}

// Companies whose description APIs are inaccessible — skip during backfill to save time
const NO_DESCRIPTION_COMPANIES = new Set(["Live Nation", "Sabre", "NCL", "SeaWorld", "Booking.com",
  "Flywire", "Royal Caribbean Group", "Disney", "Universal Studios"]);

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp notification via Meta WhatsApp Cloud API
// Env vars required: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN
//                    WHATSAPP_RECIPIENT  (e.g. +15512298660)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a WhatsApp text message via the official Meta Cloud API.
 * Silently skips if credentials are not configured.
 */
async function sendWhatsAppNotification(newJobRows) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN;
  const recipient     = process.env.WHATSAPP_RECIPIENT ?? "+15512298660";

  if (!phoneNumberId || !accessToken) {
    console.log("ℹ️   WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN not set — skipping notification");
    return;
  }
  if (newJobRows.length === 0) return;

  // Group rows by company (column 0)
  const byCompany = {};
  for (const row of newJobRows) {
    const company = row[0] ?? "Unknown";
    (byCompany[company] ??= []).push({ title: row[1] ?? "", url: row[3] ?? "" });
  }

  const ts = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines = [`🎯 *${newJobRows.length} New Engineering Job${newJobRows.length !== 1 ? "s" : ""}* — ${ts} PDT`];

  for (const [company, jobs] of Object.entries(byCompany)) {
    lines.push(`\n*${company}* (${jobs.length})`);
    for (const { title, url } of jobs.slice(0, 5)) {
      lines.push(`• ${title}\n  ${url}`);
    }
    if (jobs.length > 5) lines.push(`  … +${jobs.length - 5} more`);
  }

  lines.push(`\n🔗 https://koundinyapidaparhty.vercel.app/admin`);

  const body = lines.join("\n").slice(0, 4000);

  try {
    const res = await fetchWithTimeout(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "text",
          text: { body },
        }),
      },
      15000
    );
    if (res.ok) {
      console.log(`📱  WhatsApp notification sent to ${recipient}`);
    } else {
      const err = await res.text().catch(() => "");
      console.warn(`⚠️   WhatsApp send failed (${res.status}): ${err.slice(0, 300)}`);
    }
  } catch (err) {
    console.warn("⚠️   WhatsApp notification error:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Archive old jobs (> 2 days) → "Old Jobs" sheet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Move rows older than maxAgeMs from the Jobs sheet to an "Old Jobs" archive
 * sheet. Default: 6h apply-now window (Hiring Cafe pipeline).
 */
async function archiveOldJobs(sheets, { maxAgeMs = APPLY_NOW_WINDOW_MS } = {}) {
  if (DRY_RUN) {
    console.log("🏃  DRY_RUN: skipping archive");
    return;
  }
  const ARCHIVE_SHEET = "Old Jobs";

  try {
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A2:Q`,
    });
    const dataRows = (resp.data.values ?? []).map(padRowTo17);
    if (dataRows.length === 0) return;

    const now = Date.now();
    const oldRows = [];
    const keepRows = [];
    for (const row of dataRows) {
      const fetchedAt = row[5] ?? "";
      const age = fetchedAt ? now - new Date(fetchedAt).getTime() : Infinity;
      if (age > maxAgeMs) {
        oldRows.push(row);
      } else {
        keepRows.push(row);
      }
    }

    if (oldRows.length === 0) {
      console.log("🗂️   No old jobs to archive");
      return;
    }

    // Ensure archive sheet exists with full A–N headers
    const meta = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID });
    const existing = (meta.data.sheets ?? []).map((s) => s.properties.title);
    if (!existing.includes(ARCHIVE_SHEET)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: GOOGLE_SHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: ARCHIVE_SHEET } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${ARCHIVE_SHEET}!A1:Q1`,
        valueInputOption: "RAW",
        requestBody: { values: [HEADERS] },
      });
      console.log(`📄  Created archive sheet "${ARCHIVE_SHEET}"`);
    }

    // Append full rows to archive (A–N)
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${ARCHIVE_SHEET}!A:Q`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: oldRows },
    });

    // Rewrite Jobs: headers + keep rows only; clear leftover data rows
    await sheets.spreadsheets.values.clear({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A2:Q`,
    });
    const jobsBody = keepRows.length > 0 ? [HEADERS, ...keepRows] : [HEADERS];
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: jobsBody },
    });

    console.log(`🗂️   Archived ${oldRows.length} jobs → "${ARCHIVE_SHEET}" | ${keepRows.length} remain in Jobs`);
  } catch (err) {
    console.warn("⚠️   Archive failed:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function runPlaywrightEnrich() {
  if (!ENRICH_PLAYWRIGHT) return;
  console.log("\n🌐  ENRICH_PLAYWRIGHT=true — running enrich-descriptions.mjs...\n");
  const { spawn } = await import("child_process");
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/enrich-descriptions.mjs"], {
      stdio: "inherit",
      cwd: process.cwd(),
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`enrich-descriptions exited ${code}`))));
  });
}

async function main() {
  const companyFilter = getCompanyFilter();
  const scrapeOnly = isScrapeOnly();
  if (DRY_RUN || scrapeOnly) console.log("🏃  DRY_RUN/SCRAPE_ONLY — no sheet writes or WhatsApp\n");
  if (companyFilter) console.log(`🎯  Single-company mode: ${companyFilter}\n`);

  const { allJobs: jobs, rejected } = await fetchAllJobs();

  if (scrapeOnly) {
    if (rejected > 0) {
      console.error(`❌  ${companyFilter ?? "scrape"}: ${rejected} source(s) failed`);
      process.exit(1);
    }
    console.log(`✅  ${companyFilter ?? "all companies"}: ${jobs.length} jobs fetched`);
    process.exit(0);
  }

  const sheets = await getSheets();
  if (!DRY_RUN) {
    await ensureSheetAndHeaders(sheets);
    await refreshLastSeenAt(sheets, jobs);
    await syncPostedAt(sheets, jobs);
    await archiveOldJobs(sheets);
    await migrateLegacyCompanyNames(sheets);
  }
  const newJobRows = await writeNewJobs(sheets, jobs);
  if (!DRY_RUN) {
    await backfillDescriptions(sheets);
    await sendWhatsAppNotification(newJobRows);
    await runPlaywrightEnrich();
  } else {
    console.log(`🏃  DRY_RUN: ${jobs.length} jobs fetched; ${newJobRows.length} would be new`);
  }
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
 * Does NOT touch fetchedAt (column F) — that is managed by refreshLastSeenAt.
 */
async function backfillDescriptions(sheets) {
  if (DRY_RUN) return;

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

export {
  fetchAllJobs,
  fetchHiringCafe,
  getSheets,
  ensureSheetAndHeaders,
  refreshLastSeenAt,
  syncPostedAt,
  writeNewJobs,
  archiveOldJobs,
  backfillDescriptions,
  fetchDescription,
  enrichWithDescriptions,
  mapConcurrent,
  normalizeScrapeRow,
  toSheetRow,
  buildScrapeTaskDefs,
  isEngineeringRole,
  sendWhatsAppNotification,
  SHEET_NAME,
  HEADERS,
};

const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  main().catch((err) => {
    console.error("💥  Scraper crashed:", err);
    process.exit(1);
  });
}
