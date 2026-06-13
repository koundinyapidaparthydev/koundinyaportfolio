/**
 * Auto-tailor resumes for recent HC jobs scoring below TAILOR_ATS_THRESHOLD.
 * Only processes jobs within the apply-now window (not legacy rows).
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { loadResume } from "./resume-loader.mjs";
import { scoreJobWithGemini } from "./gemini-ats.mjs";
import { tailorResumeWithQualityGate } from "./resume-tailor.mjs";
import { uploadToGCS } from "./gcs-upload.mjs";
import { TAILOR_ATS_THRESHOLD } from "./ats-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHEET_NAME = "Jobs";
const DEFAULT_BATCH = Number(process.env.HC_TAILOR_BATCH_LIMIT) || 5;
const MIN_DESCRIPTION = 120;
/** Only tailor jobs discovered within the apply-now window (12h). */
const APPLY_WINDOW_MS = 12 * 60 * 60_000;
const TAILOR_DELAY_MS = Number(process.env.HC_TAILOR_DELAY_MS) || 2000;

function padRow19(row) {
  const out = [...(row ?? [])];
  while (out.length < 19) out.push("");
  return out;
}

function parseScore(value) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function isWithinApplyWindow(fetchedAt, now = Date.now()) {
  if (!fetchedAt?.trim()) return false;
  const ts = Date.parse(fetchedAt);
  if (Number.isNaN(ts)) return false;
  return now - ts <= APPLY_WINDOW_MS;
}

function needsTailoring(row, now) {
  const padded = padRow19(row);
  const desc = (padded[6] ?? "").trim();
  const score = parseScore(padded[9]);
  const modified = (padded[17] ?? "").trim().toLowerCase();
  const resumeUrl = (padded[7] ?? "").trim();
  const fetchedAt = padded[5] ?? "";

  if (desc.length < MIN_DESCRIPTION) return false;
  if (score === null) return false;
  if (score >= TAILOR_ATS_THRESHOLD) return false;
  if (modified === "yes" || resumeUrl) return false;
  if (!isWithinApplyWindow(fetchedAt, now)) return false;
  return true;
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

/**
 * Tailor low-ATS jobs, re-score with Gemini, upload PDF, write sheet columns.
 */
export async function tailorLowAtsJobsOnSheet(sheets, spreadsheetId, options = {}) {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    console.log("⏭  Skipping resume tailoring — ANTHROPIC_API_KEY not set");
    return 0;
  }

  const batchLimit = options.limit ?? DEFAULT_BATCH;
  const now = options.now ?? Date.now();
  const baseResume = options.resume ?? loadResume();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:S`,
  });
  const rows = res.data.values ?? [];
  const targets = rows
    .map((row, idx) => ({ row: padRow19(row), sheetRow: idx + 2 }))
    .filter(({ row }) => needsTailoring(row, now))
    .slice(0, batchLimit);

  if (targets.length === 0) return 0;

  console.log(`✍️  Tailoring ${targets.length} low-ATS jobs (<${TAILOR_ATS_THRESHOLD}%)…`);
  const updateData = [];
  let tailored = 0;

  for (let i = 0; i < targets.length; i++) {
    const { row, sheetRow } = targets[i];
    const company = row[0] ?? "";
    const title = row[1] ?? "";
    const desc = row[6] ?? "";
    const preScoreNum = parseScore(row[9]);
    const preScore = String(preScoreNum ?? "");

    try {
      const {
        tailoredResume,
        coverLetter,
        quality,
        postResult,
        postAtsScore,
      } = await tailorResumeWithQualityGate(baseResume, {
        title,
        company,
        description: desc,
      }, { preAtsScore: preScoreNum });

      if (!quality.passed) {
        console.warn(
          `  ✗ ${company} — ${title}: quality gate failed (${quality.errors.length} errors) — skipped`
        );
        for (const err of quality.errors) {
          console.warn(`      · ${err.message}`);
        }
        continue;
      }

      const postScore = String(postAtsScore);

      let resumeUrl = "";
      try {
        const pdfBuffer = await renderResumePdf(tailoredResume);
        const safeCompany = company.replace(/[^a-zA-Z0-9]/g, "_");
        const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
        const ts = new Date().toISOString().slice(0, 10);
        const fileName = `resumes/${ts}/${safeCompany}_${safeTitle}.pdf`;
        resumeUrl = await uploadToGCS(pdfBuffer, fileName);
      } catch (uploadErr) {
        console.warn(`  ⚠  GCS upload skipped row ${sheetRow}: ${uploadErr.message}`);
      }

      updateData.push(
        { range: `${SHEET_NAME}!H${sheetRow}`, values: [[resumeUrl]] },
        {
          range: `${SHEET_NAME}!I${sheetRow}`,
          values: [[(coverLetter ?? "").slice(0, 4000)]],
        },
        { range: `${SHEET_NAME}!J${sheetRow}`, values: [[postScore]] },
        { range: `${SHEET_NAME}!O${sheetRow}`, values: [[postResult.matchSummary ?? ""]] },
        { range: `${SHEET_NAME}!P${sheetRow}`, values: [[postResult.keyGaps ?? ""]] },
        { range: `${SHEET_NAME}!Q${sheetRow}`, values: [[postResult.recommendedKeywords ?? ""]] },
        { range: `${SHEET_NAME}!R${sheetRow}`, values: [["yes"]] },
        { range: `${SHEET_NAME}!S${sheetRow}`, values: [[preScore]] }
      );

      tailored++;
      const qualityNote =
        quality.warnings.length > 0
          ? ` (quality ${quality.score}/100, ${quality.warnings.length} warnings)`
          : ` (quality ${quality.score}/100)`;
      console.log(
        `  ✓ ${company} — ${title}: ATS ${preScore}% → ${postScore}% (tailored)${qualityNote}`
      );
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

  console.log(`✅  Tailored resumes written: ${tailored}`);
  return tailored;
}
