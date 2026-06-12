#!/usr/bin/env node
/**
 * Run the Hiring Cafe pipeline every 10 minutes (local alternative to GHA cron).
 *
 *   npm run job:pipeline:loop
 *
 * Stop with Ctrl+C.
 */

import { spawn } from "child_process";
import { HC_PIPELINE_INTERVAL_MS } from "./lib/hiring-cafe-sheet-sync.mjs";

const INTERVAL_SEC = HC_PIPELINE_INTERVAL_MS / 1000;

function runOnce() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["scripts/run-hiring-cafe-pipeline.mjs"], {
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
  console.log(`\n🔁  HC pipeline loop — every ${INTERVAL_SEC}s (${INTERVAL_SEC / 60} min)\n`);

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
