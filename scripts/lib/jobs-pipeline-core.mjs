/**
 * Unified Hiring Cafe jobs pipeline — scrape, ATS, verify, tailor.
 * Used by run-jobs-pipeline.mjs (cron) and thin legacy entrypoints.
 */

import { recordScrapeResult } from "./scrape-log.mjs";
import { APPLY_NOW_WINDOW_MS } from "./hiring-cafe.mjs";
import { scrapeAllHiringCafeJobs } from "./hiring-cafe-scraper.mjs";
import {
  compactJobsSheet,
  filterNewHcJobs,
  loadSheetDedupSets,
  refreshDiscoveredAt,
} from "./hiring-cafe-sheet-sync.mjs";
import {
  backfillHcDescriptionsOnSheet,
  scoreHcJobsOnSheet,
} from "./hiring-cafe-ats.mjs";
import { verifyAtsComplianceOnSheet } from "./hiring-cafe-verify.mjs";
import {
  resetExhaustedTailorAttemptsOnSheet,
  tailorLowAtsJobsOnSheet,
} from "./hiring-cafe-tailor.mjs";

const COMPANY = "Hiring Cafe";

/**
 * @param {object} [options]
 * @param {boolean} [options.scrape=true] — fetch HC + sheet ingest
 * @param {boolean} [options.tailor=true] — parallel resume tailoring
 * @param {boolean} [options.dryRun=false]
 * @param {boolean} [options.resetTailorAttempts=false] — zero column U for retry-eligible rows
 * @param {number} [options.tailorLimit] — jobs per tailor pass (env HC_TAILOR_BATCH_LIMIT)
 * @param {number} [options.tailorConcurrency] — parallel workers (env HC_TAILOR_CONCURRENCY)
 */
