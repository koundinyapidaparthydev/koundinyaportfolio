/**
 * @jest-environment node
 */

import { describe, it, expect } from "@jest/globals";
import { normalizeGeminiTextField } from "../../scripts/lib/resume-tailor.mjs";
import { TAILOR_SAVE_MIN_SCORE } from "../../scripts/lib/ats-config.mjs";

describe("normalizeGeminiTextField", () => {
  it("joins array keyGaps without throwing", () => {
    expect(normalizeGeminiTextField(["React", "TypeScript"])).toBe("React, TypeScript");
  });

  it("passes through strings", () => {
    expect(normalizeGeminiTextField("missing kubernetes")).toBe("missing kubernetes");
  });

  it("returns empty string for nullish values", () => {
    expect(normalizeGeminiTextField(null)).toBe("");
    expect(normalizeGeminiTextField(undefined)).toBe("");
  });
});

describe("verify eligibility thresholds", () => {
  it("uses 90% as the save minimum for compliance checks", () => {
    expect(TAILOR_SAVE_MIN_SCORE).toBe(90);
  });
});
