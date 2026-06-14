/**
 * Auto-tailor resumes until ATS >= 87% (max 5 attempts per job).
 * Requires >= 3 resume skills matching the job description. Skips applied jobs.
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { loadResume } from "./resume-loader.mjs";
import { tailorResumeUntilTarget } from "./resume-tailor.mjs";
import { uploadToGCS } from "./gcs-upload.mjs";
import { countSkillMatches } from "./skill-match.mjs";
import {
  TAILOR_TARGET_SCORE,
  MAX_TAILOR_ATTEMPTS,
  MIN_SKILL_MATCH_COUNT,
} from "./ats-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHEET_NAME = "Jobs";
const SHEET_COLS = 21;
const DEFAULT_BATCH = Number(process.env.HC_TAILOR_BATCH_LIMIT) || 5;
const MIN_DESCRIPTION = 120;
const TAILOR_DELAY_MS = Number(process.env.HC_TAILOR_DELAY_MS) || 2000;

function padRow(row) {
  const out = [...(row ?? [])];
  while (out.length < SHEET_COLS) out.push("");
  return out;
}

function parseScore(value) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseAttempts(value) {
  const n = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function isApplied(row) {
  return (row[10] ?? "").trim().toLowerCase() === "applied";
}

function isResumeSaved(row) {
  return (row[17] ?? "").trim().toLowerCase() === "yes";
}

function needsTailoring(row, baseResume) {
  const padded = padRow(row);
  const desc = (padded[6] ?? "").trim();
  if (desc.length < MIN_DESCRIPTION) return false;
  if (isApplied(padded)) return false;

  const score = parseScore(padded[9]);
  const resumeUrl = (padded[7] ?? "").trim();
  const saved = isResumeSaved(padded);
  const stuckUpload =
    score !== null &&
    score >= TAILOR_TARGET_SCORE &&
    !resumeUrl &&
    !saved;

  if (score !== null && score >= TAILOR_TARGET_SCORE && !stuckUpload) return false;

  const prevAttempts = parseAttempts(padded[20]);
  if (prevAttempts >= MAX_TAILOR_ATTEMPTS && !stuckUpload) return false;

  const { passes } = countSkillMatches(desc, baseResume);
  return passes;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function renderResumePdf(resume) {
  const helper = path.join(__dirname, "..", "pdf-render-helper.cjs");
  return new Promise((resolve, reject) => {
    const child = spawn("node", [helper], { stdio: ["pipe", "pipe", "pipe"] });
    const chunks = [];
    let stderr = "";
    child.stdout.on("data", (c) => chunks.push(c));
    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || "PDF render failed"));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    child.stdin.write(JSON.stringify(resume));
    child.stdin.end();
  });
}

function buildSheetUpdate({
  row,
  sheetRow,
  skillMatchCount,
  tailorAttempts,
  savedToSheet,
  result,
  resumeUrl,
}) {
  const preScoreNum = parseScore(row[18]) ?? parseScore(row[9]);
  const preScore = String(preScoreNum ?? "");
  const postScore = String(result?.postAtsScore ?? parseScore(row[9]) ?? "");
  const postResult = result?.postResult ?? {};

  return [
    { range: `${SHEET_NAME}!T${sheetRow}`, values: [[String(skillMatchCount)]] },
    { range: `${SHEET_NAME}!U${sheetRow}`, values: [[String(tailorAttempts)]] },
    { range: `${SHEET_NAME}!J${sheetRow}`, values: [[postScore]] },
    { range: `${SHEET_NAME}!O${sheetRow}`, values: [[postResult.matchSummary ?? ""]] },
    { range: `${SHEET_NAME}!P${sheetRow}`, values: [[postResult.keyGaps ?? ""]] },
    { range: `${SHEET_NAME}!Q${sheetRow}`, values: [[postResult.recommendedKeywords ?? ""]] },
    { range: `${SHEET_NAME}!S${sheetRow}`, values: [[preScore]] },
    ...(savedToSheet
      ? [
          { range: `${SHEET_NAME}!H${sheetRow}`, values: [[resumeUrl]] },
          {
            range: `${SHEET_NAME}!I${sheetRow}`,
            values: [[(result.coverLetter ?? "").slice(0, 4000)]],
          },
          { range: `${SHEET_NAME}!R${sheetRow}`, values: [["yes"]] },
        ]
      : [{ range: `${SHEET_NAME}!R${sheetRow}`, values: [["no"]] }]),
  ];
}

async function tailorJobTarget({ row, sheetRow, baseResume }) {
  const company = row[0] ?? "";
  const title = row[1] ?? "";
  const desc = row[6] ?? "";
  const prevAttempts = parseAttempts(row[20]);
  const { count: skillMatchCount } = countSkillMatches(desc, baseResume);
  const preScoreNum = parseScore(row[18]) ?? parseScore(row[9]);

  const remaining = MAX_TAILOR_ATTEMPTS - prevAttempts;
  const result = await tailorResumeUntilTarget(
    baseResume,
    { title, company, description: desc },
    {
      preAtsScore: preScoreNum,
      maxAttempts: remaining,
      startAttempt: 1,
      targetScore: TAILOR_TARGET_SCORE,
    }
  );

  const totalAttempts = prevAttempts + (result.attempts ?? 0);
  const reachedTarget = result.reachedTarget === true;

  let resumeUrl = "";
  if (reachedTarget) {
    try {
      const pdfBuffer = await renderResumePdf(result.tailoredResume);
      const safeCompany = company.replace(/[^a-zA-Z0-9]/g, "_");
      const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
      const ts = new Date().toISOString().slice(0, 10);
      const fileName = `resumes/${ts}/${safeCompany}_${safeTitle}.pdf`;
      resumeUrl = await uploadToGCS(pdfBuffer, fileName);
    } catch (uploadErr) {
      console.warn(`  ⚠  GCS upload failed row ${sheetRow}: ${uploadErr.message}`);
    }
  }

  const savedToSheet = reachedTarget && !!resumeUrl;
  const status = savedToSheet
    ? "saved"
    : reachedTarget
      ? `ATS ${result.postAtsScore}% but upload failed`
      : `below ${TAILOR_TARGET_SCORE}% after ${totalAttempts} tries`;
  console.log(
    `  ${savedToSheet ? "✓" : "○"} ${company} — ${title}: ATS ${preScoreNum ?? "?"}% → ${result.postAtsScore}% (${status}, skills ${skillMatchCount})`
  );

  return {
    updateData: buildSheetUpdate({
      row,
      sheetRow,
      skillMatchCount,
      tailorAttempts: totalAttempts,
      savedToSheet,
      result,
      resumeUrl,
    }),
    reachedTarget: savedToSheet,
  };
}

/** Write skill-match counts (column T) for every row with a description. */
export async function syncSkillMatchCountsOnSheet(sheets, spreadsheetId, options = {}) {
  const baseResume = options.resume ?? loadResume();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:U`,
  });
  const rows = res.data.values ?? [];
  const updateData = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = padRow(rows[idx]);
    const desc = (row[6] ?? "").trim();
    if (desc.length < MIN_DESCRIPTION) continue;
    const { count } = countSkillMatches(desc, baseResume);
    updateData.push({
      range: `${SHEET_NAME}!T${idx + 2}`,
      values: [[String(count)]],
    });
  }

  if (updateData.length === 0) return 0;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data: updateData },
  });
  console.log(`📎  Skill-match counts synced: ${updateData.length} rows`);
  return updateData.length;
}

/** Zero column U for rows eligible to retry (J<87 or stuck upload without saved resume). */
export async function resetExhaustedTailorAttemptsOnSheet(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:U`,
  });
  const rows = res.data.values ?? [];
  const updateData = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = padRow(rows[idx]);
    if (isApplied(row)) continue;

    const score = parseScore(row[9]);
    const resumeUrl = (row[7] ?? "").trim();
    const saved = isResumeSaved(row);
    const attempts = parseAttempts(row[20]);
    if (attempts === 0) continue;

    const belowTarget = score === null || score < TAILOR_TARGET_SCORE;
    const stuckUpload =
      score !== null &&
      score >= TAILOR_TARGET_SCORE &&
      !resumeUrl &&
      !saved;

    if (belowTarget || stuckUpload) {
      updateData.push({
        range: `${SHEET_NAME}!U${idx + 2}`,
        values: [["0"]],
      });
    }
  }

  if (updateData.length === 0) return 0;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data: updateData },
  });
  console.log(`🔄  Reset tailor attempts for ${updateData.length} row(s)`);
  return updateData.length;
}

