#!/usr/bin/env node
/**
 * generate-applications.mjs
 *
 * Reads all jobs from the Google Sheet that don't yet have a tailored resume,
 * generates each one locally (Claude → PDF → GCS), then writes the results
 * (resume URL, cover letter, ATS score, apply status) back to the sheet.
 *
 * This script runs ENTIRELY LOCALLY — no HTTP call to the Vercel API is needed.
 * PDF rendering is done via a CJS subprocess (scripts/pdf-render-helper.cjs).
 *
 * Sheet columns (A-M):
 *   A Company | B Title | C Location | D URL | E Category | F Fetched At
 *   G Description | H Resume URL | I Cover Letter | J ATS Score
 *   K Apply Status | L Applied At | M Notes
 *
 * Required env vars:
 *   GOOGLE_SHEET_ID              – target sheet
 *   GOOGLE_SERVICE_ACCOUNT_JSON  – service account with Sheets editor access
 *   ANTHROPIC_API_KEY            – Claude API key
 *   GCS_SERVICE_ACCOUNT_JSON     – GCS service account JSON
 *   GCS_BUCKET_NAME              – GCS bucket for PDFs
 *
 * Optional:
 *   MAX_CONCURRENT               – max parallel Claude calls (default 2)
 *   MAX_JOBS                     – cap number of jobs to process (default 0 = unlimited)
 *   FORCE_REGENERATE=true        – re-generate even if a resume URL already exists
 *   START_ROW                    – skip rows before this 1-based data row (default 1)
 */

import { readFileSync } from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";

loadEnvLocal();

import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { spawn } from "child_process";
import { uploadBufferToGCS } from "./lib/gcs-upload.mjs";

// ── Config ─────────────────────────────────────────────────────────────────────
const GOOGLE_SHEET_ID             = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const ANTHROPIC_API_KEY           = process.env.ANTHROPIC_API_KEY;
const MAX_CONCURRENT              = parseInt(process.env.MAX_CONCURRENT ?? "2", 10);
const MAX_JOBS                    = parseInt(process.env.MAX_JOBS ?? "0", 10);
const FORCE_REGENERATE            = process.env.FORCE_REGENERATE === "true";
const START_ROW                   = parseInt(process.env.START_ROW ?? "1", 10);
const MODEL                       =
  process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
const SHEET_NAME                  = "Jobs";

// Column indices (0-based)
const COL = {
  COMPANY:       0,  // A
  TITLE:         1,  // B
  LOCATION:      2,  // C
  URL:           3,  // D
  CATEGORY:      4,  // E
  FETCHED_AT:    5,  // F
  DESCRIPTION:   6,  // G
  RESUME_URL:    7,  // H
  COVER_LETTER:  8,  // I
  ATS_SCORE:     9,  // J
  APPLY_STATUS: 10,  // K
  APPLIED_AT:   11,  // L
  NOTES:        12,  // M
};

try {
  validatePipelineEnv("generate");
} catch (err) {
  console.error(`❌  ${err.message}`);
  process.exit(1);
}

// ── Resolve project root to import local lib files ─────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const RESUME_PATH  = path.join(PROJECT_ROOT, "data", "resume.json");

