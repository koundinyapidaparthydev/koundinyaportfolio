import { describe, it, expect } from "@jest/globals";
import {
  DEFAULT_ATS_MIN_SCORE,
  SKIP_TAILOR_INITIAL_ATS,
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

  it("skips tailoring when base ATS is at or above 90%", () => {
    expect(SKIP_TAILOR_INITIAL_ATS).toBe(90);
  });

  it("uses 90% as the single-phase tailor target", () => {
    expect(TAILOR_TARGET_SCORE).toBe(90);
  });

  it("requires 90% post-tailor score to save PDF", () => {
    expect(TAILOR_SAVE_MIN_SCORE).toBe(90);
  });

  it("aligns non-tailored filter with skip-tailor threshold", () => {
    expect(NON_TAILORED_MIN_SCORE).toBe(SKIP_TAILOR_INITIAL_ATS);
    expect(NON_TAILORED_MIN_SCORE).toBe(90);
  });

  it("allows up to 2 tailor attempts", () => {
    expect(MAX_TAILOR_ATTEMPTS).toBe(2);
  });

  it("requires at least 3 skill matches to tailor", () => {
    expect(MIN_SKILL_MATCH_COUNT).toBe(3);
  });
});
