/**
 * @jest-environment node
 */

import { calculateAtsScore } from "../../scripts/lib/ats-scoring.mjs";

const mockResume = {
  skills: [{ category: "Languages", skills: ["TypeScript", "Python", "React"] }],
  experience: [
    {
      title: "Software Engineer",
      company: "Test Co",
      technologies: ["Node.js", "PostgreSQL"],
      points: ["Built APIs with Express"],
    },
  ],
  projects: [{ name: "Portfolio", stack: ["Next.js", "Tailwind"] }],
};

describe("calculateAtsScore (scripts/lib/ats-scoring.mjs)", () => {
  it("returns 0 for empty description", () => {
    const r = calculateAtsScore("", mockResume);
    expect(r.score).toBe(0);
    expect(r.label).toBe("low");
  });

  it("scores higher when job mentions resume skills", () => {
    const jd = "We need TypeScript, React, Node.js, PostgreSQL experience.";
    const r = calculateAtsScore(jd, mockResume);
    expect(r.score).toBeGreaterThan(30);
    expect(r.matched.length).toBeGreaterThan(0);
  });

  it("returns label tiers", () => {
    const r = calculateAtsScore("engineer software developer", mockResume);
    expect(["high", "medium", "low"]).toContain(r.label);
  });
});
