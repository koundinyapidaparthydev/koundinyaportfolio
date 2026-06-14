import {
  normalizeSkillCategories,
  normalizeParsedTailorResponse,
  safeLower,
} from "../../scripts/lib/resume-normalize.mjs";
import { sanitizeTailoredResume } from "../../scripts/lib/resume-quality.mjs";

const base = {
  personalInfo: { summary: "Engineer with React experience." },
  skills: [{ id: "1", title: "Frontend", skills: ["React", "TypeScript"] }],
  experience: [
    {
      id: "exp-1",
      companyName: "Acme",
      role: "Engineer",
      date: "2024",
      points: ["Built UI with React."],
    },
  ],
  education: [],
  projects: [],
};

describe("resume-normalize", () => {
  it("coerces object-shaped skills into categories", () => {
    const cats = normalizeSkillCategories({ Frontend: ["React"], Backend: "Node" });
    expect(cats).toHaveLength(2);
    expect(cats[0].skills).toEqual(["React"]);
    expect(cats[1].skills).toEqual(["Node"]);
  });

  it("coerces non-array skills to empty fallback", () => {
    const cats = normalizeSkillCategories("React", base.skills);
    expect(cats).toEqual(base.skills);
  });

  it("normalizes parsed tailor response before sanitize", () => {
    const shaped = normalizeParsedTailorResponse(base, {
      skills: { Tools: ["React"] },
      personalInfo: {
        summary: [
          "React engineer with TypeScript experience building scalable web applications.",
        ],
      },
      coverLetter: ["Thanks", "for", "reading"],
    });
    const sanitized = sanitizeTailoredResume(base, shaped);
    expect(sanitized.skills[0].skills).toContain("React");
    expect(sanitized.personalInfo.summary).toContain("React engineer");
  });

  it("safeLower handles arrays and objects", () => {
    expect(safeLower(["React", "Node"])).toBe("react node");
    expect(safeLower(null)).toBe("");
  });
});
