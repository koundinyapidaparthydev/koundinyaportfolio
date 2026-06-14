/**
 * Post-scrape ATS compliance verification — re-score eligible rows and re-queue below 90%.
 */

import { loadResume } from "./resume-loader.mjs";
import { scoreJobWithGemini } from "./gemini-ats.mjs";
import { countSkillMatches } from "./skill-match.mjs";
import { TAILOR_SAVE_MIN_SCORE } from "./ats-config.mjs";
import {
  padRow,
  parseScore,
  isApplied,
  isResumeSaved,
  MIN_DESCRIPTION,
} from "./tailor-eligibility.mjs";

const SHEET_NAME = "Jobs";

function rowNeedsVerify(row) {
  const desc = (row[6] ?? "").trim();
  if (desc.length < MIN_DESCRIPTION) return false;
  if (isApplied(row)) return false;

  const score = parseScore(row[9]);
  const saved = isResumeSaved(row);
  const resumeUrl = (row[7] ?? "").trim();

  if (score !== null && score < TAILOR_SAVE_MIN_SCORE) return true;
  if (saved || resumeUrl) return true;
  return false;
}

/**
 * Re-score eligible rows with the tailor model; re-queue rows below save min.
 * @returns {{ checked: number, belowMin: number, requeued: number, cleared: number }}
 */
export async function verifyAtsComplianceOnSheet(sheets, spreadsheetId, options = {}) {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.log("⏭  Skipping ATS verify — GEMINI_API_KEY not set");
    return { checked: 0, belowMin: 0, requeued: 0, cleared: 0 };
  }

  const resume = options.resume ?? loadResume();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:U`,
  });
  const rows = res.data.values ?? [];
  const updateData = [];
  let checked = 0;
  let belowMin = 0;
  let requeued = 0;
  let cleared = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = padRow(rows[idx]);
    if (!rowNeedsVerify(row)) continue;

    const desc = (row[6] ?? "").trim();
    const { passes } = countSkillMatches(desc, resume);
    if (!passes) continue;

    checked++;
    const sheetRow = idx + 2;
    const title = row[1] ?? "";
    const company = row[0] ?? "";
    const prevScore = parseScore(row[9]);
    const saved = isResumeSaved(row);
    const resumeUrl = (row[7] ?? "").trim();

    const result = await scoreJobWithGemini(title, desc, resume, { useTailorModel: true });
    const newScore = result.score;

    if (newScore !== prevScore) {
      updateData.push(
        { range: `${SHEET_NAME}!J${sheetRow}`, values: [[String(newScore)]] },
        { range: `${SHEET_NAME}!O${sheetRow}`, values: [[result.matchSummary ?? ""]] },
        { range: `${SHEET_NAME}!P${sheetRow}`, values: [[result.keyGaps ?? ""]] },
        { range: `${SHEET_NAME}!Q${sheetRow}`, values: [[result.recommendedKeywords ?? ""]] }
      );
    }

    if (newScore < TAILOR_SAVE_MIN_SCORE) {
      belowMin++;
      updateData.push({ range: `${SHEET_NAME}!U${sheetRow}`, values: [["0"]] });
      requeued++;

      if (saved || resumeUrl) {
        updateData.push(
          { range: `${SHEET_NAME}!H${sheetRow}`, values: [[""]] },
          { range: `${SHEET_NAME}!R${sheetRow}`, values: [["no"]] }
        );
        cleared++;
        console.log(
          `  ↻  ${company} — ${title}: re-score ${newScore}% < ${TAILOR_SAVE_MIN_SCORE}% — cleared saved PDF`
        );
      }
    }
  }

  if (updateData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updateData },
    });
  }

  console.log(
    `🔍  Verify: ${checked} checked, ${belowMin} below ${TAILOR_SAVE_MIN_SCORE}%, ${requeued} re-queued${cleared ? `, ${cleared} cleared` : ""}`
  );
  return { checked, belowMin, requeued, cleared };
}
