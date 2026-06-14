/**
 * @jest-environment node
 */

import { describe, it, expect } from "@jest/globals";
import { needsTailoring } from "../../scripts/lib/tailor-eligibility.mjs";
import {
  SKIP_TAILOR_INITIAL_ATS,
  TAILOR_SAVE_MIN_SCORE,
  MAX_TAILOR_ATTEMPTS,
} from "../../scripts/lib/ats-config.mjs";

const LONG_DESC =
  "We need TypeScript, React, Node.js, and Python experience for this senior engineering role. " +
  "x".repeat(120);
const baseResume = {
  skills: [{ title: "Languages", skills: ["TypeScript", "React", "Node.js", "Python"] }],
  experience: [],
  projects: [],
};

function row(overrides: Record<number, string> = {}) {
  const r = Array(21).fill("");
  r[6] = LONG_DESC;
  r[9] = "65";
  r[17] = "no";
  r[20] = "0";
  for (const [key, value] of Object.entries(overrides)) {
    r[Number(key)] = value;
  }
  return r;
}

describe("needsTailoring", () => {
  it("skips when pre-tailor score (column S) is at or above skip threshold", () => {
    const r = row({ 18: "91", 9: "65" });
    expect(needsTailoring(r, baseResume)).toBe(false);
  });

  it("skips when base score (column J) is at or above skip threshold with saved PDF", () => {
    const r = row({
      9: String(SKIP_TAILOR_INITIAL_ATS),
      7: "https://storage.example/resume.pdf",
      17: "yes",
    });
    expect(needsTailoring(r, baseResume)).toBe(false);
  });

  it("skips when already saved with URL and post score at save min", () => {
    const r = row({
      9: String(TAILOR_SAVE_MIN_SCORE),
      7: "https://storage.example/resume.pdf",
      17: "yes",
    });
    expect(needsTailoring(r, baseResume)).toBe(false);
  });

  it("needs tailoring when post score is below save min and base is below skip threshold", () => {
    const r = row({ 9: "85", 18: "70" });
    expect(needsTailoring(r, baseResume)).toBe(true);
  });

  it("retries stuck upload when score meets save min but no URL and R is not yes", () => {
    const r = row({ 9: String(TAILOR_SAVE_MIN_SCORE), 7: "", 17: "no" });
    expect(needsTailoring(r, baseResume)).toBe(true);
  });

  it("skips when tailor attempts are exhausted", () => {
    const r = row({ 9: "80", 20: String(MAX_TAILOR_ATTEMPTS) });
    expect(needsTailoring(r, baseResume)).toBe(false);
  });

  it("skips applied jobs", () => {
    const r = row({ 10: "applied" });
    expect(needsTailoring(r, baseResume)).toBe(false);
  });

  it("skips short descriptions", () => {
    const r = row({ 6: "too short" });
    expect(needsTailoring(r, baseResume)).toBe(false);
  });
});

describe("ats-config.mjs tailoring constants", () => {
  it("exports aligned 90% skip, target, and save thresholds", () => {
    expect(SKIP_TAILOR_INITIAL_ATS).toBe(90);
    expect(TAILOR_SAVE_MIN_SCORE).toBe(90);
    expect(MAX_TAILOR_ATTEMPTS).toBe(12);
  });
});
