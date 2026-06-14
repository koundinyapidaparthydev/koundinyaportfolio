#!/usr/bin/env node
/**
 * Dedicated parallel tailor pipeline (runs every 5 min via tailor-jobs.yml).
 *
 *   node scripts/run-tailor-pipeline.mjs
 */

import { pathToFileURL } from "url";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";
import {
  resetExhaustedTailorAttemptsOnSheet,
  tailorLowAtsJobsOnSheet,
} from "./lib/hiring-cafe-tailor.mjs";

loadEnvLocal();
validatePipelineEnv("scrape");

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function main() {
  const sj = await import("./scrape-jobs.mjs");
  const sheets = await sj.getSheets();
  await sj.ensureSheetAndHeaders(sheets);

  console.log("\n✍️  Tailor pipeline — parallel 90% ATS tailoring\n");

  await resetExhaustedTailorAttemptsOnSheet(sheets, GOOGLE_SHEET_ID);
  const result = await tailorLowAtsJobsOnSheet(sheets, GOOGLE_SHEET_ID);

  console.log(
    `\n📊  Tailor pipeline: ${result.processed} processed, ${result.reached} saved at 90%+\n`
  );
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("❌  Tailor pipeline failed:", err.message);
    process.exit(1);
  });
}
