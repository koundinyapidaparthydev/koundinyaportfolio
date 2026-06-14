#!/usr/bin/env node
/**
 * @deprecated Use scripts/run-jobs-pipeline.mjs — kept for imports and GHA alias.
 * Quick tailor batch (5 jobs) for lightweight runs.
 */

import { pathToFileURL } from "url";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";
import { runJobsPipeline } from "./lib/jobs-pipeline-core.mjs";

loadEnvLocal();
validatePipelineEnv("scrape");

async function main() {
  const prev = process.env.HC_TAILOR_BATCH_LIMIT;
  if (!prev) process.env.HC_TAILOR_BATCH_LIMIT = "5";
  try {
    await runJobsPipeline({ scrape: true, tailor: true });
  } finally {
    if (!prev) delete process.env.HC_TAILOR_BATCH_LIMIT;
    else process.env.HC_TAILOR_BATCH_LIMIT = prev;
  }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("❌  HC pipeline failed:", err.message);
    process.exit(1);
  });
}
