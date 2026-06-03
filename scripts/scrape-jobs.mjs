#!/usr/bin/env node
/**
 * Job scraper — fetches engineering roles from each company and writes to Google Sheets.
 *
 * Required env vars:
 *   GOOGLE_SHEET_ID              — ID of the target Google Sheet
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — full service-account JSON as a string
 *
 * Supported ATS adapters (30+ companies, 7 platforms):
 *   - Greenhouse  (StubHub, AXS, Lyft, Airbnb, CLEAR, SeatGeek, Uber Freight,
 *                  Coinbase, DoorDash, Reddit, Figma, Discord, Dropbox, Duolingo,
 *                  Brex, Plaid, Roblox)
 *   - Workday     (Live Nation, Sabre, NCL, SeaWorld, Expedia Group, Hilton)
 *   - Lever       (Yelp, Postman, Thumbtack)
 *   - Ashby       (Linear, Replit, Retool)
 *   - SmartRecruiters (Royal Caribbean Group)
 *   - iCIMS RSS   (Disney — descriptions fetched inline)
 *   - Custom      (Booking.com)
 *
 * Not scrapeable:
 *   - Universal Studios — Cloudflare-blocked
 *   - Flywire — no active ATS board found
 */

import { google } from "googleapis";
import { existsSync, readFileSync } from "fs";

// Auto-load .env.local when running locally (not set in GitHub Actions).
// Hand-rolled parser preserves JSON values with embedded double-quotes.
if (existsSync(".env.local")) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val   = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith("'") && val.endsWith("'")) ||
        (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    if (!key) continue;
    const cur = process.env[key];
    if (!cur) {
      process.env[key] = val;
    } else if (val.startsWith('{')) {
      try { JSON.parse(cur); } catch { process.env[key] = val; }
    }
  }
}

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.error(
    "❌  Missing env vars: GOOGLE_SHEET_ID and/or GOOGLE_SERVICE_ACCOUNT_JSON"
  );
  process.exit(1);
}

try {
  const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!creds?.client_email || !creds?.private_key) {
    throw new Error("missing client_email or private_key");
  }
} catch (err) {
  console.error(
    "❌  GOOGLE_SERVICE_ACCOUNT_JSON is invalid:",
    err instanceof Error ? err.message : String(err)
  );
  process.exit(1);
}

const SHEET_NAME = "Jobs";
// A–G: scraped fields  |  H–M: filled by generate-applications.mjs / auto-apply.mjs
const HEADERS = [
  "Company", "Title", "Location", "URL", "Category", "Fetched At", "Description",
  "Resume URL", "Cover Letter", "ATS Score", "Apply Status", "Applied At", "Notes",
];

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
    ]);
  } catch (e) {
    console.warn(`  ⚠  Workable ${slug}:`, e.message);
    return [];
  }
}

/**
 * Hiring Cafe — scrapes easy-apply software-engineer roles using Playwright.
 *
 * hiring.cafe is a client-side React/Next.js SPA, so we launch a real browser
 * and intercept the JSON API responses the frontend makes. If interception
 * yields no results (e.g. the API shape changed) we fall back to DOM parsing.
 *
 * Only jobs tagged with `applicationFormEase: "Simple"` are fetched.
 */
