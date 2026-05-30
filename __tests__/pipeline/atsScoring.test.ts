/**
 * @jest-environment node
 *
 * __tests__/pipeline/atsScoring.test.ts
 *
 * Comprehensive tests for the ATS (Applicant Tracking System) scoring
 * algorithm used in the auto-apply pipeline.
 *
 * The scorer:
 *   - Takes a resume text and a job description text
 *   - Returns { score: number (0-100), matched: string[], missing: string[] }
 *   - score = Math.round((matchedCount / totalKeywords) * 100)  capped at 100
 *   - Keyword matching is case-insensitive
 *   - Matched = keywords found in resume; Missing = keywords not found
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline ATS scoring logic (from lib/gcsUpload.ts / pipeline)
// ─────────────────────────────────────────────────────────────────────────────

interface AtsResult {
  score: number;
  matched: string[];
  missing: string[];
}

function extractKeywords(jobDescription: string): string[] {
  // Normalize and split by common delimiters, filter short words
  const words = jobDescription
    .toLowerCase()
    .replace(/[^a-z0-9\s+#]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  // Deduplicate
  return [...new Set(words)];
}

function scoreResume(resumeText: string, jobDescription: string): AtsResult {
  if (!jobDescription || !resumeText) {
    return { score: 0, matched: [], missing: [] };
  }

  const keywords = extractKeywords(jobDescription);
  if (keywords.length === 0) {
    return { score: 0, matched: [], missing: [] };
  }

  const resumeLower = resumeText.toLowerCase();

  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of keywords) {
    if (resumeLower.includes(kw)) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  const score = Math.min(100, Math.round((matched.length / keywords.length) * 100));
  return { score, matched, missing };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper fixture data
// ─────────────────────────────────────────────────────────────────────────────

const FULL_STACK_JD = `
  We are looking for a Senior Software Engineer with experience in React, Node.js, TypeScript,
  and PostgreSQL. You will build scalable microservices, work with REST APIs, and deploy using
  Docker and Kubernetes on AWS. Experience with CI/CD pipelines (GitHub Actions) is a plus.
  Strong understanding of system design, data structures, and algorithms required.
`;

const BACKEND_JD = `
  Backend Software Engineer — Python, Django, FastAPI, PostgreSQL, Redis, Celery, AWS S3,
  Docker. Proficiency with SQL queries and ORM frameworks. Understanding of distributed
  systems, event-driven architectures, and message queues (Kafka, RabbitMQ) preferred.
`;

const FRONTEND_JD = `
  Frontend Developer — React, TypeScript, Next.js, Tailwind CSS, GraphQL, Apollo Client.
  Must understand accessibility (WCAG), responsive design, browser performance optimisation,
  and cross-browser compatibility. Experience with Jest and React Testing Library preferred.
`;

const DEVOPS_JD = `
  DevOps Engineer — Kubernetes, Terraform, Ansible, Helm, AWS, GCP, CI/CD, Jenkins,
  GitHub Actions, Prometheus, Grafana. Strong Linux and shell scripting skills required.
  Experience with infrastructure as code (IaC) and security best practices.
`;

const STRONG_RESUME = `
  Software Engineer with 5+ years of experience in React, Node.js, TypeScript, and PostgreSQL.
  Built scalable microservices and deployed on AWS using Docker and Kubernetes.
  Proficient in REST APIs, GraphQL, CI/CD pipelines (GitHub Actions), system design,
  data structures, and algorithms.
  Also experienced in Python, Django, FastAPI, Redis, Kafka.
  Frontend skills: Next.js, Tailwind CSS, responsive design, accessibility.
  DevOps: Terraform, Helm, Prometheus, Grafana, Jenkins, Linux.
`;

const WEAK_RESUME = `
  Project Manager with 10 years of experience leading cross-functional teams.
  Excellent communication and stakeholder management skills. MBA from top university.
  Managed budgets, timelines, and vendor relationships in financial services industry.
`;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Score computation fundamentals
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreResume – fundamentals", () => {
  it("returns score 0 for empty resume", () => {
    const { score } = scoreResume("", FULL_STACK_JD);
    expect(score).toBe(0);
  });

  it("returns score 0 for empty job description", () => {
    const { score } = scoreResume(STRONG_RESUME, "");
    expect(score).toBe(0);
  });

  it("returns empty matched and missing for empty inputs", () => {
    const result = scoreResume("", "");
    expect(result.matched).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  it("returns score 0 for empty resume with non-empty JD", () => {
    const result = scoreResume("", FULL_STACK_JD);
    expect(result.score).toBe(0);
    expect(result.matched).toHaveLength(0);
  });

  it("score is always between 0 and 100 (inclusive)", () => {
    const result = scoreResume(STRONG_RESUME, FULL_STACK_JD);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("score is always an integer (no fractions)", () => {
    const result = scoreResume(STRONG_RESUME, FULL_STACK_JD);
    expect(result.score % 1).toBe(0);
  });

  it("matched + missing = total extracted keywords", () => {
    const result = scoreResume(STRONG_RESUME, FULL_STACK_JD);
    const keywords = extractKeywords(FULL_STACK_JD);
    expect(result.matched.length + result.missing.length).toBe(keywords.length);
  });

  it("matched and missing arrays have no overlap", () => {
    const result = scoreResume(STRONG_RESUME, FULL_STACK_JD);
    const matchedSet = new Set(result.matched);
    for (const kw of result.missing) {
      expect(matchedSet.has(kw)).toBe(false);
    }
  });

  it("no duplicates in matched array", () => {
    const result = scoreResume(STRONG_RESUME, FULL_STACK_JD);
    const unique = new Set(result.matched);
    expect(unique.size).toBe(result.matched.length);
  });

  it("no duplicates in missing array", () => {
    const result = scoreResume(STRONG_RESUME, FULL_STACK_JD);
    const unique = new Set(result.missing);
    expect(unique.size).toBe(result.missing.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Case insensitivity
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreResume – case insensitivity", () => {
  it("matches keyword regardless of resume casing (uppercase)", () => {
    const resume = "REACT NODE.JS TYPESCRIPT POSTGRESQL";
    const result = scoreResume(resume, "react node typescript postgresql");
    expect(result.matched.length).toBeGreaterThan(0);
  });

  it("matches keyword regardless of JD casing (uppercase JD)", () => {
    const resume = "react node typescript";
    const result = scoreResume(resume, "REACT NODE TYPESCRIPT");
    expect(result.matched.length).toBeGreaterThan(0);
  });

  it("matches mixed case in both resume and JD", () => {
    const resume = "Experienced in React.js and TypeScript development";
    const jd = "looking for REACT developer with TYPESCRIPT";
    const result = scoreResume(resume, jd);
    expect(result.matched).toContain("react");
    expect(result.matched).toContain("typescript");
  });

  it("title case in JD matches lowercase in resume", () => {
    const result = scoreResume("docker kubernetes", "Docker Kubernetes");
    expect(result.matched).toContain("docker");
    expect(result.matched).toContain("kubernetes");
  });

  it("all matched keywords are returned in lowercase", () => {
    const result = scoreResume("React TypeScript", "REACT TYPESCRIPT");
    for (const kw of result.matched) {
      expect(kw).toBe(kw.toLowerCase());
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Scoring thresholds (strong vs weak resume)
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreResume – strong vs weak resume", () => {
  it("strong resume scores higher than weak resume for full-stack JD", () => {
    const strong = scoreResume(STRONG_RESUME, FULL_STACK_JD);
    const weak = scoreResume(WEAK_RESUME, FULL_STACK_JD);
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("strong resume scores higher than weak resume for backend JD", () => {
    const strong = scoreResume(STRONG_RESUME, BACKEND_JD);
    const weak = scoreResume(WEAK_RESUME, BACKEND_JD);
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("strong resume scores higher than weak resume for frontend JD", () => {
    const strong = scoreResume(STRONG_RESUME, FRONTEND_JD);
    const weak = scoreResume(WEAK_RESUME, FRONTEND_JD);
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("strong resume scores higher than weak resume for devops JD", () => {
    const strong = scoreResume(STRONG_RESUME, DEVOPS_JD);
    const weak = scoreResume(WEAK_RESUME, DEVOPS_JD);
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("weak resume scores below 30 for full-stack JD", () => {
    const { score } = scoreResume(WEAK_RESUME, FULL_STACK_JD);
    expect(score).toBeLessThan(30);
  });

  it("strong resume scores above 50 for full-stack JD", () => {
    const { score } = scoreResume(STRONG_RESUME, FULL_STACK_JD);
    expect(score).toBeGreaterThan(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Perfect match (resume copies JD verbatim)
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreResume – perfect match edge cases", () => {
  it("100% match when resume is identical to JD", () => {
    const { score, missing } = scoreResume(FULL_STACK_JD, FULL_STACK_JD);
    expect(score).toBe(100);
    expect(missing).toHaveLength(0);
  });

  it("100% match when resume contains all JD keywords as substrings", () => {
    const jd = "react node typescript";
    const resume = "i use react and node and typescript daily";
    const { score } = scoreResume(resume, jd);
    expect(score).toBe(100);
  });

  it("score capped at 100 even if somehow over-matched", () => {
    const { score } = scoreResume(FULL_STACK_JD.repeat(3), FULL_STACK_JD);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("0% match when resume has no common words with JD", () => {
    const { score, matched } = scoreResume("cooking baking gardening art music", "programming software engineer code");
    expect(score).toBe(0);
    expect(matched).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Specific keyword presence
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreResume – specific keyword matching", () => {
  it("matches 'react' from JD", () => {
    const { matched } = scoreResume("I work with react and redux", "react developer needed");
    expect(matched).toContain("react");
  });

  it("does not match 'react' when absent from resume", () => {
    const { missing } = scoreResume("I work with vue and angular", "react developer needed");
    expect(missing).toContain("react");
  });

  it("matches 'typescript' from JD", () => {
    const { matched } = scoreResume("TypeScript is my primary language", "TypeScript required");
    expect(matched).toContain("typescript");
  });

  it("matches 'python' from JD", () => {
    const { matched } = scoreResume("Python Django FastAPI", "python developer needed");
    expect(matched).toContain("python");
  });

  it("matches 'docker' from JD", () => {
    const { matched } = scoreResume("deploy with Docker and Kubernetes", "docker kubernetes required");
    expect(matched).toContain("docker");
  });

  it("matches 'kubernetes' from JD", () => {
    const { matched } = scoreResume("kubernetes k8s deployment", "kubernetes required");
    expect(matched).toContain("kubernetes");
  });

  it("matches 'aws' as a keyword", () => {
    const { matched } = scoreResume("AWS EC2 S3 Lambda deployment", "aws cloud services");
    expect(matched).toContain("aws");
  });

  it("matches 'postgresql' from JD", () => {
    const { matched } = scoreResume("PostgreSQL and MySQL databases", "postgresql preferred");
    expect(matched).toContain("postgresql");
  });

  it("matching is substring-based", () => {
    // 'engineer' should match because resume has 'engineering'
    const { matched } = scoreResume("software engineering background", "software engineer needed");
    expect(matched).toContain("engineer");
  });

  it("short words (< 3 chars) are excluded from keywords", () => {
    const jd = "we are at it to do";
    const keywords = extractKeywords(jd);
    for (const kw of keywords) {
      expect(kw.length).toBeGreaterThanOrEqual(3);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. extractKeywords specifics
// ─────────────────────────────────────────────────────────────────────────────

describe("extractKeywords", () => {
  it("returns empty array for empty string", () => {
    expect(extractKeywords("")).toHaveLength(0);
  });

  it("returns lowercase keywords", () => {
    const kws = extractKeywords("React TypeScript Node.js");
    for (const kw of kws) {
      expect(kw).toBe(kw.toLowerCase());
    }
  });

  it("deduplicates repeated keywords", () => {
    const kws = extractKeywords("react react react");
    expect(kws.filter((k) => k === "react")).toHaveLength(1);
  });

  it("strips punctuation from keywords", () => {
    const kws = extractKeywords("React.js, Node.js!");
    // 'js' should appear (if >= 3 chars... 'js' is 2 chars, so filtered out)
    // But 'react' and 'node' should be there
    expect(kws).toContain("react");
    expect(kws).toContain("node");
  });

  it("filters out words shorter than 3 characters", () => {
    const kws = extractKeywords("do it at an the");
    for (const kw of kws) {
      expect(kw.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("handles keywords with numbers (e.g., 'node18', 'python3')", () => {
    const kws = extractKeywords("Node18 Python3 React18");
    expect(kws.some((k) => k.includes("node18") || k.includes("python3") || k.includes("react18"))).toBe(true);
  });

  it("handles 'c++' and 'c#' gracefully (special chars stripped)", () => {
    expect(() => extractKeywords("c++ c# rust golang")).not.toThrow();
  });

  it("handles very long job description without throwing", () => {
    const longJD = FULL_STACK_JD.repeat(50);
    expect(() => extractKeywords(longJD)).not.toThrow();
  });

  it("handles only punctuation without throwing", () => {
    expect(() => extractKeywords("!!! ??? ...")).not.toThrow();
  });

  it("handles null-like undefined without crashing (when input is '')", () => {
    expect(() => extractKeywords("")).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. ATS threshold gate logic (score >= 70 → "pending", else → "low-ats")
// ─────────────────────────────────────────────────────────────────────────────

function getApplyStatus(score: number): "pending" | "low-ats" {
  return score >= 70 ? "pending" : "low-ats";
}

describe("getApplyStatus – ATS threshold gate", () => {
  it("score 100 → 'pending'", () => {
    expect(getApplyStatus(100)).toBe("pending");
  });

  it("score 70 → 'pending' (exact threshold)", () => {
    expect(getApplyStatus(70)).toBe("pending");
  });

  it("score 71 → 'pending'", () => {
    expect(getApplyStatus(71)).toBe("pending");
  });

  it("score 85 → 'pending'", () => {
    expect(getApplyStatus(85)).toBe("pending");
  });

  it("score 99 → 'pending'", () => {
    expect(getApplyStatus(99)).toBe("pending");
  });

  it("score 69 → 'low-ats' (just below threshold)", () => {
    expect(getApplyStatus(69)).toBe("low-ats");
  });

  it("score 50 → 'low-ats'", () => {
    expect(getApplyStatus(50)).toBe("low-ats");
  });

  it("score 0 → 'low-ats'", () => {
    expect(getApplyStatus(0)).toBe("low-ats");
  });

  it("score 1 → 'low-ats'", () => {
    expect(getApplyStatus(1)).toBe("low-ats");
  });

  it("score 30 → 'low-ats'", () => {
    expect(getApplyStatus(30)).toBe("low-ats");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Full pipeline simulation (score → status → action)
// ─────────────────────────────────────────────────────────────────────────────

describe("ATS pipeline simulation", () => {
  interface JobApplication {
    jobTitle: string;
    jd: string;
    resume: string;
  }

  function processApplication(app: JobApplication) {
    const result = scoreResume(app.resume, app.jd);
    const status = getApplyStatus(result.score);
    return { ...result, status, jobTitle: app.jobTitle };
  }

  it("full-stack engineer application: strong resume gets pending", () => {
    const result = processApplication({
      jobTitle: "Senior Software Engineer",
      jd: FULL_STACK_JD,
      resume: STRONG_RESUME,
    });
    expect(result.status).toBe("pending");
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("full-stack engineer application: weak resume gets low-ats", () => {
    const result = processApplication({
      jobTitle: "Senior Software Engineer",
      jd: FULL_STACK_JD,
      resume: WEAK_RESUME,
    });
    expect(result.status).toBe("low-ats");
    expect(result.score).toBeLessThan(70);
  });

  it("returns matched skills list", () => {
    const result = processApplication({
      jobTitle: "Backend Engineer",
      jd: BACKEND_JD,
      resume: STRONG_RESUME,
    });
    expect(Array.isArray(result.matched)).toBe(true);
    expect(result.matched.length).toBeGreaterThan(0);
  });

  it("returns missing skills list", () => {
    const result = processApplication({
      jobTitle: "Backend Engineer",
      jd: BACKEND_JD,
      resume: WEAK_RESUME,
    });
    expect(Array.isArray(result.missing)).toBe(true);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("preserves job title in output", () => {
    const result = processApplication({
      jobTitle: "DevOps Engineer",
      jd: DEVOPS_JD,
      resume: STRONG_RESUME,
    });
    expect(result.jobTitle).toBe("DevOps Engineer");
  });

  it("processes array of applications without error", () => {
    const apps: JobApplication[] = [
      { jobTitle: "SWE", jd: FULL_STACK_JD, resume: STRONG_RESUME },
      { jobTitle: "Backend", jd: BACKEND_JD, resume: WEAK_RESUME },
      { jobTitle: "Frontend", jd: FRONTEND_JD, resume: STRONG_RESUME },
    ];
    const results = apps.map(processApplication);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.status).toMatch(/^(pending|low-ats)$/);
    }
  });

  it("pipeline result score matches scoreResume independently", () => {
    const app = { jobTitle: "SWE", jd: FULL_STACK_JD, resume: STRONG_RESUME };
    const direct = scoreResume(app.resume, app.jd);
    const piped = processApplication(app);
    expect(piped.score).toBe(direct.score);
  });

  it("processes 100 identical applications consistently", () => {
    const app = { jobTitle: "SWE", jd: FULL_STACK_JD, resume: STRONG_RESUME };
    const scores = Array.from({ length: 100 }, () => processApplication(app).score);
    const unique = new Set(scores);
    expect(unique.size).toBe(1); // all identical
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Edge cases and boundary values
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreResume – edge cases", () => {
  it("handles JD with only special characters", () => {
    const result = scoreResume("software engineer", "!!! ??? >>><<<");
    expect(result.score).toBe(0);
    expect(result.matched).toHaveLength(0);
  });

  it("handles very large resume text", () => {
    const longResume = STRONG_RESUME.repeat(100);
    expect(() => scoreResume(longResume, FULL_STACK_JD)).not.toThrow();
  });

  it("handles very large JD text", () => {
    const longJD = FULL_STACK_JD.repeat(50);
    expect(() => scoreResume(STRONG_RESUME, longJD)).not.toThrow();
  });

  it("handles newlines and tabs in JD", () => {
    const jd = "react\nnode\ttypescript\npostgresql";
    const { matched } = scoreResume("react node typescript postgresql", jd);
    expect(matched.length).toBeGreaterThan(0);
  });

  it("handles multiple spaces in resume", () => {
    const resume = "react    node    typescript";
    const result = scoreResume(resume, "react node typescript");
    expect(result.matched.length).toBeGreaterThan(0);
  });

  it("handles numbers-only JD", () => {
    const result = scoreResume("2024 2023 five years", "5 years 10 years 2 experience");
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("handles unicode characters without throwing", () => {
    expect(() => scoreResume("dévelopeur résumé", "développeur javascript")).not.toThrow();
  });

  it("returns arrays (not undefined) for all properties", () => {
    const result = scoreResume("", "");
    expect(result.matched).toBeDefined();
    expect(result.missing).toBeDefined();
  });

  it("score is a number (not string or NaN)", () => {
    const { score } = scoreResume(STRONG_RESUME, FULL_STACK_JD);
    expect(typeof score).toBe("number");
    expect(isNaN(score)).toBe(false);
  });

  it("handles JD with only stopwords (all < 3 chars)", () => {
    const jd = "we do it to go up";
    const result = scoreResume("any resume text here", jd);
    // After filtering out < 3 chars... "the" would pass but not "we do it to go up"
    // Some may pass: none of those are >= 3 chars... actually "the" is 3 chars
    // Our JD: all words are < 3 chars, so score = 0 (no keywords)
    expect(result.score).toBe(0);
  });
});
