#!/usr/bin/env node
/**
 * Diagnose Google Sheet job pipeline state (columns A–M).
 * Uses GOOGLE_* from .env.local via loadEnvLocal.
 */

import { loadEnvLocal } from "./lib/load-env.mjs";
import { google } from "googleapis";

loadEnvLocal();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const SHEET_NAME = "Jobs";
const ARCHIVE_SHEET = "Old Jobs";

const COL = {
  DESCRIPTION: 6,
  RESUME_URL: 7,
  APPLY_STATUS: 10,
};

function padRow(row, len = 13) {
  const out = [...row];
  while (out.length < len) out.push("");
  return out;
}

async function getSheets() {
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function summarizeRows(rows, label) {
  const dataRows = rows.length > 0 && rows[0][0] === "Company" ? rows.slice(1) : rows;
  const total = dataRows.length;

  let descEligible = 0;
  let hEmpty = 0;
  let hFilled = 0;
  const kCounts = { pending: 0, applied: 0, failed: 0, empty: 0, other: 0 };

  for (const raw of dataRows) {
    const row = padRow(raw);
    const desc = (row[COL.DESCRIPTION] ?? "").trim();
    if (desc.length >= 30) descEligible++;

    const resume = (row[COL.RESUME_URL] ?? "").trim();
    if (resume) hFilled++;
    else hEmpty++;

    const status = (row[COL.APPLY_STATUS] ?? "").trim().toLowerCase();
    if (status === "pending") kCounts.pending++;
    else if (status === "applied") kCounts.applied++;
    else if (status === "failed") kCounts.failed++;
    else if (!status) kCounts.empty++;
    else kCounts.other++;
  }

  console.log(`\n── ${label} ──`);
  console.log(`  Total data rows:              ${total}`);
  console.log(`  Description ≥ 30 chars (G):   ${descEligible}`);
  console.log(`  H (Resume URL) empty:         ${hEmpty}`);
  console.log(`  H (Resume URL) filled:        ${hFilled}`);
  console.log(`  K = pending:                  ${kCounts.pending}`);
  console.log(`  K = applied:                  ${kCounts.applied}`);
  console.log(`  K = failed:                   ${kCounts.failed}`);
  console.log(`  K empty:                      ${kCounts.empty}`);
  if (kCounts.other) console.log(`  K other:                      ${kCounts.other}`);
}

async function main() {
  if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.error("❌  Missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON (.env.local)");
    process.exit(1);
  }

  let clientEmail = "";
  try {
    clientEmail = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON).client_email ?? "";
  } catch {
    console.error("❌  GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
    process.exit(1);
  }

  console.log("📊  Sheet diagnose");
  console.log(`  Sheet ID: ${GOOGLE_SHEET_ID}`);
  if (clientEmail) console.log(`  Service account: ${clientEmail}`);

  const sheets = await getSheets();

  const jobsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A2:M`,
  });
  summarizeRows(jobsRes.data.values ?? [], `Tab: ${SHEET_NAME}`);

  try {
    const archiveRes = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${ARCHIVE_SHEET}!A2:M`,
    });
    summarizeRows(archiveRes.data.values ?? [], `Tab: ${ARCHIVE_SHEET}`);
  } catch (err) {
    console.log(`\n── Tab: ${ARCHIVE_SHEET} ──`);
    console.log(`  (not readable: ${err.message})`);
  }

  console.log("\n✅  Diagnose complete");
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
