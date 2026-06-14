/**
 * @jest-environment node
 */

import { describe, it, expect } from "@jest/globals";
import {
  buildResumeSummaryForGemini,
  serializeResumeSummaryForGemini,
  MAX_RESUME_SUMMARY_CHARS,
} from "../../scripts/lib/resume-ats-context.mjs";

const sampleResume = {
  personalInfo: {
    title: "",
    summary: "Software engineer with React, Node.js, and TypeScript experience.",
  },
  skills: [{ title: "Languages", skills: ["TypeScript", "JavaScript", "Python"] }],
  experience: [
    {
      companyName: "Acme Corp",
      role: "Software Engineer",
      technologies: ["React", "Node.js"],
      points: [
        "Built scalable APIs serving 1M requests per day.",
        "Led migration to TypeScript across the frontend monorepo.",
      ],
    },
  ],
  projects: [
    {
      name: "Portfolio",
      stack: ["Next.js", "Tailwind"],
      description: "Personal site with admin job board and resume tooling.",
    },
  ],
};

describe("buildResumeSummaryForGemini", () => {
  it("includes summary, experience bullets, and project descriptions", () => {
    const summary = buildResumeSummaryForGemini(sampleResume);

    expect(summary.summary).toContain("Software engineer");
    expect(summary.experience[0].points).toHaveLength(2);
    expect(summary.experience[0].points[0]).toContain("scalable APIs");
    expect(summary.projects[0].description).toContain("admin job board");
  });

  it("serializes within MAX_RESUME_SUMMARY_CHARS", () => {
    const json = serializeResumeSummaryForGemini(sampleResume);
    expect(json.length).toBeLessThanOrEqual(MAX_RESUME_SUMMARY_CHARS);
    const parsed = JSON.parse(json);
    expect(parsed.summary).toBeTruthy();
    expect(parsed.experience?.[0]?.points?.length).toBeGreaterThan(0);
  });

  it("truncates large resumes instead of dropping bullets entirely", () => {
    const hugeResume = {
      ...sampleResume,
      personalInfo: {
        ...sampleResume.personalInfo,
        summary: "x".repeat(4000),
      },
      experience: Array.from({ length: 8 }, (_, i) => ({
        companyName: `Company ${i}`,
        role: `Role ${i}`,
        technologies: ["React", "Node.js", "TypeScript", "AWS", "GCP", "Docker"],
        points: Array.from({ length: 6 }, (__, j) => `Bullet ${i}-${j} `.repeat(40)),
      })),
      projects: Array.from({ length: 6 }, (_, i) => ({
        name: `Project ${i}`,
        stack: ["Next.js", "React", "Node"],
        description: `Description ${i} `.repeat(80),
      })),
    };

    const summary = buildResumeSummaryForGemini(hugeResume);
    const json = serializeResumeSummaryForGemini(hugeResume);

    expect(json.length).toBeLessThanOrEqual(MAX_RESUME_SUMMARY_CHARS);
    expect(summary.experience.length).toBeGreaterThan(0);
    expect(summary.experience[0].points?.length).toBeGreaterThan(0);
    expect(summary.projects[0].description.length).toBeGreaterThan(0);
  });
});
