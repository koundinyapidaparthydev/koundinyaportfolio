#!/usr/bin/env node
/**
 * process-job-batch.mjs
 *
 * Drains the Google Sheet "queue" in bounded batches (SQS-like pattern):
 * repeated scheduled runs process up to BATCH_SIZE rows per invocation.
 *
 * For each selected row (same row for generate → apply):
 *   1. Generate tailored resume (if H empty) → update H–M
 *   2. Auto-apply that same row (if K=pending and H set)
 *
 * Row selection (up to BATCH_SIZE, hard cap 50):
 *   - Priority 1: description >= 30 chars, H empty → generate + apply
 *   - Priority 2: H filled, K=pending → apply-only
 *
 * Env:
 *   BATCH_SIZE (default 30), START_ROW (optional 1-based data row),
 *   MAX_CONCURRENT (default 2), DRY_RUN, APPLY_LIMIT (defaults to BATCH_SIZE)
 */

import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";

loadEnvLocal();

import Anthropic from "@anthropic-ai/sdk";
import { chromium } from "playwright";
import { unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const BATCH = Math.min(parseInt(process.env.BATCH_SIZE ?? "30", 10), 50);
const START_ROW = parseInt(process.env.START_ROW ?? "2", 10);
const MAX_CONCURRENT = Math.min(parseInt(process.env.MAX_CONCURRENT ?? "2", 10), 2);
const DRY_RUN = process.env.DRY_RUN === "true";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

try {
  validatePipelineEnv("generate");
  validatePipelineEnv("apply");
} catch (err) {
  console.error(`❌  ${err.message}`);
  process.exit(1);
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Pick rows: generate+apply first, then apply-only pending. */
function selectBatchRows(allRows, COL) {
  const needGenerate = [];
  const applyOnly = [];

  for (const row of allRows) {
    if (row.rowIndex < START_ROW) continue;
    const desc = row.values[COL.DESCRIPTION] ?? "";
    if (desc.length < 30) continue;

    const resumeUrl = (row.values[COL.RESUME_URL] ?? "").trim();
    const status = (row.values[COL.APPLY_STATUS] ?? "").trim();

    if (!resumeUrl) {
      needGenerate.push({ ...row, mode: "generate-and-apply" });
    } else if (status === "pending") {
      applyOnly.push({ ...row, mode: "apply-only" });
    }
  }

  const combined = [...needGenerate, ...applyOnly];
  return combined.slice(0, BATCH);
}

async function processOneRow(row, baseResume, claudeClient, browser, sheets, tmpFiles, deps) {
  const { COL, processJob, updateRow, applyToRow } = deps;
  const { rowIndex, values, mode } = row;
  const label = `${values[COL.COMPANY]} — ${values[COL.TITLE]} (row ${rowIndex})`;
  let workingValues = [...values];

  if (mode === "generate-and-apply") {
    console.log(`\n🔄 [generate+apply] ${label}`);
    const genResult = await processJob(
      { rowIndex, values: workingValues },
      baseResume,
      claudeClient
    );

    if (!genResult) {
      console.log(`  ⏭  Skipped generation for row ${rowIndex}`);
      return { generated: false, applied: false };
    }
    if (genResult.error) {
      console.log(`  ❌ Generation failed: ${genResult.error}`);
      return { generated: false, applied: false };
    }

    await updateRow(sheets, rowIndex, {
      resumeUrl: genResult.resumeUrl,
      coverLetter: genResult.coverLetterText,
      atsScore: genResult.atsScore,
      applyStatus: genResult.applyStatus,
      notes: genResult.notes,
    });

    workingValues[COL.RESUME_URL] = genResult.resumeUrl ?? "";
    workingValues[COL.COVER_LETTER] = genResult.coverLetterText ?? "";
    workingValues[COL.ATS_SCORE] = String(genResult.atsScore ?? "");
    workingValues[COL.APPLY_STATUS] = genResult.applyStatus ?? "pending";

    if (!genResult.resumeUrl) {
      console.log(`  ⚠  No resume URL after generate — skipping apply`);
      return { generated: true, applied: false };
    }
  } else {
    console.log(`\n📤 [apply-only] ${label}`);
  }

  if (DRY_RUN) {
    console.log(`  🧪 DRY_RUN: would apply row ${rowIndex}`);
    return { generated: mode === "generate-and-apply", applied: false };
  }

  const outcome = await applyToRow(browser, sheets, rowIndex, workingValues, { tmpFiles });
  return {
    generated: mode === "generate-and-apply",
    applied: outcome.success,
    appliedMeta: outcome.applied,
  };
}

async function mapSequential(items, limit, fn) {
  const results = [];
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

async function main() {
  const {
    COL,
    getSheets,
    ensureExtendedHeaders,
    getAllRows,
    updateRow,
    processJob,
    getResume,
  } = await import("./generate-applications.mjs");
  const { applyToRow } = await import("./auto-apply.mjs");

  console.log("📦  Process Job Batch — starting\n");
  console.log(`  BATCH_SIZE:     ${BATCH} (hard cap 50)`);
  console.log(`  START_ROW:      ${START_ROW}`);
  console.log(`  MAX_CONCURRENT: ${MAX_CONCURRENT}`);
  console.log(`  DRY_RUN:        ${DRY_RUN}`);
  console.log(`  RECORD_APPLY:   ${process.env.RECORD_APPLY === "true"}`);
  console.log(`  Model:          ${MODEL}\n`);

  const baseResume = await getResume();
  const claudeClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const sheets = await getSheets();
  await ensureExtendedHeaders(sheets);

  const allRows = await getAllRows(sheets);
  const batch = selectBatchRows(allRows, COL);

  console.log(`📊  Sheet rows: ${allRows.length}`);
  console.log(`🎯  This run:   ${batch.length} row(s)\n`);

  if (batch.length === 0) {
    console.log("✅  Queue empty — nothing to process");
    return;
  }

  console.log(`  Rows: ${batch.map((r) => `${r.rowIndex}(${r.mode})`).join(", ")}\n`);

  const browser = await chromium.launch({ headless: true });
  const tmpFiles = [];
  let generated = 0;
  let applied = 0;
  const appliedNotifications = [];

  try {
    const deps = { COL, processJob, updateRow, applyToRow };
    const results = await mapSequential(batch, MAX_CONCURRENT, async (row) => {
      const out = await processOneRow(row, baseResume, claudeClient, browser, sheets, tmpFiles, deps);
      if (out.generated) generated++;
      if (out.applied) {
        applied++;
        if (out.appliedMeta) appliedNotifications.push(out.appliedMeta);
      }
      await delay(3000);
      return out;
    });
    void results;
  } finally {
    await browser.close();
    for (const p of tmpFiles) {
      await unlink(p).catch(() => {});
    }
  }

  console.log(`\n📊  Batch Summary`);
  console.log(`  📄 Generated: ${generated}`);
  console.log(`  ✅ Applied:   ${applied}`);
  console.log(`  ⏭  Remaining rows will be picked up on the next scheduled run.`);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
