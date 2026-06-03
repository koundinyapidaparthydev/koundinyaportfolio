#!/usr/bin/env node
/**
 * Preflight check for pipeline env (local .env.local or GitHub Actions secrets).
 *
 * Usage:
 *   node scripts/validate-pipeline-env.mjs --stage=scrape
 *   node scripts/validate-pipeline-env.mjs --stage=generate
 *   node scripts/validate-pipeline-env.mjs --stage=apply
 *   node scripts/validate-pipeline-env.mjs --stage=weekly
 */
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";

loadEnvLocal();

const arg = process.argv.find((a) => a.startsWith("--stage="));
const stage = arg?.split("=")[1] ?? "generate";

try {
  validatePipelineEnv(stage);
  console.log(`✅  Pipeline env OK for stage: ${stage}`);
  if (process.env.ANTHROPIC_MODEL) {
    console.log(`   ANTHROPIC_MODEL=${process.env.ANTHROPIC_MODEL}`);
  }
} catch (err) {
  console.error(`❌  ${err.message}`);
  process.exit(1);
}
