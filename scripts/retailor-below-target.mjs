#!/usr/bin/env node
/**
 * Re-tailor all non-applied jobs below 87% ATS with >= 3 skill overlap.
 *
 *   node scripts/retailor-below-target.mjs
 *   HC_TAILOR_BATCH_LIMIT=20 node scripts/retailor-below-target.mjs
 */

import { pathToFileURL } from "url";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";
import { retailorAllBelowTargetOnSheet } from "./lib/hiring-cafe-tailor.mjs";

loadEnvLocal();
validatePipelineEnv("scrape");

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function main() {
  const sj = await import("./scrape-jobs.mjs");
  const sheets = await sj.getSheets();
  await sj.ensureSheetAndHeaders(sheets);
  const limit = Number(process.env.HC_TAILOR_BATCH_LIMIT) || 50;
  const reached = await retailorAllBelowTargetOnSheet(sheets, GOOGLE_SHEET_ID, { limit });
  console.log(`\nDone — ${reached} job(s) now at 87%+ ATS.\n`);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("❌  Retailor failed:", err.message);
    process.exit(1);
  });
}
