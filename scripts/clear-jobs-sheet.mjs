#!/usr/bin/env node
/**
 * Clear all scraped job rows from the Google Sheet (Jobs + Old Jobs tabs).
 * Keeps the header row (row 1). Used to reset for a clean pipeline test.
 *
 * Required env: GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON (.env.local)
 */

import { loadEnvLocal } from "./lib/load-env.mjs";
import { google } from "googleapis";

loadEnvLocal();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const TABS = ["Jobs", "Old Jobs"];
const CLEAR_RANGE = "A2:U"; // columns A–U, from row 2 onward (skip header)

async function getSheets() {
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function clearTab(sheets, tab) {
  // First count existing rows for reporting.
  let beforeCount = 0;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${tab}!A2:U`,
    });
    beforeCount = (res.data.values ?? []).length;
  } catch (err) {
    console.log(`  (tab "${tab}" not readable: ${err.message})`);
    return { tab, beforeCount: 0, cleared: false };
  }

  if (beforeCount === 0) {
    console.log(`  ✓  "${tab}" already empty — nothing to clear`);
    return { tab, beforeCount: 0, cleared: true };
  }

  await sheets.spreadsheets.values.clear({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${tab}!${CLEAR_RANGE}`,
  });
  console.log(`  🗑   cleared ${beforeCount} rows from "${tab}"`);
  return { tab, beforeCount, cleared: true };
}

async function main() {
  if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.error("❌  Missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON (.env.local)");
    process.exit(1);
  }

  console.log("🧹  Clearing scraped jobs from sheet\n");
  const sheets = await getSheets();

  let totalCleared = 0;
  for (const tab of TABS) {
    const result = await clearTab(sheets, tab);
    if (result.cleared) totalCleared += result.beforeCount;
  }

  console.log(`\n✅  Done. ${totalCleared} rows cleared across ${TABS.length} tabs.`);
  console.log("   Header rows preserved. Sheet is ready for a fresh pipeline run.");
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
