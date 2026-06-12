/**
 * ATS scoring + sheet writes for the Hiring Cafe pipeline.
 */

import { loadResume } from "./resume-loader.mjs";
import { scoreJobWithGemini } from "./gemini-ats.mjs";

const SHEET_NAME = "Jobs";
const DEFAULT_ATS_BATCH = Number(process.env.HC_ATS_BATCH_LIMIT) || 30;
const MIN_DESCRIPTION_FOR_ATS = 120;

function padRow17(row) {
  const out = [...(row ?? [])];
  while (out.length < 17) out.push("");
  return out;
}

function needsAtsScore(row) {
  const padded = padRow17(row);
  const desc = (padded[6] ?? "").trim();
  const score = (padded[9] ?? "").trim();
  return desc.length >= MIN_DESCRIPTION_FOR_ATS && !score;
}

/**
 * Score jobs on the Jobs tab with Gemini (resume + full description).
 * Writes columns J (score), O (summary), P (gaps), Q (keywords).
 */
export async function scoreHcJobsOnSheet(sheets, spreadsheetId, options = {}) {
  const batchLimit = options.limit ?? DEFAULT_ATS_BATCH;
  const resume = options.resume ?? loadResume();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:Q`,
  });
  const rows = res.data.values ?? [];
  const targets = rows
    .map((row, idx) => ({ row: padRow17(row), sheetRow: idx + 2 }))
    .filter(({ row }) => needsAtsScore(row))
    .slice(0, batchLimit);

  if (targets.length === 0) return 0;

  console.log(`🎯  ATS scoring ${targets.length} HC jobs (Gemini + resume)…`);
  const updateData = [];

  for (const { row, sheetRow } of targets) {
    const title = row[1] ?? "";
    const desc = row[6] ?? "";
    const result = await scoreJobWithGemini(title, desc, resume);
    updateData.push(
      { range: `${SHEET_NAME}!J${sheetRow}`, values: [[String(result.score)]] },
      { range: `${SHEET_NAME}!O${sheetRow}`, values: [[result.matchSummary ?? ""]] },
      { range: `${SHEET_NAME}!P${sheetRow}`, values: [[result.keyGaps ?? ""]] },
      { range: `${SHEET_NAME}!Q${sheetRow}`, values: [[result.recommendedKeywords ?? ""]] }
    );
  }

  if (updateData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updateData },
    });
  }

  console.log(`✅  ATS scores written: ${targets.length}`);
  return targets.length;
}

/**
 * Backfill full descriptions (column G) for rows still using card summaries.
 */
export async function backfillHcDescriptionsOnSheet(sheets, spreadsheetId, options = {}) {
  const { fetchHcJobDetail, fetchHcBuildId } = await import("./hiring-cafe-fetch.mjs");
  const { extractFullDescriptionFromJobPayload, getHcShortJobId } = await import("./hiring-cafe.mjs");

  const limit = options.limit ?? 40;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:Q`,
  });
  const rows = res.data.values ?? [];
  const buildId = await fetchHcBuildId();
  const updateData = [];
  let checked = 0;

  for (let i = 0; i < rows.length && checked < limit; i++) {
    const row = padRow17(rows[i]);
    const desc = (row[6] ?? "").trim();
    if (desc.length >= 400) continue;

    const url = row[3] ?? "";
    const shortId = getHcShortJobId(url);
    if (!shortId) continue;

    checked++;
    const job = await fetchHcJobDetail(shortId, buildId);
    const full = extractFullDescriptionFromJobPayload(job);
    if (full.length >= 120 && full.length > desc.length) {
      updateData.push({
        range: `${SHEET_NAME}!G${i + 2}`,
        values: [[full.slice(0, 12_000)]],
      });
    }
  }

  if (updateData.length === 0) return 0;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data: updateData },
  });
  console.log(`📝  Backfilled ${updateData.length} full HC descriptions`);
  return updateData.length;
}

export { DEFAULT_ATS_BATCH, MIN_DESCRIPTION_FOR_ATS };
