#!/usr/bin/env node
/**
 * Hiring Cafe–only job pipeline (default for GHA + local loops).
 *
 * Flow each run (~10 min):
 *   1. Scrape ALL HC engineering jobs (department search, full pagination)
 *   2. Archive Jobs tab rows older than 6h → Old Jobs
 *   3. Append only NEW jobs (dedup by apply URL / HC job id vs Jobs + Old Jobs)
 *   4. Log to Scrape Log + optional WhatsApp for new discoveries
 *
 * Local loop (every 10 min):
 *   while true; do
 *     node scripts/run-hiring-cafe-pipeline.mjs
 *     sleep 600
 *   done
 *
 * Dry run:
 *   DRY_RUN=true node scripts/run-hiring-cafe-pipeline.mjs
 */

import { pathToFileURL } from "url";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";
import { recordScrapeResult } from "./lib/scrape-log.mjs";
import { APPLY_NOW_WINDOW_MS, getJobDedupKey } from "./lib/hiring-cafe.mjs";
import { scrapeAllHiringCafeJobs } from "./lib/hiring-cafe-scraper.mjs";

loadEnvLocal();
validatePipelineEnv("scrape");

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const DRY_RUN = process.env.DRY_RUN === "true";
const COMPANY = "Hiring Cafe";

async function loadKnownDedupKeys(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${sheetName}!D2:D`,
  });
  const keys = new Set();
  for (const row of res.data.values ?? []) {
    const url = row[0] ?? "";
    if (!url) continue;
    keys.add(getJobDedupKey([null, null, null, url]));
  }
  return keys;
}

async function main() {
  const sj = await import("./scrape-jobs.mjs");
  const scrapedAt = new Date().toISOString();

  console.log(`\n☕  Hiring Cafe pipeline — ${scrapedAt}\n`);

  const jobs = await scrapeAllHiringCafeJobs(sj.isEngineeringRole);
  const normalized = jobs.map(sj.normalizeScrapeRow);

  if (DRY_RUN) {
    console.log(`🏃  DRY_RUN: fetched ${normalized.length} jobs (no sheet writes)`);
    process.exit(0);
  }

  const sheets = await sj.getSheets();
  await sj.ensureSheetAndHeaders(sheets);

  const jobsKeys = await loadKnownDedupKeys(sheets, sj.SHEET_NAME);
  const archiveKeys = await loadKnownDedupKeys(sheets, "Old Jobs");
  const knownKeys = new Set([...jobsKeys, ...archiveKeys]);

  const beforeCount = jobsKeys.size;

  await sj.archiveOldJobs(sheets, { maxAgeMs: APPLY_NOW_WINDOW_MS });
  await sj.syncPostedAt(sheets, normalized);

  const newJobs = normalized.filter((row) => {
    const key = getJobDedupKey(row);
    return key && !knownKeys.has(key);
  });

  const newJobRows = await sj.writeNewJobs(sheets, newJobs);

  await recordScrapeResult(sheets, GOOGLE_SHEET_ID, {
    company: COMPANY,
    scrapedAt,
    jobsFound: normalized.length,
    newJobs: newJobRows.length,
    removedJobs: 0,
    status: "OK",
    notes: `HC-only · apply-now window ${APPLY_NOW_WINDOW_MS / 3_600_000}h`,
  });

  if (newJobRows.length > 0) {
    await sj.sendWhatsAppNotification?.(newJobRows);
  }

  console.log(
    `\n📊  HC pipeline: ${normalized.length} fetched | ${newJobRows.length} new | ${beforeCount} in apply-now window`
  );
  console.log(`═══════════════════════════════════════════════════════════\n`);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("❌  HC pipeline failed:", err.message);
    process.exit(1);
  });
}
