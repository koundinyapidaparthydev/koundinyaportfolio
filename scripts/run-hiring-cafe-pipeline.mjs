#!/usr/bin/env node
/**
 * Hiring Cafe–only job pipeline (default for GHA + local loops).
 *
 * Flow each run (~10 min):
 *   1. Scrape ALL HC US engineering jobs (department search, full pagination)
 *   2. Refresh discovered-at (column F) for jobs still on the board
 *   3. Backfill posted-at, compact duplicate rows (HC id + company/title)
 *   4. Append only NEW jobs (dedup vs Jobs + Old Jobs)
 *   5. Backfill full descriptions + ATS score vs resume (Gemini)
 *   6. Verify all eligible rows vs 90% target; re-queue below 90%
 *   7. Quick tailor batch (5 jobs) for rows still below 90%
 *   8. Archive Jobs tab rows older than 12h → Old Jobs
 *   9. Log to Scrape Log + optional WhatsApp for new discoveries
 *
 * Bulk parallel tailoring runs in tailor-jobs.yml (every 5 min).
 *
 * Local loop (dev only — production uses GHA):
 *   ALLOW_LOCAL_PIPELINE_LOOP=1 npm run job:pipeline:loop
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
import {
  compactJobsSheet,
  filterNewHcJobs,
  loadSheetDedupSets,
  refreshDiscoveredAt,
} from "./lib/hiring-cafe-sheet-sync.mjs";
import {
  backfillHcDescriptionsOnSheet,
  scoreHcJobsOnSheet,
} from "./lib/hiring-cafe-ats.mjs";
import { verifyAtsComplianceOnSheet } from "./lib/hiring-cafe-verify.mjs";
import { tailorLowAtsJobsOnSheet } from "./lib/hiring-cafe-tailor.mjs";

loadEnvLocal();
validatePipelineEnv("scrape");

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const DRY_RUN = process.env.DRY_RUN === "true";
const COMPANY = "Hiring Cafe";

async function loadKnownDedupKeys(sheets, sheetName) {
  const { keys } = await loadSheetDedupSets(sheets, GOOGLE_SHEET_ID, sheetName);
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

  const jobsDedup = await loadSheetDedupSets(sheets, GOOGLE_SHEET_ID, sj.SHEET_NAME);
  const archiveDedup = await loadSheetDedupSets(sheets, GOOGLE_SHEET_ID, "Old Jobs");
  const knownKeys = new Set([...jobsDedup.keys, ...archiveDedup.keys]);
  const knownRoleKeys = new Set([...jobsDedup.roleKeys, ...archiveDedup.roleKeys]);

  const beforeCount = jobsDedup.keys.size;

  const refreshed = await refreshDiscoveredAt(
    sheets,
    GOOGLE_SHEET_ID,
    sj.SHEET_NAME,
    normalized,
    scrapedAt
  );
  await sj.syncPostedAt(sheets, normalized);

  const dupesRemoved = await compactJobsSheet(sheets, GOOGLE_SHEET_ID, sj.SHEET_NAME);

  const newJobs = filterNewHcJobs(normalized, knownKeys, knownRoleKeys);
  const newJobRows = await sj.writeNewJobs(sheets, newJobs);

  const descriptionsBackfilled = await backfillHcDescriptionsOnSheet(sheets, GOOGLE_SHEET_ID);
  const atsScored = await scoreHcJobsOnSheet(sheets, GOOGLE_SHEET_ID);
  const verifyResult = await verifyAtsComplianceOnSheet(sheets, GOOGLE_SHEET_ID);
  const tailorResult = await tailorLowAtsJobsOnSheet(sheets, GOOGLE_SHEET_ID);

  await sj.archiveOldJobs(sheets, { maxAgeMs: APPLY_NOW_WINDOW_MS });

  await recordScrapeResult(sheets, GOOGLE_SHEET_ID, {
    company: COMPANY,
    scrapedAt,
    jobsFound: normalized.length,
    newJobs: newJobRows.length,
    removedJobs: dupesRemoved,
    status: "OK",
    notes:
      `HC US · pages 1-${5} · refreshed ${refreshed} · dupes ${dupesRemoved} · ` +
      `desc ${descriptionsBackfilled} · ATS ${atsScored} · ` +
      `verify ${verifyResult.checked}/${verifyResult.requeued} re-queued · ` +
      `tailor ${tailorResult.processed} processed / ${tailorResult.reached} at 90%+ · ` +
      `window ${APPLY_NOW_WINDOW_MS / 3_600_000}h`,
  });

  if (newJobRows.length > 0) {
    await sj.sendWhatsAppNotification?.(newJobRows);
  }

  console.log(
    `\n📊  HC pipeline: ${normalized.length} fetched | ${refreshed} refreshed | ${newJobRows.length} new | ${dupesRemoved} dupes | ${descriptionsBackfilled} desc | ${atsScored} ATS | verify ${verifyResult.checked} checked / ${verifyResult.requeued} re-queued | tailor ${tailorResult.processed} processed / ${tailorResult.reached} at 90%+ | ${beforeCount} in sheet before`
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
