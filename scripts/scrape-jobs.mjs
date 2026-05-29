#!/usr/bin/env node
/**
 * Job scraper — fetches engineering roles from each company and writes to Google Sheets.
 *
 * Required env vars:
 *   GOOGLE_SHEET_ID              — ID of the target Google Sheet
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — full service-account JSON as a string
 *
 * Supported ATS adapters:
 *   - Greenhouse public API (StubHub, AXS, Lyft, Airbnb, Flywire, CLEAR)
 *   - Workday public REST API (Live Nation, Sabre, NCL, SeaWorld)
 *   - Lever public API (SeatGeek)
 *   - Custom fetch adapters (Booking.com, Royal Caribbean, Disney, Universal, Uber)
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
const HEADERS = ["Company", "Title", "Location", "URL", "Category", "Fetched At"];

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

// ─────────────────────────────────────────────────────────────────────────────
// ATS Adapters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Greenhouse public jobs API
 * @see https://developers.greenhouse.io/job-board.html
 */
async function fetchGreenhouse(boardSlug, company, category) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardSlug}/jobs`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" },
    });
    if (!res.ok) {
      console.warn(`  ⚠  Greenhouse ${boardSlug}: HTTP ${res.status}`);
      return [];
    }
    const { jobs = [] } = await res.json();
    const filtered = jobs.filter((j) => isEngineeringRole(j.title));
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
 * Workday's unofficial public REST API (used by their own frontend)
 * Pattern: POST https://{host}/wday/cxs/{tenant}/{site}/jobs
 */
async function fetchWorkday(host, tenant, site, company, category, searchText = "engineer") {
  const url = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
  try {
    const res = await fetch(url, {
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
    const res = await fetch(url, {
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
    const res = await fetch(url, {
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
    fetchGreenhouse("flywire", "Flywire", "travel"),
    fetchGreenhouse("clearme", "CLEAR", "travel"),

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

    // ── Lever ────────────────────────────────────────────────────────
    fetchLever("seatgeek", "SeatGeek", "travel"),

    // ── SmartRecruiters ──────────────────────────────────────────────
    fetchSmartRecruiters("RoyalCaribbeanGroup", "Royal Caribbean Group", "travel"),

    // ── Booking.com — uses a public REST API ────────────────────────
    (async () => {
      try {
        const res = await fetch(
          "https://jobs.booking.com/api/jobs?categories=Engineering&location=United+States&page=1",
          { headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        const jobs = data.jobs ?? data.results ?? [];
        const filtered = jobs.filter((j) =>
          isEngineeringRole(j.title ?? j.name ?? "")
        );
        console.log(`  ✓  Booking.com: ${filtered.length} engineering roles`);
        return filtered.map((j) => [
          "Booking.com",
          j.title ?? j.name ?? "",
          j.location ?? j.city ?? "",
          j.url ?? `https://jobs.booking.com/booking/jobs/${j.id}`,
          "travel",
          now(),
        ]);
      } catch (e) {
        console.warn("  ⚠  Booking.com:", e.message);
        return [];
      }
    })(),

    // ── Disney — iCIMS-based ATS ─────────────────────────────────────
    (async () => {
      try {
        const res = await fetch(
          "https://jobs.disneycareers.com/search-jobs/results?ActiveFacetID=17189&RecordsPerReq=25&CurrentPage=0&sortColumn=referencedate&sortDirection=desc&SearchResultsModuleName=Search+Results",
          { headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        const jobs = data.Jobs ?? data.jobs ?? [];
        const filtered = jobs.filter((j) =>
          isEngineeringRole(j.JobTitle ?? j.title ?? "")
        );
        console.log(`  ✓  Disney: ${filtered.length} engineering roles`);
        return filtered.map((j) => [
          "Disney",
          j.JobTitle ?? j.title ?? "",
          j.PostedLocation ?? j.location ?? "",
          j.DetailUrl
            ? `https://jobs.disneycareers.com${j.DetailUrl}`
            : "https://jobs.disneycareers.com",
          "travel",
          now(),
        ]);
      } catch (e) {
        console.warn("  ⚠  Disney:", e.message);
        return [];
      }
    })(),

    // ── Universal Studios (NBCUniversal) — Phenom People ATS ────────
    (async () => {
      try {
        const res = await fetch(
          "https://jobs.nbcunicareers.com/api/apply/v2/jobs?domain=nbcunicareers.com&start=0&num=25&exclude_pid=&f[]=IT%20%26%20Technology",
          { headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        const jobs = data.positions ?? data.jobs ?? [];
        const filtered = jobs.filter((j) =>
          isEngineeringRole(j.name ?? j.title ?? "")
        );
        console.log(`  ✓  Universal Studios: ${filtered.length} engineering roles`);
        return filtered.map((j) => [
          "Universal Studios",
          j.name ?? j.title ?? "",
          j.t_update ?? j.location ?? "",
          j.canonicalPositionUrl ??
            `https://jobs.nbcunicareers.com/${j.id}`,
          "travel",
          now(),
        ]);
      } catch (e) {
        console.warn("  ⚠  Universal Studios:", e.message);
        return [];
      }
    })(),

    // ── Uber — custom jobs API ────────────────────────────────────────
    (async () => {
      try {
        const res = await fetch(
          "https://api.uber.com/v1/jobs/search?department=Engineering&country=United+States&pageSize=25",
          { headers: { "User-Agent": "JobScraper/1.0 (portfolio automation)" } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        const jobs = data.results ?? data.jobs ?? [];
        const filtered = jobs.filter((j) =>
          isEngineeringRole(j.title ?? j.name ?? "")
        );
        console.log(`  ✓  Uber: ${filtered.length} engineering roles`);
        return filtered.map((j) => [
          "Uber",
          j.title ?? j.name ?? "",
          j.location ?? "",
          j.url ?? `https://www.uber.com/careers/${j.id}`,
          "travel",
          now(),
        ]);
      } catch (e) {
        console.warn("  ⚠  Uber:", e.message);
        return [];
      }
    })(),
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
    // Write header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
    console.log(`📄  Created sheet "${SHEET_NAME}" with headers`);
  }
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

  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A:F`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: deduped },
  });

  console.log(`✅  Added ${deduped.length} new jobs to Google Sheets`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const [jobs, sheets] = await Promise.all([fetchAllJobs(), getSheets()]);
  await ensureSheetAndHeaders(sheets);
  await writeNewJobs(sheets, jobs);
}

main().catch((err) => {
  console.error("💥  Scraper crashed:", err);
  process.exit(1);
});
