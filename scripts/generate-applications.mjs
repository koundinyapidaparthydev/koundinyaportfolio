#!/usr/bin/env node
/**
 * generate-applications.mjs
 *
 * Reads all jobs from the Google Sheet that don't yet have a tailored resume,
 * calls the portfolio's internal API to generate + store each one, then writes
 * the results (resume URL, cover letter, ATS score, apply status) back to the
 * sheet.
 *
 * Sheet columns (A-M):
 *   A Company | B Title | C Location | D URL | E Category | F Fetched At
 *   G Description | H Resume URL | I Cover Letter | J ATS Score
 *   K Apply Status | L Applied At | M Notes
 *
 * Required env vars:
 *   GOOGLE_SHEET_ID              – target sheet
 *   GOOGLE_SERVICE_ACCOUNT_JSON  – service account with Sheets editor access
 *   INTERNAL_API_KEY             – shared secret for the generate-and-store endpoint
 *   PORTFOLIO_BASE_URL           – e.g. https://koundinyapidaparhty.vercel.app
 *
 * Optional:
 *   ATS_THRESHOLD                – minimum ATS score to mark as "pending" (default 40)
 *   MAX_CONCURRENT               – max parallel Claude calls (default 2, keep low to avoid rate limits)
 */

import { google } from "googleapis";

const GOOGLE_SHEET_ID             = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const INTERNAL_API_KEY            = process.env.INTERNAL_API_KEY;
const PORTFOLIO_BASE_URL          = process.env.PORTFOLIO_BASE_URL ?? "https://koundinyapidaparhty.vercel.app";
const ATS_THRESHOLD               = parseInt(process.env.ATS_THRESHOLD ?? "40", 10);
const MAX_CONCURRENT              = parseInt(process.env.MAX_CONCURRENT ?? "2", 10);

const SHEET_NAME = "Jobs";

// Column indices (0-based)
const COL = {
  COMPANY:       0,  // A
  TITLE:         1,  // B
  LOCATION:      2,  // C
  URL:           3,  // D
  CATEGORY:      4,  // E
  FETCHED_AT:    5,  // F
  DESCRIPTION:   6,  // G
  RESUME_URL:    7,  // H
  COVER_LETTER:  8,  // I
  ATS_SCORE:     9,  // J
  APPLY_STATUS: 10,  // K
  APPLIED_AT:   11,  // L
  NOTES:        12,  // M
};

if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.error("❌  Missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON");
  process.exit(1);
}
if (!INTERNAL_API_KEY) {
  console.error("❌  Missing INTERNAL_API_KEY");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Pause to avoid hitting Claude rate limits */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run async tasks with bounded concurrency.
 */
async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let qi = 0;
  async function worker() {
    while (qi < items.length) {
      const i = qi++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheets client
// ─────────────────────────────────────────────────────────────────────────────

async function getSheets() {
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/**
 * Ensure the sheet has all 13 column headers (A–M).
 */
async function ensureExtendedHeaders(sheets) {
  const HEADERS = [
    "Company", "Title", "Location", "URL", "Category", "Fetched At", "Description",
    "Resume URL", "Cover Letter", "ATS Score", "Apply Status", "Applied At", "Notes",
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A1:M1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS] },
  });
}

/**
 * Fetch all data rows (skipping header).
 * Returns an array of { rowIndex, values } where rowIndex is 1-based (for Sheets API).
 */
async function getAllRows(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A2:M`,
  });
  const rows = res.data.values ?? [];
  return rows.map((values, i) => ({
    rowIndex: i + 2, // 1-based, skip header → first data row is row 2
    values,
  }));
}

/**
 * Update a single row in the sheet (columns H–M = indices 8–13).
 * @param {number} rowIndex 1-based row number in the sheet
 */
async function updateRow(sheets, rowIndex, { resumeUrl, coverLetter, atsScore, applyStatus, notes }) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!H${rowIndex}:M${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        resumeUrl    ?? "",
        coverLetter  ?? "",
        atsScore     ?? "",
        applyStatus  ?? "pending",
        "",          // Applied At — filled by auto-apply script
        notes        ?? "",
      ]],
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: call the portfolio API for one job
// ─────────────────────────────────────────────────────────────────────────────

async function generateForJob({ rowIndex, values }) {
  const company     = values[COL.COMPANY]     ?? "";
  const title       = values[COL.TITLE]       ?? "";
  const description = values[COL.DESCRIPTION] ?? "";
  const jobUrl      = values[COL.URL]         ?? "";

  const label = `${company} — ${title}`;

  // Skip if already generated
  if (values[COL.RESUME_URL]) {
    console.log(`  ⏭  Skipped (already has resume): ${label}`);
    return null;
  }

  // Skip if no description (can't tailor without it)
  if (!description || description.length < 50) {
    console.log(`  ⚠  Skipped (no description): ${label}`);
    return null;
  }

  console.log(`  🤖 Generating resume for: ${label}`);

  try {
    const res = await fetch(`${PORTFOLIO_BASE_URL}/api/internal/generate-and-store`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": INTERNAL_API_KEY,
      },
      body: JSON.stringify({ company, title, description, jobUrl }),
      // 90s timeout to account for Claude + PDF render + GCS
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`  ❌ API error ${res.status} for ${label}: ${text.slice(0, 200)}`);
      return { rowIndex, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    const applyStatus = data.atsScore >= ATS_THRESHOLD ? "pending" : "low-ats";

    console.log(`  ✅ Done: ${label} | ATS: ${data.atsScore} | Status: ${applyStatus}`);

    return { rowIndex, ...data, applyStatus };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ Failed: ${label} — ${msg}`);
    return { rowIndex, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📄  Generate Applications — starting\n");

  const sheets = await getSheets();
  await ensureExtendedHeaders(sheets);

  const allRows = await getAllRows(sheets);
  const unprocessed = allRows.filter(
    (r) => !r.values[COL.RESUME_URL] && (r.values[COL.DESCRIPTION]?.length ?? 0) >= 50
  );

  console.log(`Found ${allRows.length} total rows, ${unprocessed.length} need resume generation\n`);

  if (unprocessed.length === 0) {
    console.log("✅  All jobs already have resumes — nothing to do");
    return;
  }

  // Add a small delay between batches to respect Claude's rate limits
  const results = [];
  for (let i = 0; i < unprocessed.length; i += MAX_CONCURRENT) {
    const batch = unprocessed.slice(i, i + MAX_CONCURRENT);
    const batchResults = await mapConcurrent(batch, MAX_CONCURRENT, generateForJob);
    results.push(...batchResults);

    if (i + MAX_CONCURRENT < unprocessed.length) {
      console.log(`  ⏳ Waiting 5s before next batch...`);
      await delay(5000);
    }
  }

  // Write all successful results back to the sheet
  const successes = results.filter((r) => r && !r.error);
  for (const result of successes) {
    await updateRow(sheets, result.rowIndex, {
      resumeUrl:   result.resumeUrl,
      coverLetter: result.coverLetterText,
      atsScore:    result.atsScore,
      applyStatus: result.applyStatus,
      notes:       result.missing?.slice(0, 5).join(", ") ?? "",
    });
  }

  const failed = results.filter((r) => r && r.error);

  console.log(`\n📊  Summary`);
  console.log(`  ✅ Generated: ${successes.length}`);
  console.log(`  ❌ Failed:    ${failed.length}`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`     - Row ${f.rowIndex}: ${f.error}`));
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
