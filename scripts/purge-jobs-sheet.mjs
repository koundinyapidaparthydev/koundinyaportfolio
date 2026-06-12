#!/usr/bin/env node
/**
 * One-time purge: backup all Jobs rows → Old Jobs, then clear Jobs data rows.
 *
 * Usage:
 *   DRY_RUN=true node scripts/purge-jobs-sheet.mjs          # preview counts
 *   node scripts/purge-jobs-sheet.mjs                       # backup + clear Jobs
 *   node scripts/purge-jobs-sheet.mjs --clear-dedup         # also wipe Old Jobs (fresh HC dedup)
 *
 * Required env: GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON
 */

import { pathToFileURL } from "url";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";

loadEnvLocal();

try {
  validatePipelineEnv("scrape");
} catch (err) {
  console.error(`❌  ${err.message}`);
  process.exit(1);
}

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const DRY_RUN = process.env.DRY_RUN === "true";
const CLEAR_DEDUP = process.argv.includes("--clear-dedup");

const ARCHIVE_SHEET = "Old Jobs";

const sj = await import("./scrape-jobs.mjs");
const { getSheets, ensureSheetAndHeaders, SHEET_NAME, SHEET_HEADERS } = sj;

function padRowTo14(row) {
  const out = [...row];
  while (out.length < 14) out.push("");
  return out;
}

async function ensureArchiveSheet(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID });
  const existing = (meta.data.sheets ?? []).map((s) => s.properties.title);

  if (!existing.includes(ARCHIVE_SHEET)) {
    if (DRY_RUN) {
      console.log(`🏃  DRY_RUN: would create archive sheet "${ARCHIVE_SHEET}"`);
      return;
    }
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: ARCHIVE_SHEET } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${ARCHIVE_SHEET}!A1:N1`,
      valueInputOption: "RAW",
      requestBody: { values: [SHEET_HEADERS] },
    });
    console.log(`📄  Created archive sheet "${ARCHIVE_SHEET}"`);
  }
}

async function fetchDataRows(sheets, sheetName) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${sheetName}!A2:N`,
  });
  return (resp.data.values ?? []).map(padRowTo14);
}

async function clearSheetData(sheets, sheetName) {
  if (DRY_RUN) {
    console.log(`🏃  DRY_RUN: would clear ${sheetName}!A2:N`);
    return;
  }
  await sheets.spreadsheets.values.clear({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${sheetName}!A2:N`,
  });
}

async function main() {
  console.log(`\n🧹  Purge Jobs sheet${DRY_RUN ? " (DRY_RUN)" : ""}${CLEAR_DEDUP ? " + clear dedup" : ""}\n`);

  const sheets = await getSheets();
  await ensureSheetAndHeaders(sheets);

  const jobsRows = await fetchDataRows(sheets, SHEET_NAME);
  console.log(`📋  Jobs tab: ${jobsRows.length} data row(s) to backup and clear`);

  let archiveBefore = 0;
  if (CLEAR_DEDUP) {
    archiveBefore = (await fetchDataRows(sheets, ARCHIVE_SHEET)).length;
    console.log(`🗑️   Old Jobs tab: ${archiveBefore} data row(s) to wipe (--clear-dedup)`);
  } else {
    const existingArchive = await fetchDataRows(sheets, ARCHIVE_SHEET);
    console.log(`🗂️   Old Jobs tab: ${existingArchive.length} existing row(s) (unchanged)`);
  }

  if (jobsRows.length === 0 && (!CLEAR_DEDUP || archiveBefore === 0)) {
    console.log("\n✅  Nothing to purge\n");
    return;
  }

  if (jobsRows.length > 0) {
    if (!CLEAR_DEDUP) {
      await ensureArchiveSheet(sheets);

      if (DRY_RUN) {
        console.log(`🏃  DRY_RUN: would append ${jobsRows.length} row(s) → "${ARCHIVE_SHEET}"`);
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: `${ARCHIVE_SHEET}!A:N`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: jobsRows },
        });
        console.log(`📦  Backed up ${jobsRows.length} row(s) → "${ARCHIVE_SHEET}"`);
      }
    } else if (DRY_RUN) {
      console.log(`🏃  DRY_RUN: skip Old Jobs backup (--clear-dedup)`);
    }

    await clearSheetData(sheets, SHEET_NAME);

    if (!DRY_RUN) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${SHEET_NAME}!A1:N1`,
        valueInputOption: "RAW",
        requestBody: { values: [SHEET_HEADERS] },
      });
      console.log(`🧽  Cleared "${SHEET_NAME}" data rows (header preserved)`);
    }
  }

  if (CLEAR_DEDUP) {
    const archiveNow = await fetchDataRows(sheets, ARCHIVE_SHEET);
    if (archiveNow.length > 0) {
      if (DRY_RUN) {
        console.log(`🏃  DRY_RUN: would clear ${archiveNow.length} row(s) from "${ARCHIVE_SHEET}"`);
      } else {
        await clearSheetData(sheets, ARCHIVE_SHEET);
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: `${ARCHIVE_SHEET}!A1:N1`,
          valueInputOption: "RAW",
          requestBody: { values: [SHEET_HEADERS] },
        });
        console.log(`🗑️   Cleared "${ARCHIVE_SHEET}" (${archiveNow.length} row(s)) for fresh HC dedup`);
      }
    }
  }

  console.log(`\n✅  Purge ${DRY_RUN ? "preview" : "complete"} — run npm run job:pipeline to re-scrape HC jobs\n`);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("💥  Purge failed:", err.message);
    process.exit(1);
  });
}
