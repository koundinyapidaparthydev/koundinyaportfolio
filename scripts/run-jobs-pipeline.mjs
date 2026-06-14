#!/usr/bin/env node
/**
 * Unified jobs pipeline — scrape + ATS + verify + tailor in one run.
 *
 * Cloud: GitHub Actions jobs-pipeline.yml every 10 min (scrape + tailor, one script).
 *
 * Usage:
 *   npm run job:pipeline              # full pipeline (default tailor batch 30)
 *   npm run job:pipeline -- --scrape-only
 *   npm run job:pipeline -- --tailor-only
 *   DRY_RUN=true npm run job:pipeline
 *
 * Env:
 *   HC_TAILOR_BATCH_LIMIT   (default 30)
 *   HC_TAILOR_CONCURRENCY   (default 5)
 *   HC_ATS_BATCH_LIMIT      (default 60)
 */

import { pathToFileURL } from "url";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";
import { runJobsPipeline } from "./lib/jobs-pipeline-core.mjs";

loadEnvLocal();
validatePipelineEnv("scrape");

function parseArgs(argv) {
  const scrapeOnly = argv.includes("--scrape-only");
  const tailorOnly = argv.includes("--tailor-only");
  if (scrapeOnly && tailorOnly) {
    throw new Error("Use only one of --scrape-only or --tailor-only");
  }
  return {
    scrape: !tailorOnly,
    tailor: !scrapeOnly,
    dryRun: process.env.DRY_RUN === "true",
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  await runJobsPipeline(opts);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("❌  Jobs pipeline failed:", err.message);
    process.exit(1);
  });
}
