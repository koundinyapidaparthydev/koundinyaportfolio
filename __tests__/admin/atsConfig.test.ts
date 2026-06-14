import { describe, it, expect } from "@jest/globals";
import {
  DEFAULT_ATS_MIN_SCORE,
  SKIP_TAILOR_INITIAL_ATS,
  INTERMEDIATE_MILESTONE_SCORE,
  TAILOR_TARGET_SCORE,
  TAILOR_SAVE_MIN_SCORE,
  NON_TAILORED_MIN_SCORE,
  MAX_TAILOR_ATTEMPTS,
  MIN_SKILL_MATCH_COUNT,
} from "@/lib/admin/atsConfig";

describe("atsConfig", () => {
  it("uses 75% as the default minimum ATS score", () => {
    expect(DEFAULT_ATS_MIN_SCORE).toBe(75);
  });

  it("skips tailoring when base ATS is at or above 87%", () => {
    expect(SKIP_TAILOR_INITIAL_ATS).toBe(87);
  });

  it("uses 82% as the phase 1 intermediate milestone", () => {
    expect(INTERMEDIATE_MILESTONE_SCORE).toBe(82);
  });

  it("uses 95% as the phase 2 aspirational target", () => {
    expect(TAILOR_TARGET_SCORE).toBe(95);
  });

  it("requires 91% post-tailor score to save PDF (>90%)", () => {
    expect(TAILOR_SAVE_MIN_SCORE).toBe(91);
  });

  it("aligns non-tailored filter with skip-tailor threshold", () => {
    expect(NON_TAILORED_MIN_SCORE).toBe(SKIP_TAILOR_INITIAL_ATS);
  });

  it("allows up to 7 combined tailor attempts", () => {
    expect(MAX_TAILOR_ATTEMPTS).toBe(7);
  });

  it("requires at least 3 skill matches to tailor", () => {
    expect(MIN_SKILL_MATCH_COUNT).toBe(3);
  });
});
