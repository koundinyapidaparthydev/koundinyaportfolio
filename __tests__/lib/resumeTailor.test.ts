/**
 * @jest-environment node
 */

import { extractJsonObject } from "@/lib/resumeTailor";

const VALID_RESUME_JSON = {
  personalInfo: {
    name: "Test User",
    title: "",
    email: "test@example.com",
    summary: "Engineer with React experience.",
  },
  education: [],
  experience: [],
  skills: [],
  projects: [],
  coverLetter: "Dear Hiring Manager,\n\nParagraph.\n\nThanks,\nTest",
};

const VALID_JSON_TEXT = JSON.stringify(VALID_RESUME_JSON);

describe("extractJsonObject", () => {
  it("parses clean JSON", () => {
    const parsed = extractJsonObject(VALID_JSON_TEXT);
    expect(parsed.personalInfo).toEqual(VALID_RESUME_JSON.personalInfo);
  });

  it("parses JSON wrapped in ```json fences", () => {
    const parsed = extractJsonObject("```json\n" + VALID_JSON_TEXT + "\n```");
    expect(parsed.coverLetter).toBe(VALID_RESUME_JSON.coverLetter);
  });

  it("parses JSON wrapped in plain ``` fences", () => {
    const parsed = extractJsonObject("```\n" + VALID_JSON_TEXT + "\n```");
    expect(parsed.coverLetter).toBe(VALID_RESUME_JSON.coverLetter);
  });

  it("parses JSON with trailing explanation text", () => {
    const parsed = extractJsonObject(VALID_JSON_TEXT + "\n\nTailored for the role.");
    expect(parsed.personalInfo).toBeDefined();
  });

  it("parses JSON with leading text", () => {
    const parsed = extractJsonObject("Here is the resume:\n\n" + VALID_JSON_TEXT);
    expect(parsed.personalInfo).toBeDefined();
  });

  it("parses JSON with both leading and trailing text", () => {
    const parsed = extractJsonObject("Sure:\n" + VALID_JSON_TEXT + "\n\nDone.");
    expect(parsed.personalInfo).toBeDefined();
  });

  it("handles ```JSON uppercase fence", () => {
    const parsed = extractJsonObject("```JSON\n" + VALID_JSON_TEXT + "\n```");
    expect(parsed.personalInfo).toBeDefined();
  });

  it("handles nested braces inside string values", () => {
    const nested = {
      ...VALID_RESUME_JSON,
      personalInfo: {
        ...VALID_RESUME_JSON.personalInfo,
        summary: "Uses {React} and TypeScript daily.",
      },
    };
    const parsed = extractJsonObject(JSON.stringify(nested));
    expect(parsed.personalInfo).toEqual(nested.personalInfo);
  });

  it("throws on non-JSON text", () => {
    expect(() => extractJsonObject("I cannot process this.")).toThrow();
  });

  it("throws on malformed JSON", () => {
    expect(() => extractJsonObject("{ invalid json }")).toThrow();
  });

  it("throws on empty string", () => {
    expect(() => extractJsonObject("")).toThrow();
  });
});
