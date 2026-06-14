#!/usr/bin/env node
/**
 * Local 10-minute loop — **disabled by default**.
 *
 * Production scheduling: local cron — `scripts/cron/run-jobs-pipeline.sh` (every 10 min).
 *
 * One-off local test:
 *   npm run job:pipeline
 *
 * Force local loop (dev only):
 *   ALLOW_LOCAL_PIPELINE_LOOP=1 npm run job:pipeline:loop
 */

import { spawn } from "child_process";
import { HC_PIPELINE_INTERVAL_MS } from "./lib/hiring-cafe-sheet-sync.mjs";

if (process.env.ALLOW_LOCAL_PIPELINE_LOOP !== "1") {
  console.error("\n❌  Local pipeline loop is disabled.");
  console.error("   Production uses cron: scripts/cron/run-jobs-pipeline.sh");
  console.error("   One-off test: npm run job:pipeline");
  console.error("   Dev loop only: ALLOW_LOCAL_PIPELINE_LOOP=1 npm run job:pipeline:loop\n");
  process.exit(1);
}

const INTERVAL_SEC = HC_PIPELINE_INTERVAL_MS / 1000;

function runOnce() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["scripts/run-jobs-pipeline.mjs"], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Pipeline exited with code ${code}`));
    });
  });
}

async function main() {
  console.log(
    `\n🔁  LOCAL HC pipeline loop (dev only) — every ${INTERVAL_SEC}s (${INTERVAL_SEC / 60} min)\n`
  );

  for (;;) {
    const started = new Date().toISOString();
    console.log(`\n─── Run at ${started} ───`);
    try {
      await runOnce();
    } catch (err) {
      console.error(`⚠️  Run failed: ${err.message}`);
    }
    console.log(`\n💤  Sleeping ${INTERVAL_SEC}s until next scrape…\n`);
    await new Promise((r) => setTimeout(r, HC_PIPELINE_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
