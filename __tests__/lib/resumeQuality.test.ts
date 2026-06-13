import {
  validateTailoredResume,
  AI_BUZZWORDS,
  MIN_ATS_IMPROVEMENT,
  TARGET_TAILORED_ATS,
} from "@/lib/resumeQuality";
import type { Resume } from "@/types/resume";

function baseResume(): Resume {
  return {
    personalInfo: {
      name: "Test User",
      email: "test@example.com",
      phone: "555-0000",
      location: "New York, NY",
      linkedin: "linkedin.com/in/test",
      github: "github.com/test",
      summary:
        "Software engineer with 3+ years building web apps at Anchor using React and Node.js.",
    },
    education: [
      {
        id: "edu-1",
        institution: "Pace University",
        degree: "MS",
        field: "Computer Science",
        graduationDate: "May 2025",
        location: "NY",
      },
    ],
    experience: [
      {
        id: "exp-1",
        companyName: "Anchor Operating System",
        role: "Software Engineer",
        location: "Remote",
        date: "2024 – Present",
        startDate: "2024",
        endDate: "Present",
        points: ["Built dashboard features with React and TypeScript."],
      },
    ],
    skills: [
      { id: "sk-1", title: "Frontend", skills: ["React", "TypeScript"] },
    ],
    projects: [],
  };
}

describe("validateTailoredResume", () => {
  it("passes a humanized tailored resume with ATS lift", () => {
    const base = baseResume();
    const tailored: Resume = {
      ...base,
      personalInfo: {
        ...base.personalInfo,
        title: "",
        summary:
          "Software engineer with 3+ years building production web apps. At Anchor I shipped React dashboards; this maps well to Stripe's payments platform and product engineering culture.",
      },
    };

    const result = validateTailoredResume(base, tailored, {
      company: "Stripe",
      title: "Software Engineer",
      preAtsScore: 62,
      postAtsScore: 78,
    });

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when headline title is present", () => {
    const base = baseResume();
    const tailored: Resume = {
      ...base,
      personalInfo: {
        ...base.personalInfo,
        title: "Full Stack Engineer",
        summary: "Engineer with experience at Anchor building React apps for Stripe payments team.",
      },
    };

    const result = validateTailoredResume(base, tailored, {
      company: "Stripe",
      title: "SWE",
      preAtsScore: 60,
      postAtsScore: 80,
    });

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === "headline_title")).toBe(true);
  });

  it("fails on AI buzzwords", () => {
    const base = baseResume();
    const tailored: Resume = {
      ...base,
      personalInfo: {
        ...base.personalInfo,
        summary:
          "Results-driven engineer who leveraged cutting-edge tech to spearhead initiatives at Anchor for the Stripe team.",
      },
    };

    const result = validateTailoredResume(base, tailored, {
      company: "Stripe",
      title: "SWE",
      preAtsScore: 60,
      postAtsScore: 80,
    });

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === "ai_buzzwords_resume")).toBe(true);
  });

  it("fails when ATS does not improve meaningfully", () => {
    const base = baseResume();
    const tailored: Resume = {
      ...base,
      personalInfo: {
        ...base.personalInfo,
        summary:
          "Software engineer with 3+ years at Anchor building React dashboards, aligned with Stripe's product engineering needs.",
      },
    };

    const result = validateTailoredResume(base, tailored, {
      company: "Stripe",
      title: "SWE",
      preAtsScore: 70,
      postAtsScore: 72,
    });

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === "ats_no_lift")).toBe(true);
  });

  it("fails when experience companies are invented", () => {
    const base = baseResume();
    const tailored: Resume = {
      ...base,
      experience: [
        {
          ...base.experience[0],
          companyName: "Stripe Inc",
        },
      ],
    };

    const result = validateTailoredResume(base, tailored, {
      company: "Stripe",
      title: "SWE",
      preAtsScore: 60,
      postAtsScore: 80,
    });

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === "experience_structure")).toBe(true);
  });

  it("exports expected ATS constants", () => {
    expect(TARGET_TAILORED_ATS).toBe(75);
    expect(MIN_ATS_IMPROVEMENT).toBe(5);
    expect(AI_BUZZWORDS.length).toBeGreaterThan(10);
  });
});
