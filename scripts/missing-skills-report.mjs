#!/usr/bin/env node
/**
 * Reads columns P (Key Gaps, index 15) and Q (Recommended Keywords, index 16)
 * from the "Jobs" + "Old Jobs" tabs, aggregates the most frequent missing
 * terms, and compares them against the skills in data/resume.json.
 *
 * Output: ranked list of skills the resume is missing across real jobs.
 */

import { loadEnvLocal } from "./lib/load-env.mjs";
import { google } from "googleapis";
import { readFileSync } from "fs";

loadEnvLocal();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const SHEETS = ["Jobs", "Old Jobs"];

// Columns (0-indexed) per the pipeline schema in scripts/scrape-jobs.mjs
const COL = {
  COMPANY: 0,
  TITLE: 1,
  ATS_SCORE: 9,        // J
  KEY_GAPS: 15,        // P
  REC_KEYWORDS: 16,    // Q
  SKILL_MATCH: 19,     // T
};

async function getSheets() {
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

function splitTerms(cell) {
  if (!cell) return [];
  return String(cell)
    .split(/[,;\n]| - | — |•|\|/g)
    .map((t) => t.trim().replace(/^[-•]\s*/, ""))
    .filter((t) => t.length >= 2 && t.length <= 60 && !/^(yes|no|n\/a|—|-|none)$/i.test(t));
}

function loadResumeSkills() {
  const raw = JSON.parse(readFileSync("data/resume.json", "utf-8"));
  const set = new Set();
  for (const cat of raw.skills ?? []) {
    for (const s of cat.skills ?? []) {
      set.add(s.toLowerCase());
      s.toLowerCase().split(/[\s/().+,]+/).forEach((w) => {
        const c = w.replace(/[^a-z0-9+#.]/g, "");
        if (c.length >= 2) set.add(c);
      });
    }
  }
  // Also include technologies from experience + project stacks
  for (const exp of raw.experience ?? []) for (const t of exp.technologies ?? []) set.add(t.toLowerCase());
  for (const p of raw.projects ?? []) for (const t of p.stack ?? []) set.add(t.toLowerCase());
  return set;
}

function isMissing(term, resumeSet) {
  const t = term.toLowerCase();
  if (resumeSet.has(t)) return false;
  // partial containment check (matches atsScoring logic)
  for (const r of resumeSet) {
    if (t.length >= 4 && r.includes(t)) return false;
    if (r.length >= 4 && t.includes(r)) return false;
  }
  return true;
}

async function main() {
  if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.error("Missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON in .env.local");
    process.exit(1);
  }

  const sheets = await getSheets();
  const resumeSet = loadResumeSkills();

  const gapCounts = new Map();      // term -> count
  const recCounts = new Map();      // term -> count
  const lowScoreRows = [];          // rows with ATS < 90
  let totalRows = 0;
  let rowsWithGaps = 0;
  let rowsWithRecs = 0;

  for (const sheetName of SHEETS) {
    let rows;
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${sheetName}!A2:U`,
      });
      rows = res.data.values ?? [];
    } catch (err) {
      console.log(`(skipped tab ${sheetName}: ${err.message})`);
      continue;
    }

    for (const raw of rows) {
      totalRows++;
      const row = [...raw];
      while (row.length < 21) row.push("");

      const ats = Number(row[COL.ATS_SCORE] ?? 0);
      const gaps = splitTerms(row[COL.KEY_GAPS]);
      const recs = splitTerms(row[COL.REC_KEYWORDS]);

      if (gaps.length) rowsWithGaps++;
      if (recs.length) rowsWithRecs++;
      if (ats > 0 && ats < 90) {
        lowScoreRows.push({
          company: row[COL.COMPANY],
          title: row[COL.TITLE],
          ats,
          gaps: gaps.slice(0, 6),
        });
      }

      for (const g of gaps) gapCounts.set(g, (gapCounts.get(g) ?? 0) + 1);
      for (const r of recs) recCounts.set(r, (recCounts.get(r) ?? 0) + 1);
    }
  }

  // Rank terms that are MISSING from the resume
  const rank = (counts) =>
    [...counts.entries()]
      .filter(([term]) => isMissing(term, resumeSet))
      .sort((a, b) => b[1] - a[1]);

  const missingGaps = rank(gapCounts);
  const missingRecs = rank(recCounts);

  // Merge into one ranked list (combine counts when term appears in both)
  const merged = new Map();
  for (const [t, c] of missingGaps) merged.set(t, c);
  for (const [t, c] of missingRecs) merged.set(t, (merged.get(t) ?? 0) + c);
  const mergedMissing = [...merged.entries()].sort((a, b) => b[1] - a[1]);

  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  MISSING-SKILLS REPORT (from real job pipeline data)");
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  Rows scanned:        ${totalRows}`);
  console.log(`  Rows with key gaps:  ${rowsWithGaps}`);
  console.log(`  Rows with rec kw:    ${rowsWithRecs}`);
  console.log(`  Rows with ATS < 90:  ${lowScoreRows.length}`);
  console.log(`  Resume skills count: ${resumeSet.size}`);
  console.log("");

  console.log("── TOP 60 MISSING SKILLS (across all scraped jobs) ──");
  console.log("(count = how many jobs mentioned this as a gap / recommended keyword)\n");
  console.log("rank | count | skill");
  console.log("-----|-------|-------------------------------------------");
  mergedMissing.slice(0, 60).forEach(([term, count], i) => {
    console.log(`${String(i + 1).padStart(4)} | ${String(count).padStart(5)} | ${term}`);
  });

  console.log(`\n── TOP 30 KEY GAPS (column P only) ──`);
  missingGaps.slice(0, 30).forEach(([term, count], i) => {
    console.log(`${String(i + 1).padStart(4)} | ${String(count).padStart(5)} | ${term}`);
  });

  console.log(`\n── SAMPLE JOBS WITH ATS < 90 (first 15) ──`);
  lowScoreRows.slice(0, 15).forEach((r) => {
    console.log(`  [${r.ats}%] ${r.company} — ${r.title}`);
    console.log(`        gaps: ${r.gaps.join(", ") || "(none)"}`);
  });

  // Write a JSON file for easy copy-paste into resume
  const out = {
    generatedAt: new Date().toISOString(),
    rowsScanned: totalRows,
    rowsWithGaps,
    rowsWithRecs,
    rowsBelow90: lowScoreRows.length,
    topMissingSkills: mergedMissing.slice(0, 60).map(([term, count]) => ({ skill: term, count })),
  };
  const outPath = "data/missing-skills-report.json";
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n✅  Full report written to ${outPath}`);
}

import { writeFileSync } from "fs";
main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
