#!/usr/bin/env node
/**
 * Run per-company pipeline for all companies in companies.json.
 * Legacy / manual only — GHA default is scripts/run-hiring-cafe-pipeline.mjs.
 * Dispatch workflow with pipeline=company-full to run this in CI.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";
import { runCompanyPipeline } from "./run-company-pipeline.mjs";

loadEnvLocal();
validatePipelineEnv("scrape");

if (process.env.ALLOW_LEGACY_SCRAPE !== "1") {
  console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  LEGACY SCRAPE BLOCKED                                           ║
║                                                                  ║
║  Full company scraping is disabled. Production uses HC-only:     ║
║    npm run job:pipeline                                          ║
║                                                                  ║
║  To run legacy multi-portal scrape intentionally:                ║
║    ALLOW_LEGACY_SCRAPE=1 npm run job:pipeline:companies          ║
╚══════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

console.warn(
  "\n⚠️  ALLOW_LEGACY_SCRAPE=1 — running legacy full-company pipeline (not recommended)\n"
);

const ROOT = process.cwd();
const companies = JSON.parse(
  readFileSync(join(ROOT, "companies.json"), "utf8"),
).companies;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const pauseMs = Number(process.env.COMPANY_PAUSE_MS) || 1500;
  let ok = 0;
  let failed = 0;
  const failures = [];

  console.log(`\n🚀  Full pipeline: ${companies.length} companies\n`);

  for (const { name } of companies) {
    try {
      await runCompanyPipeline(name);
      ok++;
    } catch (err) {
      failed++;
      failures.push({ name, error: err.message });
      console.error(`❌  ${name}: ${err.message}`);
    }
    await delay(pauseMs);
  }

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`📊  Full pipeline done: ${ok} OK, ${failed} FAILED`);
  if (failures.length) {
    for (const f of failures) console.log(`   • ${f.name}: ${f.error}`);
  }
  console.log(`═══════════════════════════════════════════════════════════\n`);

  process.exit(failed > 0 ? 1 : 0);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) main();
