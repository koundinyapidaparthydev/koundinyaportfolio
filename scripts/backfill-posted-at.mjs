#!/usr/bin/env node
/**
 * Backfill column N ("Posted At") from current ATS scrapes without adding new rows.
 * Usage: node scripts/backfill-posted-at.mjs
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env.local") });

const { fetchAllJobs, getSheets, syncPostedAt } = await import("./scrape-jobs.mjs");

async function main() {
  console.log("📅  Backfilling Posted At (column N) from ATS sources…\n");
  const sheets = await getSheets();
  const { allJobs } = await fetchAllJobs();
  console.log(`\n  Scraped ${allJobs.length} jobs with ATS metadata`);
  const updated = await syncPostedAt(sheets, allJobs);
  console.log(`\n✅  Done — ${updated} row(s) updated in column N`);
}

main().catch((err) => {
  console.error("💥  Backfill failed:", err);
  process.exit(1);
});