/** @deprecated Use resetExhaustedTailorAttemptsOnSheet */
export const resetExhaustedTailorAttempts = resetExhaustedTailorAttemptsOnSheet;

/**
 * Tailor jobs below 87% ATS with >= 3 skill overlap (max 5 attempts each).
 * @returns {{ processed: number, reached: number }}
 */
export async function tailorLowAtsJobsOnSheet(sheets, spreadsheetId, options = {}) {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.log("⏭  Skipping resume tailoring — GEMINI_API_KEY not set");
    return { processed: 0, reached: 0 };
  }

  const batchLimit = options.limit ?? DEFAULT_BATCH;
  const baseResume = options.resume ?? loadResume();

  await syncSkillMatchCountsOnSheet(sheets, spreadsheetId, { resume: baseResume });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:U`,
  });
  const rows = res.data.values ?? [];
  const targets = rows
    .map((row, idx) => ({ row: padRow(row), sheetRow: idx + 2 }))
    .filter(({ row }) => needsTailoring(row, baseResume))
    .slice(0, batchLimit);

  if (targets.length === 0) return { processed: 0, reached: 0 };

  console.log(
    `✍️  Tailoring up to ${targets.length} jobs (target ${TAILOR_TARGET_SCORE}%, ≥${MIN_SKILL_MATCH_COUNT} skills, max ${MAX_TAILOR_ATTEMPTS} tries)…`
  );

  const updateData = [];
  let tailored = 0;
  let reached = 0;

  for (let i = 0; i < targets.length; i++) {
    const { row, sheetRow } = targets[i];
    const company = row[0] ?? "";
    try {
      const result = await tailorJobTarget({ row, sheetRow, baseResume });
      updateData.push(...result.updateData);
      tailored++;
      if (result.reachedTarget) reached++;
    } catch (err) {
      console.warn(`  ⚠  Tailor failed row ${sheetRow} (${company}): ${err.message}`);
    }

    if (i < targets.length - 1) {
      await delay(TAILOR_DELAY_MS);
    }
  }

  if (updateData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updateData },
    });
  }

  console.log(`✅  Tailor pass: ${tailored} processed, ${reached} reached ${TAILOR_TARGET_SCORE}%+`);
  return { processed: tailored, reached };
}

/** Re-run tailor loop for all eligible rows (one-off / backfill). */
export async function retailorAllBelowTargetOnSheet(sheets, spreadsheetId, options = {}) {
  if (options.resetAttempts !== false) {
    await resetExhaustedTailorAttemptsOnSheet(sheets, spreadsheetId);
  }
  return tailorLowAtsJobsOnSheet(sheets, spreadsheetId, {
    ...options,
    limit: options.limit ?? 200,
  });
}
