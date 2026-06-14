#!/usr/bin/env node
/**
 * @deprecated Use scripts/run-jobs-pipeline.mjs --tailor-only
 */

import { pathToFileURL } from "url";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";
import { runJobsPipeline } from "./lib/jobs-pipeline-core.mjs";

loadEnvLocal();
validatePipelineEnv("scrape");

async function main() {
  await runJobsPipeline({
    scrape: false,
    tailor: true,
    resetTailorAttempts: true,
  });
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("❌  Tailor pipeline failed:", err.message);
    process.exit(1);
  });
}
