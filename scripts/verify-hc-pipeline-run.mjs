#!/usr/bin/env node
/**
 * Post-pipeline sanity checks — pages scraped, descriptions, dedup, 12h window.
 * Usage: node scripts/verify-hc-pipeline-run.mjs
 */

import { loadEnvLocal } from "./lib/load-env.mjs";
import { APPLY_NOW_WINDOW_MS, HC_MAX_PAGES } from "./lib/hiring-cafe.mjs";
import { getJobDedupKey } from "./lib/hiring-cafe.mjs";
import { getRoleDedupKey } from "./lib/hiring-cafe-sheet-sync.mjs";

loadEnvLocal();

const sheetId = process.env.GOOGLE_SHEET_ID;
const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!sheetId || !sa) {
  console.error("❌  Missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON");
  process.exit(1);
}

const { google } = await import("googleapis");
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(sa),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: sheetId,
  range: "Jobs!A2:Q",
});
const rows = res.data.values ?? [];
const now = Date.now();

const keys = new Set();
const roles = new Set();
let dupKeys = 0;
let dupRoles = 0;
let fullDesc = 0;
let shortDesc = 0;
let olderThan12h = 0;

for (const row of rows) {
  const padded = [...row];
  while (padded.length < 17) padded.push("");
  const desc = (padded[6] ?? "").trim();
  if (desc.length >= 500) fullDesc++;
  else if (desc.length > 0) shortDesc++;

  const fetchedMs = Date.parse(padded[5] ?? "");
  if (fetchedMs && now - fetchedMs > APPLY_NOW_WINDOW_MS) olderThan12h++;

  const key = getJobDedupKey(padded);
  const role = getRoleDedupKey(padded);
  if (key) {
    if (keys.has(key)) dupKeys++;
    else keys.add(key);
  }
  if (role) {
    if (roles.has(role)) dupRoles++;
    else roles.add(role);
  }
}

const logRes = await sheets.spreadsheets.values.get({
  spreadsheetId: sheetId,
  range: "Scrape Log!A2:H",
});
const lastLog = (logRes.data.values ?? []).at(-1);
const lastNotes = lastLog?.[7] ?? "";

console.log("\n📋  HC pipeline verification\n");
console.log(`   Pages config:     ${HC_MAX_PAGES}`);
console.log(`   Retention window: ${APPLY_NOW_WINDOW_MS / 3_600_000}h`);
console.log(`   Jobs in sheet:    ${rows.length}`);
console.log(`   Full descriptions (≥500 chars): ${fullDesc}`);
console.log(`   Short descriptions:             ${shortDesc}`);
console.log(`   Duplicate HC keys:              ${dupKeys}`);
console.log(`   Duplicate company+title:          ${dupRoles}`);
console.log(`   Rows older than 12h (should archive next run): ${olderThan12h}`);
if (lastNotes) console.log(`   Last scrape log:  ${lastNotes.slice(0, 120)}…`);

let failed = false;
if (dupKeys > 0 || dupRoles > 0) {
  console.error("\n❌  Duplicate jobs detected in Jobs tab");
  failed = true;
}
if (rows.length > 0 && fullDesc === 0) {
  console.error("\n❌  No full job descriptions found");
  failed = true;
}
if (!lastNotes.includes("pages 1-5") && !lastNotes.includes("pages=5")) {
  console.warn("\n⚠️   Last log may not reflect 5-page scrape (run pipeline again)");
}

console.log(failed ? "\n❌  Verification FAILED\n" : "\n✅  Verification OK\n");
process.exit(failed ? 1 : 0);
