#!/usr/bin/env node
/**
 * Re-tailor and re-upload PDFs for sheet rows already marked resumeModified=yes.
 * Run after PDF layout fixes to refresh existing GCS resume files.
 *
 *   node scripts/rebuild-tailored-pdfs.mjs
 *   REBUILD_PDF_LIMIT=10 node scripts/rebuild-tailored-pdfs.mjs
 */

import { pathToFileURL } from "url";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";
import { rebuildTailoredPdfsOnSheet } from "./lib/hiring-cafe-tailor.mjs";

loadEnvLocal();
validatePipelineEnv("scrape");

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function main() {
  const sj = await import("./scrape-jobs.mjs");
  const sheets = await sj.getSheets();
  const rebuilt = await rebuildTailoredPdfsOnSheet(sheets, GOOGLE_SHEET_ID);
  console.log(`\nDone — rebuilt ${rebuilt} tailored PDF(s).\n`);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("❌  Rebuild failed:", err.message);
    process.exit(1);
  });
}