// ── Helpers ────────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let qi = 0;
  async function worker() {
    while (qi < items.length) {
      const i = qi++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ── Resume loader ──────────────────────────────────────────────────────────────

async function getResume() {
  const raw = await fsPromises.readFile(RESUME_PATH, "utf-8");
  return JSON.parse(raw);
}

// ── ATS Scoring (inlined to avoid TypeScript imports) ─────────────────────────

const STOP_WORDS = new Set([
  "and","or","the","a","an","with","for","to","in","of","on","at","by","from",
  "you","we","our","your","their","this","that","will","are","is","be","been",
  "work","working","ability","strong","good","knowledge","understanding",
  "experience","years","team","role","position","join","looking","seeking",
  "must","required","preferred","plus","bonus","nice","have","has","using",
  "help","lead","design","build","develop","implement","support","ensure",
  "across","within","new","key","high","able","well","also","both","can",
  "may","need","use","get","set","run","own","via","per","end","all","any",
  "who","how","what","when","where","why","which","that","not","but","if",
]);

function extractKeywords(text) {
  const lower = text.toLowerCase();
  const cleaned = lower.replace(/[^\w\s#+./-]/g, " ").replace(/\s+/g, " ");
  const tokens = cleaned.split(" ");
  const results = new Set();
  for (const t of tokens) {
    const w = t.replace(/^[^a-z]+|[^a-z0-9+#.]+$/g, "");
    if (w.length >= 2 && !STOP_WORDS.has(w)) results.add(w);
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i].replace(/[^a-z0-9]/g, "");
    const b = tokens[i + 1].replace(/[^a-z0-9]/g, "");
    if (a.length >= 2 && b.length >= 2 && !STOP_WORDS.has(a) && !STOP_WORDS.has(b)) {
      results.add(`${a} ${b}`);
    }
  }
  return Array.from(results);
}

function buildResumeKeywords(resume) {
  const kws = new Set();
  const add = (s) => {
    const lower = s.toLowerCase();
    kws.add(lower);
    lower.split(/[\s,/()+]+/).forEach((w) => {
      const clean = w.replace(/[^a-z0-9+#.]/g, "");
      if (clean.length >= 2) kws.add(clean);
    });
  };
  for (const cat of resume.skills) {
    for (const skill of cat.skills) add(skill);
  }
  for (const exp of resume.experience) {
    for (const tech of exp.technologies ?? []) add(tech);
    for (const point of exp.points) {
      const techMentions = point.match(/\b[A-Z][a-zA-Z0-9.+#-]+\b/g) ?? [];
      techMentions.forEach((t) => add(t));
    }
  }
  for (const proj of resume.projects) {
    for (const tech of proj.stack) add(tech);
  }
  return kws;
}

function calculateAtsScore(jobDescription, resume) {
  if (!jobDescription?.trim()) return { score: 0, matched: [], missing: [] };
  const resumeKws = buildResumeKeywords(resume);
  const jobKws = extractKeywords(jobDescription);
  const techPattern = /^[a-z][a-z0-9+#.]{1,}$/;
  const relevantJobKws = Array.from(new Set(jobKws.filter((k) => techPattern.test(k) && k.length >= 3))).slice(0, 60);
  const matched = [];
  const missing = [];
  for (const kw of relevantJobKws) {
    const hit = resumeKws.has(kw) ||
      Array.from(resumeKws).some((rk) =>
        (kw.length >= 4 && rk.includes(kw)) || (rk.length >= 4 && kw.includes(rk))
      );
    if (hit) matched.push(kw);
    else missing.push(kw);
  }
  const score = relevantJobKws.length > 0
    ? Math.min(100, Math.round((matched.length / relevantJobKws.length) * 100))
    : 0;
  return { score, matched: matched.slice(0, 20), missing: missing.slice(0, 20) };
}

// ── Claude prompt ──────────────────────────────────────────────────────────────

function buildPrompt(resume, jobTitle, companyName, jobDescription) {
  return `You are a senior technical resume writer. Tailor this resume for the job, then write a 3-paragraph cover letter.

JOB
Company: ${companyName}
Title: ${jobTitle}
Description:
${jobDescription.slice(0, 3000)}

RULES
1. Keep all facts truthful — never invent metrics or experiences.
2. Rewrite personalInfo.summary (2–3 sentences) to speak directly to this role.
3. Reorder skill categories so most relevant appear first.
4. Lightly rephrase 1–2 bullets per role to echo the job description naturally.
5. coverLetter: 3 paragraphs. Opening hook, evidence/stories, close with enthusiasm for ${companyName}. Must NOT sound AI-generated.

OUTPUT: ONLY valid JSON, no markdown, no code fences.

{
  "personalInfo": { "name": string, "title": string, "email": string, "phone": string, "location": string, "linkedin": string, "github": string, "portfolio": string, "summary": string },
  "education": [ /* unchanged */ ],
  "experience": [ /* same structure, lightly tailored */ ],
  "skills": [ /* reordered */ ],
  "projects": [ /* unchanged */ ],
  "coverLetter": "full cover letter text, paragraphs separated by \\n\\n"
}

CANDIDATE RESUME:
${JSON.stringify(resume, null, 0)}`;
}

// ── Claude call ────────────────────────────────────────────────────────────────

async function callClaude(client, resume, company, title, description) {
  let message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: "user", content: buildPrompt(resume, title, company, description) }],
    });
  } catch (err) {
    const msg = err?.message ?? String(err);
    throw new Error(`Claude API (${MODEL}): ${msg}`);
  }

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
  let depth = 0, end = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end !== -1) cleaned = cleaned.slice(0, end + 1);
  return JSON.parse(cleaned);
}

async function uploadResumePdf(buffer, fileName) {
  return uploadBufferToGCS(buffer, fileName, "application/pdf");
}

// ── PDF render via CJS subprocess ─────────────────────────────────────────────
// Spawns scripts/pdf-render-helper.cjs which uses CommonJS require() so it
// can load @react-pdf/renderer without ESM/JSX issues.

async function renderResumePdf(tailoredResume) {
  const helperPath = path.join(__dirname, "pdf-render-helper.cjs");
  const resumeJson = JSON.stringify(tailoredResume);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [helperPath], { stdio: ["pipe", "pipe", "pipe"] });
    const chunks = [];
    const errChunks = [];

    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => errChunks.push(d));
    child.stdin.write(resumeJson);
    child.stdin.end();

    child.on("close", (code) => {
      if (code !== 0) {
        const errMsg = Buffer.concat(errChunks).toString();
        reject(new Error(`PDF helper exited ${code}: ${errMsg.trim()}`));
      } else {
        resolve(Buffer.concat(chunks));
      }
    });

    child.on("error", reject);
  });
}