async function fetchHiringCafe(category = "hiring-cafe") {
  let browser;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    // ── 1. Intercept API responses ────────────────────────────────────────
    const capturedItems = [];
    page.on("response", async (response) => {
      const url   = response.url();
      const ctype = response.headers()["content-type"] ?? "";
      if (!ctype.includes("application/json")) return;
      if (!/jobs|search|listings|postings|algolia/i.test(url)) return;
      try {
        const data = await response.json();
        const arr  = data?.hits ?? data?.jobs ?? data?.results ?? data?.postings
                  ?? (Array.isArray(data) ? data : null);
        if (Array.isArray(arr) && arr.length > 0) capturedItems.push(...arr);
      } catch { /* ignore */ }
    });

    const searchState = encodeURIComponent(JSON.stringify({
      searchQuery: "software engineer",
      sortBy: "date",
      dateFetchedPastNDays: 2,
      applicationFormEase: ["Simple"],
    }));
    const searchUrl = `https://hiring.cafe/?searchState=${searchState}`;

    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 60_000 });
    // Give lazy-loaded content a moment
    await page.waitForTimeout(3_000);

    // ── 2. Try structured data from window.__NEXT_DATA__ ─────────────────
    const nextData = await page.evaluate(() => {
      try {
        const el = document.getElementById("__NEXT_DATA__");
        return el ? JSON.parse(el.textContent ?? "{}") : null;
      } catch { return null; }
    });

    /** Normalise any item shape → row */
    function toRow(item) {
      const title     = item.jobTitle    ?? item.title    ?? item.name    ?? "";
      const company   = item.companyName ?? item.company  ?? item.employer ?? "Hiring Cafe";
      const location  = item.location    ?? item.city     ?? item.locationName ?? "";
      const salary    = item.salary      ?? item.compensation ?? "";
      const skills    = Array.isArray(item.skills) ? item.skills.join(", ") : (item.skills ?? "");
      const id        = item.id ?? item.jobId ?? item._id ?? item.listingId ?? "";
      const url       = item.jobUrl ?? item.applyUrl
                     ?? (id ? `https://hiring.cafe/job/${id}` : "");
      if (!title || !url) return null;

      const salaryLine  = salary ? `Salary: ${salary}` : "";
      const skillsLine  = skills ? `Skills: ${skills}` : "";
      const description = [salaryLine, skillsLine, item.description ?? item.summary ?? ""]
        .filter(Boolean).join("\n").slice(0, 2500);

      return [company, title, location, url, "hiring-cafe", now(), description];
    }

    // Try captured API items first
    if (capturedItems.length > 0) {
      const rows = capturedItems.map(toRow).filter(Boolean);
      if (rows.length > 0) {
        const engRows = rows.filter((r) => isEngineeringRole(r[1]));
        console.log(`  ✓  Hiring Cafe: ${engRows.length} easy-apply engineering roles (API)`);
        return engRows;
      }
    }

    // Try __NEXT_DATA__
    if (nextData) {
      const pageProps = nextData?.props?.pageProps ?? {};
      const items =
        pageProps.jobs    ?? pageProps.listings ?? pageProps.postings ??
        pageProps.results ?? pageProps.hits      ?? [];
      if (Array.isArray(items) && items.length > 0) {
        const rows = items.map(toRow).filter(Boolean)
          .filter((r) => isEngineeringRole(r[1]));
        if (rows.length > 0) {
          console.log(`  ✓  Hiring Cafe: ${rows.length} easy-apply engineering roles (__NEXT_DATA__)`);
          return rows;
        }
      }
    }

    // ── 3. DOM fallback ───────────────────────────────────────────────────
    const domRows = await page.evaluate(() => {
      const results = [];

      // Every job card on hiring.cafe has exactly one link to /job/{id}
      const jobLinks = Array.from(document.querySelectorAll("a"))
        .filter((a) => /\/job\/[a-z0-9]{8,}/.test(a.getAttribute("href") ?? a.href ?? ""));

      for (const link of jobLinks) {
        const jobUrl = link.href.startsWith("http")
          ? link.href
          : `https://hiring.cafe${link.getAttribute("href")}`;

        // Walk UP to find the bounding card element
        let card = link.parentElement;
        for (let i = 0; i < 12 && card; i++) {
          const orgLinks = card.querySelectorAll('a[href*="/org/"]');
          const height   = card.getBoundingClientRect?.()?.height ?? 0;
          if (orgLinks.length >= 1 && height > 60) break;
          card = card.parentElement;
        }
        if (!card) continue;

        const cardText = (card.innerText ?? card.textContent ?? "").replace(/\s+/g, " ").trim();
        if (cardText.length < 20) continue;

        // Company (via /org/ link)
        const orgEl   = card.querySelector('a[href*="/org/"]');
        const company = orgEl?.innerText?.trim() ?? "";

        // Title: look for headings first, then longest plausible line
        let title = "";
        for (const sel of ["h1", "h2", "h3", "h4", "strong"]) {
          const el = card.querySelector(sel);
          const t  = el?.innerText?.trim() ?? "";
          if (t.length > 5 && t.length < 120) { title = t; break; }
        }
        if (!title) {
          title = cardText.split(/\s{2,}|\n/)
            .map((s) => s.trim())
            .find((s) => s.length > 6 && s.length < 100 && !/\$|,\s*United|Full Time|Part Time|Remote|Onsite|Hybrid|\bYOE\b/i.test(s)) ?? "";
        }

        // Salary
        const salary = (cardText.match(/\$[\d,]+[kKmM]?\s*[-–—]\s*\$[\d,]+[kKmM]?(?:\s*\/\s*(?:yr|year|hr))?/)?.[0] ?? "").trim();

        // Location
        const locMatch = cardText.match(
          /([A-Z][a-zA-Z ]+,\s*[A-Z][a-zA-Z ]+,\s*United States|United States|Remote|[A-Z][a-z]+ [A-Z][a-z]+,\s*[A-Z]{2})/
        );
        const location = locMatch?.[0]?.trim() ?? "";

        // Work type
        const workType = (cardText.match(/\b(Remote|Hybrid|Onsite|On-Site)\b/i)?.[0] ?? "").trim();

        if (!title || !jobUrl.includes("/job/")) continue;
        if (results.some((r) => r[3] === jobUrl)) continue; // deduplicate

        const fullLoc = [location, workType].filter(Boolean).join(" · ");
        const desc    = [salary ? `Salary: ${salary}` : "", cardText.slice(0, 1800)]
          .filter(Boolean).join("\n").slice(0, 2000);

        results.push([company || "Hiring Cafe", title.slice(0, 100), fullLoc.slice(0, 150), jobUrl, "hiring-cafe", new Date().toISOString(), desc]);
      }

      return results;
    });

    const engDomRows = domRows.filter((r) => isEngineeringRole(r[1]));
    console.log(`  ✓  Hiring Cafe: ${engDomRows.length} easy-apply engineering roles (DOM)`);
    return engDomRows;

  } catch (e) {
    console.warn("  ⚠  Hiring Cafe:", e.message);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
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
    ]).filter((r) => r[3]);
  } catch (e) {
    console.warn("  ⚠  Apple:", e.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Company definitions
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAllJobs() {
  console.log("🔍  Fetching jobs from all companies...\n");

  const tasks = [
    // ── Greenhouse — Original ────────────────────────────────────────────
    fetchGreenhouse("stubhubinc", "StubHub", "travel"),
    fetchGreenhouse("axs", "AXS", "travel"),
    fetchGreenhouse("lyft", "Lyft", "travel"),
    fetchGreenhouse("airbnb", "Airbnb", "travel"),
    fetchGreenhouse("clear", "CLEAR", "travel"),
    fetchGreenhouse("uberfreight", "Uber Freight", "travel"),

    // ── Greenhouse — SeatGeek (split by location) ────────────────────────
    fetchGreenhouse("seatgeek", "SeatGeek", "travel", (loc) => {
      if (/Remote.*United States/i.test(loc)) return "SeatGeek (Remote)";
      if (/New York/i.test(loc)) return "SeatGeek (NY)";
      return null;
    }),

    // ── Greenhouse — New tech companies ──────────────────────────────────
    fetchGreenhouse("coinbase", "Coinbase", "fintech"),
    fetchGreenhouse("doordashglobal", "DoorDash", "general"),
    fetchGreenhouse("reddit", "Reddit", "social"),
    fetchGreenhouse("figma", "Figma", "general"),
    fetchGreenhouse("discord", "Discord", "social"),
    fetchGreenhouse("dropbox", "Dropbox", "saas"),
    fetchGreenhouse("duolingo", "Duolingo", "edtech"),
    fetchGreenhouse("brex", "Brex", "general"),
    fetchAshby("plaid", "Plaid", "fintech"),     // migrated from GH 'plaid' (404) → Ashby (91 jobs)
    fetchGreenhouse("roblox", "Roblox", "gaming"),

    // ── Workday — Original ───────────────────────────────────────────────
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

    // ── Workday — New companies ───────────────────────────────────────────
    fetchWorkday(
      "expedia.wd5.myworkdayjobs.com",
      "expedia",
      "Expedia_Group_External",
      "Expedia Group",
      "travel"
    ),
    fetchWorkday(
      "hilton.wd5.myworkdayjobs.com",
      "hilton",
      "HJobs",
      "Hilton",
      "travel"
    ),

    // ── Lever ────────────────────────────────────────────────────────────
    fetchLever("yelp", "Yelp", "local"),
    fetchLever("postman", "Postman", "saas"),
    fetchLever("thumbtack", "Thumbtack", "marketplace"),

    // ── Ashby ────────────────────────────────────────────────────────────
    fetchAshby("linear", "Linear", "saas"),
    fetchAshby("replit", "Replit", "devtools"),
    fetchAshby("retool", "Retool", "saas"),

    // ── SmartRecruiters ───────────────────────────────────────────────────
    fetchSmartRecruiters("RoyalCaribbeanGroup", "Royal Caribbean Group", "travel"),

    // ── iCIMS RSS ────────────────────────────────────────────────────────
    fetchDisney(),

    // ── Booking.com — Custom REST API ─────────────────────────────────────
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

    // ── General Full Stack — Greenhouse ───────────────────────────────────
    fetchGreenhouse("snapinc",    "Snap Inc.",  "general"),
    fetchGreenhouse("stripe",     "Stripe",     "general"),
    fetchGreenhouse("databricks", "Databricks", "general"),
    fetchGreenhouse("twilio",     "Twilio",     "general"),
    fetchGreenhouse("cloudflare", "Cloudflare", "general"),
    fetchGreenhouse("datadog",    "Datadog",    "general"),
    fetchGreenhouse("mongodb",    "MongoDB",    "general"),
    fetchGreenhouse("riotgames",  "Riot Games", "general"),
    fetchGreenhouse("vercel",     "Vercel",     "general"),
    fetchGreenhouse("instacart",  "Instacart",  "general"),
    fetchGreenhouse("pinterest",  "Pinterest",  "general"),

    // ── General Full Stack — Ashby ────────────────────────────────────────
    fetchAshby("ramp",      "Ramp",      "general"),
    fetchAshby("confluent", "Confluent", "general"),
    fetchAshby("snowflake", "Snowflake", "general"),

    // ── General Full Stack — Workday ──────────────────────────────────────
    fetchWorkday(
      "adobe.wd5.myworkdayjobs.com",
      "adobe",
      "external_experienced",
      "Adobe",
      "general"
    ),
    fetchWorkday(
      "intuit.wd1.myworkdayjobs.com",
      "intuit",
      "Intuit_Careers",
      "Intuit",
      "general"
    ),
    fetchWorkday(
      "qualcomm.wd5.myworkdayjobs.com",
      "qualcomm",
      "External",
      "Qualcomm",
      "general"
    ),
    fetchWorkday(
      "paypal.wd1.myworkdayjobs.com",
      "paypal",
      "jobs",
      "PayPal",
      "general"
    ),
    fetchWorkday(
      "capitalone.wd12.myworkdayjobs.com",
      "capitalone",
      "Capital_One",
      "Capital One",
      "general"
    ),
    fetchWorkday(
      "jpmc.wd5.myworkdayjobs.com",
      "jpmc",
      "technology",
      "JPMorgan Chase",
      "general"
    ),
    fetchWorkday(
      "shopify.wd5.myworkdayjobs.com",
      "shopify",
      "Shopify",
      "Shopify",
      "general"
    ),
    fetchWorkday(
      "zendesk.wd1.myworkdayjobs.com",
      "zendesk",
      "zendesk",
      "Zendesk",
      "general"
    ),

    // ── General Full Stack — FAANG (custom adapters) ──────────────────────
    fetchAmazon("general"),
    fetchGoogle("general"),
    fetchMeta("general"),
    fetchApple("general"),

    // ── AI Agentics — Greenhouse ─────────────────────────────────────────
    fetchGreenhouse("anthropic",  "Anthropic",          "ai-agentics"),
    fetchGreenhouse("workato",    "Workato",             "ai-agentics"),
    fetchGreenhouse("celonis",    "Make (Celonis US)",   "ai-agentics"),
    fetchGreenhouse("gleanwork",          "Glean",               "ai-agentics"),
    fetchGreenhouse("moveworks",          "Moveworks",           "ai-agentics"),
    fetchGreenhouse("weights_and_biases", "Weights & Biases",    "ai-agentics"), // 'wandb' returns 404
    fetchGreenhouse("codeium",            "Codeium / Windsurf",  "ai-agentics"),

    // ── AI Agentics — Ashby ──────────────────────────────────────────────
    fetchAshby("openai",     "OpenAI",          "ai-agentics"),
    fetchAshby("cursor",     "Cursor",           "ai-agentics"),
    fetchAshby("notion",     "Notion",           "ai-agentics"),
    fetchAshby("zapier",     "Zapier",           "ai-agentics"),
    fetchAshby("langchain",  "LangChain",        "ai-agentics"),
    fetchAshby("cohere",     "Cohere",           "ai-agentics"),
    fetchAshby("mistral",    "Mistral AI",       "ai-agentics"),
    fetchAshby("hebbia-ai",  "Hebbia",           "ai-agentics"),
    fetchAshby("harvey",     "Harvey AI",        "ai-agentics"),
    fetchAshby("sierra",     "Sierra AI",        "ai-agentics"),
    fetchAshby("ema",        "Ema",              "ai-agentics"),
    fetchAshby("adept",      "Adept AI",         "ai-agentics"),
    fetchAshby("cognition",  "Cognition AI",     "ai-agentics"),
    fetchAshby("dust",       "Dust.tt",          "ai-agentics"),
    fetchAshby("linear",     "Linear",           "ai-agentics"),
    fetchAshby("retool",     "Retool",           "ai-agentics"),
    fetchAshby("writer",     "Writer",           "ai-agentics"),
    fetchAshby("runwayml",   "Runway ML",        "ai-agentics"),
    fetchAshby("pathosai",   "Pathos AI",        "ai-agentics"),
    fetchAshby("slack",      "Slack",            "ai-agentics"),

    // ── AI Agentics — Workday ─────────────────────────────────────────────
    fetchWorkday(
      "salesforce.wd12.myworkdayjobs.com",
      "salesforce",
      "External_Career_Site",
      "Salesforce",
      "ai-agentics"
    ),
    fetchWorkday(
      "microsoft.wd3.myworkdayjobs.com",
      "microsoft",
      "External",
      "Microsoft",
      "ai-agentics"
    ),
    fetchWorkday(
      "servicenow.wd5.myworkdayjobs.com",
      "servicenow",
      "External",
      "ServiceNow",
      "ai-agentics"
    ),

    // ── Hiring Cafe — easy-apply aggregator (Playwright) ─────────────────
    fetchHiringCafe("hiring-cafe"),
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

  // Always sync headers (A–M, 13 columns)
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A1:M1`,
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
    return [];
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
 * Move rows older than 2 days from the Jobs sheet to an "Old Jobs" archive
 * sheet. Creates the archive sheet automatically if it does not yet exist.
 */
async function archiveOldJobs(sheets) {
  const ARCHIVE_SHEET = "Old Jobs";
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

  try {
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A:G`,
    });
    const rows = resp.data.values ?? [];
    if (rows.length <= 1) return; // headers only

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const now = Date.now();

    const oldRows = [];
    const keepRows = [];
    for (const row of dataRows) {
      const fetchedAt = row[5] ?? "";
      const age = fetchedAt ? now - new Date(fetchedAt).getTime() : Infinity;
      if (age > TWO_DAYS_MS) {
        oldRows.push(row);
      } else {
        keepRows.push(row);
      }
    }

    if (oldRows.length === 0) {
      console.log("🗂️   No old jobs to archive");
      return;
    }

    // Ensure archive sheet exists
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
        range: `${ARCHIVE_SHEET}!A1:G1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
      console.log(`📄  Created archive sheet "${ARCHIVE_SHEET}"`);
    }

    // Append old rows to archive
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${ARCHIVE_SHEET}!A:G`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: oldRows },
    });

    // Rewrite Jobs sheet with headers + recent rows only
    await sheets.spreadsheets.values.clear({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A:G`,
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers, ...keepRows] },
    });

    console.log(`🗂️   Archived ${oldRows.length} jobs → "${ARCHIVE_SHEET}" | ${keepRows.length} remain in Jobs`);
  } catch (err) {
    console.warn("⚠️   Archive failed:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const [jobs, sheets] = await Promise.all([fetchAllJobs(), getSheets()]);
  await ensureSheetAndHeaders(sheets);
  await archiveOldJobs(sheets);       // archive 2+ day old jobs first
  await migrateLegacyCompanyNames(sheets);
  const newJobRows = await writeNewJobs(sheets, jobs);
  await backfillDescriptions(sheets);
  await sendWhatsAppNotification(newJobRows);
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