export async function runJobsPipeline(options = {}) {
  const dryRun = options.dryRun ?? process.env.DRY_RUN === "true";
  const scrape = options.scrape !== false;
  const tailor = options.tailor !== false;
  const resetTailorAttempts = options.resetTailorAttempts === true;
  const tailorLimit =
    options.tailorLimit ?? Number(process.env.HC_TAILOR_BATCH_LIMIT) || 30;
  const tailorConcurrency =
    options.tailorConcurrency ?? Number(process.env.HC_TAILOR_CONCURRENCY) || 5;

  const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const sj = await import("../scrape-jobs.mjs");
  const scrapedAt = new Date().toISOString();

  const summary = {
    scrapedAt,
    fetched: 0,
    refreshed: 0,
    newJobs: 0,
    dupesRemoved: 0,
    descriptionsBackfilled: 0,
    atsScored: 0,
    verify: { checked: 0, requeued: 0, cleared: 0 },
    tailor: { processed: 0, reached: 0 },
    beforeCount: 0,
    phases: [],
  };

  if (scrape) {
    console.log(`\n☕  Jobs pipeline — scrape phase — ${scrapedAt}\n`);
    const jobs = await scrapeAllHiringCafeJobs(sj.isEngineeringRole);
    const normalized = jobs.map(sj.normalizeScrapeRow);
    summary.fetched = normalized.length;

    if (dryRun) {
      console.log(`🏃  DRY_RUN: fetched ${normalized.length} jobs (no sheet writes)`);
      summary.phases.push("scrape-dry-run");
      if (!tailor) return summary;
    } else {
      const sheets = await sj.getSheets();
      await sj.ensureSheetAndHeaders(sheets);

      const jobsDedup = await loadSheetDedupSets(sheets, GOOGLE_SHEET_ID, sj.SHEET_NAME);
      const archiveDedup = await loadSheetDedupSets(sheets, GOOGLE_SHEET_ID, "Old Jobs");
      const knownKeys = new Set([...jobsDedup.keys, ...archiveDedup.keys]);
      const knownRoleKeys = new Set([...jobsDedup.roleKeys, ...archiveDedup.roleKeys]);
      summary.beforeCount = jobsDedup.keys.size;

      summary.refreshed = await refreshDiscoveredAt(
        sheets,
        GOOGLE_SHEET_ID,
        sj.SHEET_NAME,
        normalized,
        scrapedAt
      );
      await sj.syncPostedAt(sheets, normalized);

      summary.dupesRemoved = await compactJobsSheet(sheets, GOOGLE_SHEET_ID, sj.SHEET_NAME);

      const newJobs = filterNewHcJobs(normalized, knownKeys, knownRoleKeys);
      const newJobRows = await sj.writeNewJobs(sheets, newJobs);
      summary.newJobs = newJobRows.length;

      summary.descriptionsBackfilled = await backfillHcDescriptionsOnSheet(
        sheets,
        GOOGLE_SHEET_ID
      );
      summary.atsScored = await scoreHcJobsOnSheet(sheets, GOOGLE_SHEET_ID);
      summary.verify = await verifyAtsComplianceOnSheet(sheets, GOOGLE_SHEET_ID);

      if (tailor) {
        if (resetTailorAttempts) {
          await resetExhaustedTailorAttemptsOnSheet(sheets, GOOGLE_SHEET_ID);
        }
        summary.tailor = await tailorLowAtsJobsOnSheet(sheets, GOOGLE_SHEET_ID, {
          limit: tailorLimit,
          concurrency: tailorConcurrency,
        });
      }

      await sj.archiveOldJobs(sheets, { maxAgeMs: APPLY_NOW_WINDOW_MS });

      await recordScrapeResult(sheets, GOOGLE_SHEET_ID, {
        company: COMPANY,
        scrapedAt,
        jobsFound: normalized.length,
        newJobs: newJobRows.length,
        removedJobs: summary.dupesRemoved,
        status: "OK",
        notes:
          `HC US · pages 1-5 · refreshed ${summary.refreshed} · dupes ${summary.dupesRemoved} · ` +
          `desc ${summary.descriptionsBackfilled} · ATS ${summary.atsScored} · ` +
          `verify ${summary.verify.checked}/${summary.verify.requeued} re-queued · ` +
          `tailor ${summary.tailor.processed} processed / ${summary.tailor.reached} saved · ` +
          `window ${APPLY_NOW_WINDOW_MS / 3_600_000}h`,
      });

      if (newJobRows.length > 0) {
        await sj.sendWhatsAppNotification?.(newJobRows);
      }

      summary.phases.push("scrape");
      if (tailor) summary.phases.push("tailor");
    }
  } else if (tailor && !dryRun) {
    console.log(`\n✍️  Jobs pipeline — tailor-only phase — ${scrapedAt}\n`);
    const sheets = await sj.getSheets();
    await sj.ensureSheetAndHeaders(sheets);

    if (resetTailorAttempts) {
      await resetExhaustedTailorAttemptsOnSheet(sheets, GOOGLE_SHEET_ID);
    }
    summary.tailor = await tailorLowAtsJobsOnSheet(sheets, GOOGLE_SHEET_ID, {
      limit: tailorLimit,
      concurrency: tailorConcurrency,
    });
    summary.phases.push("tailor-only");
  }

  logSummary(summary, { scrape, tailor });
  return summary;
}

function logSummary(summary, { scrape, tailor }) {
  const parts = [];
  if (scrape) {
    parts.push(
      `${summary.fetched} fetched`,
      `${summary.refreshed} refreshed`,
      `${summary.newJobs} new`,
      `${summary.dupesRemoved} dupes`,
      `${summary.descriptionsBackfilled} desc`,
      `${summary.atsScored} ATS`,
      `verify ${summary.verify.checked} checked / ${summary.verify.requeued} re-queued`
    );
  }
  if (tailor) {
    parts.push(
      `tailor ${summary.tailor.processed} processed / ${summary.tailor.reached} saved`
    );
  }
  console.log(`\n📊  Pipeline done: ${parts.join(" | ")}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
}