// ── Sheets helpers ─────────────────────────────────────────────────────────────

async function getSheets() {
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function ensureExtendedHeaders(sheets) {
  const HEADERS = [
    "Company", "Title", "Location", "URL", "Category", "Fetched At", "Description",
    "Resume URL", "Cover Letter", "ATS Score", "Apply Status", "Applied At", "Notes",
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A1:M1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS] },
  });
}

async function getAllRows(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A2:M`,
  });
  const rows = res.data.values ?? [];
  return rows.map((values, i) => ({ rowIndex: i + 2, values }));
}

async function updateRow(sheets, rowIndex, { resumeUrl, coverLetter, atsScore, applyStatus, notes }) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!H${rowIndex}:M${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        resumeUrl    ?? "",
        coverLetter  ?? "",
        atsScore     ?? "",
        applyStatus  ?? "pending",
        "",           // Applied At — filled by auto-apply script
        notes        ?? "",
      ]],
    },
  });
}

// ── Per-job processing ─────────────────────────────────────────────────────────

async function processJob({ rowIndex, values }, baseResume, claudeClient) {
  const company     = values[COL.COMPANY]     ?? "";
  const title       = values[COL.TITLE]       ?? "";
  const description = values[COL.DESCRIPTION] ?? "";
  const label       = `${company} — ${title} (row ${rowIndex})`;

  // Skip if already generated (unless forced)
  if (!FORCE_REGENERATE && values[COL.RESUME_URL]) {
    console.log(`  ⏭  Skipped (already has resume): ${label}`);
    return null;
  }

  // Need at least a minimal description to tailor
  if (!description || description.length < 30) {
    console.log(`  ⚠  Skipped (no/short description — ${description.length} chars): ${label}`);
    return null;
  }

  console.log(`  🤖 Generating resume for: ${label}`);

  try {
    // 1. Call Claude
    const parsed = await callClaude(claudeClient, baseResume, company, title, description);
    const coverLetterText = parsed.coverLetter ?? "";
    const { coverLetter: _cl, ...resumeOnly } = parsed;
    void _cl;
    const tailoredResume = { ...baseResume, ...resumeOnly };

    // 2. ATS score
    const atsResult = calculateAtsScore(description, tailoredResume);

    // 3. Render PDF
    let pdfBuffer;
    try {
      pdfBuffer = await renderResumePdf(tailoredResume);
    } catch (pdfErr) {
      console.warn(`  ⚠  PDF render failed for ${label}: ${pdfErr.message}`);
      // Continue — we'll store a placeholder so the row isn't stuck
      pdfBuffer = null;
    }

    // 4. Upload to GCS
    let resumeUrl = "";
    if (pdfBuffer) {
      try {
        const safeCompany = company.replace(/[^a-zA-Z0-9]/g, "_");
        const safeTitle   = title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
        const ts          = new Date().toISOString().slice(0, 10);
        const fileName    = `resumes/${ts}/${safeCompany}_${safeTitle}_${rowIndex}.pdf`;
        resumeUrl = await uploadResumePdf(pdfBuffer, fileName);
      } catch (gcsErr) {
        console.warn(`  ⚠  GCS upload failed for ${label}: ${gcsErr.message}`);
        resumeUrl = `data:application/pdf;base64,${pdfBuffer.toString("base64").slice(0, 100)}...(truncated)`;
      }
    }

    console.log(`  ✅ Done: ${label} | ATS: ${atsResult.score} | URL: ${resumeUrl ? "✓" : "✗"}`);

    return {
      rowIndex,
      resumeUrl,
      coverLetterText,
      atsScore:    atsResult.score,
      applyStatus: "pending",
      notes:       atsResult.missing?.slice(0, 5).join(", ") ?? "",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ Failed: ${label} — ${msg}`);
    return { rowIndex, error: msg };
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📄  Generate Applications (local) — starting\n");
  console.log(`  Model:          ${MODEL}`);
  console.log(`  Max concurrent: ${MAX_CONCURRENT}`);
  console.log(`  Max jobs:       ${MAX_JOBS === 0 ? "unlimited" : MAX_JOBS}`);
  console.log(`  Force regen:    ${FORCE_REGENERATE}`);
  console.log(`  Start row:      ${START_ROW}`);
  console.log();

  // Load base resume
  const baseResume = await getResume();
  console.log(`✅  Loaded base resume: ${baseResume.personalInfo?.name ?? "unknown"}`);

  // Init Claude
  const claudeClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  // Connect to Sheets
  const sheets = await getSheets();
  await ensureExtendedHeaders(sheets);

  const allRows = await getAllRows(sheets);
  console.log(`📊  Total rows in sheet: ${allRows.length}`);

  // Filter: needs generation
  const needsProcessing = allRows.filter((r) => {
    // Skip rows before START_ROW (1-based data index)
    const dataIndex = r.rowIndex - 1; // rowIndex 2 = dataIndex 1
    if (dataIndex < START_ROW) return false;
    if (!FORCE_REGENERATE && r.values[COL.RESUME_URL]) return false;
    const desc = r.values[COL.DESCRIPTION] ?? "";
    return desc.length >= 30;
  });

  console.log(`🎯  Jobs needing resume generation: ${needsProcessing.length}\n`);

  if (needsProcessing.length === 0) {
    console.log("✅  All jobs already have resumes — nothing to do");
    return;
  }

  // Optional cap
  const toProcess = MAX_JOBS > 0 ? needsProcessing.slice(0, MAX_JOBS) : needsProcessing;
  if (MAX_JOBS > 0 && needsProcessing.length > MAX_JOBS) {
    console.log(`⚠️  MAX_JOBS=${MAX_JOBS} — processing ${toProcess.length} of ${needsProcessing.length}\n`);
  }

  // Process in batches with concurrency limit
  const results = [];
  for (let i = 0; i < toProcess.length; i += MAX_CONCURRENT) {
    const batch = toProcess.slice(i, i + MAX_CONCURRENT);
    console.log(`\n📦 Batch ${Math.floor(i / MAX_CONCURRENT) + 1}/${Math.ceil(toProcess.length / MAX_CONCURRENT)} (rows: ${batch.map((r) => r.rowIndex).join(", ")})`);
    const batchResults = await mapConcurrent(batch, MAX_CONCURRENT, (job) =>
      processJob(job, baseResume, claudeClient)
    );
    results.push(...batchResults);

    // Write batch results immediately so progress isn't lost on failure
    const batchSuccesses = batchResults.filter((r) => r && !r.error);
    for (const result of batchSuccesses) {
      await updateRow(sheets, result.rowIndex, result);
    }

    if (i + MAX_CONCURRENT < toProcess.length) {
      console.log(`  ⏳ Waiting 5s before next batch...`);
      await delay(5000);
    }
  }

  // Summary
  const successes = results.filter((r) => r && !r.error);
  const failed    = results.filter((r) => r && r.error);
  const skipped   = results.filter((r) => !r);

  console.log(`\n📊  Final Summary`);
  console.log(`  ✅ Generated: ${successes.length}`);
  console.log(`  ❌ Failed:    ${failed.length}`);
  console.log(`  ⏭  Skipped:  ${skipped.length}`);
  if (failed.length > 0) {
    console.log("\n  Failed jobs:");
    failed.forEach((f) => console.log(`     - Row ${f.rowIndex}: ${f.error}`));
  }
}

export {
  COL,
  SHEET_NAME,
  getSheets,
  ensureExtendedHeaders,
  getAllRows,
  updateRow,
  processJob,
  getResume,
};

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
