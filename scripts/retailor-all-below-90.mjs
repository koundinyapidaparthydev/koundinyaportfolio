#!/usr/bin/env node
/**
 * One-time backfill: re-tailor all eligible jobs below 90% ATS.
 *
 *   npm run job:retailor:all
 *   HC_TAILOR_BATCH_LIMIT=999 HC_TAILOR_CONCURRENCY=5 npm run job:retailor:all
 */

import { pathToFileURL } from "url";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";
import {
  resetExhaustedTailorAttemptsOnSheet,
  retailorAllBelowTargetOnSheet,
} from "./lib/hiring-cafe-tailor.mjs";

loadEnvLocal();
validatePipelineEnv("scrape");

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function main() {
  const sj = await import("./scrape-jobs.mjs");
  const sheets = await sj.getSheets();
  await sj.ensureSheetAndHeaders(sheets);

  const limit = Number(process.env.HC_TAILOR_BATCH_LIMIT) || 999;
  const concurrency = Number(process.env.HC_TAILOR_CONCURRENCY) || 30;

  console.log(
    `\n🔄  Retailor all below 90% — batch ${limit}, concurrency ${concurrency}\n`
  );

  await resetExhaustedTailorAttemptsOnSheet(sheets, GOOGLE_SHEET_ID);
  const result = await retailorAllBelowTargetOnSheet(sheets, GOOGLE_SHEET_ID, {
    limit,
    concurrency,
    resetAttempts: false,
  });

  console.log(
    `\nDone — ${result.processed} processed, ${result.reached} saved (90%+ or best effort after 2 tries).\n`
  );
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("❌  Retailor-all failed:", err.message);
    process.exit(1);
  });
}
