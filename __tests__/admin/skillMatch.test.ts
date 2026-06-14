import { describe, it, expect } from "@jest/globals";
import {
  isLowSkillFit,
  deprioritizeLowSkillFit,
  MIN_SKILL_MATCH_COUNT,
} from "@/lib/admin/skillMatch";

describe("skillMatch", () => {
  it("requires at least 3 skill matches", () => {
    expect(MIN_SKILL_MATCH_COUNT).toBe(3);
  });

  it("flags jobs below the skill gate", () => {
    expect(isLowSkillFit({ skillMatchCount: "2" })).toBe(true);
    expect(isLowSkillFit({ skillMatchCount: "3" })).toBe(false);
    expect(isLowSkillFit({ skillMatchCount: "" })).toBe(true);
  });

  it("pins low-skill-fit jobs to the bottom", () => {
    const jobs = [
      { company: "Low", skillMatchCount: "1" },
      { company: "High", skillMatchCount: "5" },
      { company: "AlsoLow", skillMatchCount: "0" },
    ];
    expect(deprioritizeLowSkillFit(jobs).map((j) => j.company)).toEqual([
      "High",
      "Low",
      "AlsoLow",
    ]);
  });
});
