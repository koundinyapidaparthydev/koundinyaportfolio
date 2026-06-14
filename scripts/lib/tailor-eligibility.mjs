/**
 * Pure eligibility checks for resume tailoring (testable, no I/O).
 */

import { countSkillMatches } from "./skill-match.mjs";
import {
  SKIP_TAILOR_INITIAL_ATS,
  TAILOR_SAVE_MIN_SCORE,
  MAX_TAILOR_ATTEMPTS,
} from "./ats-config.mjs";

export const SHEET_COLS = 21;
export const MIN_DESCRIPTION = 120;

export function padRow(row) {
  const out = [...(row ?? [])];
  while (out.length < SHEET_COLS) out.push("");
  return out;
}

export function parseScore(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function parseAttempts(value) {
  const n = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function isApplied(row) {
  return (row[10] ?? "").trim().toLowerCase() === "applied";
}

export function isResumeSaved(row) {
  return (row[17] ?? "").trim().toLowerCase() === "yes";
}

/** Pre-tailor base ATS from column S, falling back to column J. */
export function preTailorScore(row) {
  return parseScore(row[18]) ?? parseScore(row[9]);
}

export function needsTailoring(row, baseResume) {
  const padded = padRow(row);
  const desc = (padded[6] ?? "").trim();
  if (desc.length < MIN_DESCRIPTION) return false;
  if (isApplied(padded)) return false;

  const postScore = parseScore(padded[9]);
  const resumeUrl = (padded[7] ?? "").trim();
  const saved = isResumeSaved(padded);

  const stuckUpload =
    postScore !== null &&
    postScore >= TAILOR_SAVE_MIN_SCORE &&
    !resumeUrl &&
    !saved &&
    parseAttempts(padded[20]) > 0;

  if (stuckUpload) {
    const prevAttempts = parseAttempts(padded[20]);
    if (prevAttempts >= MAX_TAILOR_ATTEMPTS) return false;
    const { passes } = countSkillMatches(desc, baseResume);
    return passes;
  }

  const preScore = preTailorScore(padded);
  if (preScore !== null && preScore >= SKIP_TAILOR_INITIAL_ATS) return false;

  if (saved && resumeUrl && postScore !== null && postScore >= TAILOR_SAVE_MIN_SCORE) {
    return false;
  }

  if (postScore !== null && postScore >= TAILOR_SAVE_MIN_SCORE) return false;

  const prevAttempts = parseAttempts(padded[20]);
  if (prevAttempts >= MAX_TAILOR_ATTEMPTS) return false;

  const { passes } = countSkillMatches(desc, baseResume);
  return passes;
}
