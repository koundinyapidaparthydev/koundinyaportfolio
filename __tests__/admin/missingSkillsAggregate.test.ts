import type { Job } from "@/app/api/jobs/route";
import {
  aggregateMissingSkills,
  filterMissingSkills,
  parseGapField,
  summarizeMissingSkills,
} from "@/lib/admin/missingSkillsAggregate";
import { gapTermOnResume, extractResumeSkills } from "@/lib/admin/resumeSkills";
import type { Resume } from "@/types/resume";

function job(overrides: Partial<Job> = {}): Job {
  return {
    rowIndex: 2,
    company: "Acme",
    title: "Backend Engineer",
    location: "Remote",
    url: "https://example.com/job",
    category: "general",
    fetchedAt: "2026-06-18T10:00:00.000Z",
    postedAt: "2026-06-18T09:00:00.000Z",
    description: "A".repeat(200),
    ...overrides,
  };
}

const sampleResume: Resume = {
  personalInfo: {
    name: "Test",
    email: "t@example.com",
    phone: "555",
    location: "US",
    linkedin: "linkedin.com/in/test",
    github: "github.com/test",
    summary: "Engineer",
  },
  education: [],
  experience: [
    {
      id: "e1",
      companyName: "Co",
      role: "SWE",
      location: "US",
      date: "2024 – Present",
      startDate: "2024",
      endDate: "Present",
      points: [],
      technologies: ["Kubernetes", "GraphQL"],
    },
  ],
  skills: [{ id: "s1", title: "Backend", skills: ["Node.js", "TypeScript"] }],
  projects: [{ id: "p1", name: "App", stack: ["React"], date: "2024", description: "Demo" }],
};

describe("parseGapField", () => {
  it("splits comma-separated terms", () => {
    expect(parseGapField("Kubernetes, Kafka, system design")).toEqual([
      "Kubernetes",
      "Kafka",
      "system design",
    ]);
  });

  it("filters empty and dash placeholders", () => {
    expect(parseGapField("—, -, Go")).toEqual(["Go"]);
  });
});

describe("aggregateMissingSkills", () => {
  it("merges keyGaps and recommendedKeywords with job counts", () => {
    const jobs = [
      job({
        rowIndex: 2,
        keyGaps: "Kafka, Redis",
        recommendedKeywords: "Kafka, PostgreSQL",
      }),
      job({
        rowIndex: 3,
        company: "Beta",
        keyGaps: "Kafka",
      }),
    ];

    const skills = aggregateMissingSkills(jobs, {
      resumeSkills: extractResumeSkills(sampleResume),
    });

    const kafka = skills.find((s) => s.normalizedKey === "kafka");
    expect(kafka?.jobCount).toBe(2);
    expect(kafka?.keyGapsCount).toBe(2);
    expect(kafka?.keywordsCount).toBe(1);

    const postgres = skills.find((s) => s.normalizedKey === "postgresql");
    expect(postgres?.jobCount).toBe(1);
    expect(postgres?.onResume).toBe(false);
  });

  it("marks terms already on the resume", () => {
    const skills = aggregateMissingSkills(
      [job({ keyGaps: "Kubernetes, Kafka" })],
      { resumeSkills: extractResumeSkills(sampleResume) }
    );

    expect(skills.find((s) => s.normalizedKey === "kubernetes")?.onResume).toBe(true);
    expect(skills.find((s) => s.normalizedKey === "kafka")?.onResume).toBe(false);
  });

  it("respects user status overrides", () => {
    const skills = aggregateMissingSkills([job({ keyGaps: "Kafka" })], {
      resumeSkills: [],
      userStatuses: { kafka: { status: "added" } },
    });
    expect(skills[0]?.userStatus).toBe("added");
  });
});

describe("filterMissingSkills", () => {
  const skills = aggregateMissingSkills(
    [
      job({ rowIndex: 2, keyGaps: "Kafka" }),
      job({ rowIndex: 3, keyGaps: "Kubernetes" }),
    ],
    { resumeSkills: extractResumeSkills(sampleResume) }
  );

  it("filters actionable gaps not on resume", () => {
    const actionable = filterMissingSkills(skills, "actionable");
    expect(actionable.every((s) => !s.onResume && s.userStatus === "open")).toBe(true);
    expect(actionable.some((s) => s.normalizedKey === "kafka")).toBe(true);
    expect(actionable.some((s) => s.normalizedKey === "kubernetes")).toBe(false);
  });
});

describe("summarizeMissingSkills", () => {
  it("counts unique terms and jobs with gaps", () => {
    const skills = aggregateMissingSkills(
      [
        job({ rowIndex: 2, keyGaps: "Kafka" }),
        job({ rowIndex: 3, keyGaps: "Redis" }),
      ],
      { resumeSkills: [] }
    );
    const summary = summarizeMissingSkills(skills);
    expect(summary.uniqueTerms).toBe(2);
    expect(summary.jobsWithGaps).toBe(2);
    expect(summary.actionableCount).toBe(2);
  });
});

describe("gapTermOnResume", () => {
  const resumeSkills = extractResumeSkills(sampleResume);

  it("matches exact and partial skill names", () => {
    expect(gapTermOnResume("Kubernetes", resumeSkills)).toBe(true);
    expect(gapTermOnResume("GraphQL", resumeSkills)).toBe(true);
    expect(gapTermOnResume("Kafka", resumeSkills)).toBe(false);
  });
});
