#!/usr/bin/env node
/**
 * Per-company pipeline: scrape → Sheets → descriptions → ATS (Gemini) → diff log.
 * All state lives in Google Sheets (Jobs, Scrape Log, Significant Changes).
 *
 * Usage: COMPANY="Stripe" node scripts/run-company-pipeline.mjs
 */

import { pathToFileURL } from "url";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";
import { recordScrapeResult } from "./lib/scrape-log.mjs";
import { loadResume } from "./lib/resume-loader.mjs";
import { scoreJobWithGemini } from "./lib/gemini-ats.mjs";

loadEnvLocal();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = "Jobs";
const DESCRIPTION_BACKFILL_LIMIT = Number(process.env.DESCRIPTION_BACKFILL_LIMIT) || 15;
const DESCRIPTION_CONCURRENCY = Number(process.env.DESCRIPTION_CONCURRENCY) || 3;

/** Single sheet read: company rows with columns A–J. */
async function loadCompanyJobRows(sheets, company) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A2:J`,
  });
  return (res.data.values ?? [])
    .map((row, idx) => ({ row, sheetRow: idx + 2 }))
    .filter(({ row }) => row[0] === company);
}

function urlsFromRows(companyRows) {
  return new Set(companyRows.map(({ row }) => row[3]).filter(Boolean));
}

async function backfillCompanyDescriptions(sheets, company, companyRows, fetchDescription, mapConcurrent) {
  const needs = companyRows.filter(({ row }) => !row[6] || !row[6].trim());
  if (!needs.length) return 0;

  const batch = needs.slice(0, DESCRIPTION_BACKFILL_LIMIT);
  const remaining = needs.length - batch.length;

  console.log(
    `📝  Backfilling ${batch.length} descriptions for ${company}` +
      (remaining > 0 ? ` (${remaining} deferred — limit ${DESCRIPTION_BACKFILL_LIMIT}/cycle)` : "") +
      "...",
  );

  const enriched = await mapConcurrent(batch, DESCRIPTION_CONCURRENCY, async ({ row, sheetRow }) => {
    const desc = await fetchDescription(row);
    return { desc, sheetRow };
  });

  const updateData = enriched
    .filter(({ desc }) => desc?.length > 0)
    .map(({ desc, sheetRow }) => ({
      range: `${SHEET_NAME}!G${sheetRow}`,
      values: [[desc]],
    }));

  if (!updateData.length) return 0;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: GOOGLE_SHEET_ID,
    requestBody: { valueInputOption: "RAW", data: updateData },
  });
  console.log(`✅  Wrote ${updateData.length} descriptions for ${company}`);
  return updateData.length;
}

async function scoreCompanyAts(sheets, company, companyRows, resume) {
  const needs = companyRows.filter(
    ({ row }) => row[6]?.trim() && (!row[9] || !String(row[9]).trim()),
  );
  if (!needs.length) return 0;

  const batch = needs.slice(0, 25);
  console.log(`🎯  ATS scoring ${batch.length} jobs for ${company} (Gemini flash-lite)...`);
  let scored = 0;
  const updateData = [];

  for (const { row, sheetRow } of batch) {
    const title = row[1] ?? "";
    const desc = row[6] ?? "";
    const result = await scoreJobWithGemini(title, desc, resume);
    updateData.push({
      range: `${SHEET_NAME}!J${sheetRow}`,
      values: [[String(result.score)]],
    });
    scored++;
  }

  if (updateData.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: { valueInputOption: "RAW", data: updateData },
    });
  }
  console.log(`✅  ATS scores written: ${scored} (${company})`);
  return scored;
}

export async function runCompanyPipeline(company) {
  process.env.COMPANY = company;
  process.env.SCRAPE_ONLY = "false";
  delete process.env.DRY_RUN;

  const sj = await import("./scrape-jobs.mjs");
  const scrapedAt = new Date().toISOString();
  const sheets = await sj.getSheets();
  const beforeRows = await loadCompanyJobRows(sheets, company);
  const beforeUrls = urlsFromRows(beforeRows);

  let jobs = [];
  let status = "OK";
  let notes = "";

  try {
    const { allJobs, rejected } = await sj.fetchAllJobs();
    if (rejected > 0) {
      status = "FAILED";
      notes = `${rejected} source(s) rejected`;
      throw new Error(notes);
    }
    jobs = allJobs;

    await sj.ensureSheetAndHeaders(sheets);
    await sj.refreshLastSeenAt(sheets, jobs);
    await sj.syncPostedAt(sheets, jobs);
    await sj.writeNewJobs(sheets, jobs);

    const resume = loadResume();
    let companyRows = await loadCompanyJobRows(sheets, company);
    const backfilled = await backfillCompanyDescriptions(
      sheets,
      company,
      companyRows,
      sj.fetchDescription,
      sj.mapConcurrent,
    );
    if (backfilled > 0) {
      companyRows = await loadCompanyJobRows(sheets, company);
    }
    await scoreCompanyAts(sheets, company, companyRows, resume);
  } catch (err) {
    if (status === "OK") {
      status = "FAILED";
      notes = err.message;
    }
    console.error(`❌  Pipeline failed for ${company}:`, err.message);
    await recordScrapeResult(sheets, GOOGLE_SHEET_ID, {
      company,
      scrapedAt,
      jobsFound: jobs.length,
      newJobs: 0,
      removedJobs: 0,
      status,
      notes,
    });
    throw err;
  }

  const scrapedUrlSet = new Set(jobs.map((r) => r[3]).filter(Boolean));
  const newJobs = [...scrapedUrlSet].filter((u) => !beforeUrls.has(u)).length;
  const removedJobs = [...beforeUrls].filter((u) => !scrapedUrlSet.has(u)).length;

  const diff = await recordScrapeResult(sheets, GOOGLE_SHEET_ID, {
    company,
    scrapedAt,
    jobsFound: jobs.length,
    newJobs,
    removedJobs,
    status,
    notes: notes || `desc+ats pipeline complete`,
  });

  console.log(
    `📊  ${company}: ${jobs.length} jobs | new=${newJobs} removed=${removedJobs} | Δ30m=${diff.delta30m} Δ2h=${diff.delta2h} Δ24h=${diff.delta24h}`,
  );
  if (diff.significant) console.log(`🔔  Significant change logged for ${company}`);

  return { company, jobsFound: jobs.length, newJobs, removedJobs, ...diff, status };
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  validatePipelineEnv("scrape");
  const company = process.env.COMPANY?.trim();
  if (!company) {
    console.error("❌  COMPANY env var required");
    process.exit(1);
  }
  runCompanyPipeline(company)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
