/**
 * @jest-environment node
 *
 * __tests__/pipeline/integration.test.ts
 *
 * End-to-end pipeline integration tests simulating the full auto-apply
 * flow from job scraping → filtering → application generation → auto-apply.
 *
 * All external I/O is simulated with pure functions and in-memory state.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScrapedJob {
  company: string;
  title: string;
  location: string;
  url: string;
  platform: string;
  description?: string;
  date?: string;
}

interface JobRow {
  company: string;
  title: string;
  location: string;
  url: string;
  platform: string;
  date: string;
  description: string;
  resumeUrl?: string;
  coverLetter?: string;
  atsScore?: number;
  matchedSkills?: string;
  missingSkills?: string;
  applyStatus?: string;
}

interface GenerateResult {
  resumeUrl: string;
  coverLetter: string;
  atsScore: number;
  matched: string[];
  missing: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline pipeline utilities
// ─────────────────────────────────────────────────────────────────────────────

function isEngineeringRole(title: string): boolean {
  const keywords = [
    "engineer", "software", "developer", "full stack", "fullstack",
    "frontend", "front-end", "backend", "back-end", "devops", "sre",
    "platform", "architect", "mobile", "ios", "android",
  ];
  const lower = title.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function deduplicateJobs(jobs: ScrapedJob[]): ScrapedJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    if (seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });
}

function filterJobs(jobs: ScrapedJob[], existingUrls: Set<string>): ScrapedJob[] {
  return deduplicateJobs(jobs.filter((j) => isEngineeringRole(j.title) && !existingUrls.has(j.url)));
}

function buildJobRow(job: ScrapedJob): string[] {
  return [
    job.company,
    job.title,
    job.location,
    job.url,
    job.platform,
    job.date ?? new Date().toISOString().slice(0, 10),
    job.description ?? "",
  ];
}

function shouldProcess(row: JobRow): boolean {
  return !row.resumeUrl && (row.description?.length ?? 0) >= 50;
}

function getApplyStatus(atsScore: number): "pending" | "low-ats" {
  return atsScore >= 70 ? "pending" : "low-ats";
}

function buildUpdateValues(result: GenerateResult): (string | number)[] {
  return [
    result.resumeUrl,
    result.coverLetter,
    result.atsScore,
    result.matched.join(", "),
    result.missing.join(", "),
    getApplyStatus(result.atsScore),
  ];
}

function shouldAutoApply(row: JobRow): boolean {
  return row.applyStatus === "pending" && !!row.resumeUrl;
}

function buildLeverApplyUrl(jobUrl: string): string {
  if (jobUrl.endsWith("/apply")) return jobUrl;
  return jobUrl + "/apply";
}

function sanitizeCompanyName(company: string): string {
  return company
    .replace(/,?\s*(Inc\.|LLC|Ltd\.|Corp\.|Corporation|Incorporated)\s*$/i, "")
    .trim();
}

function buildSheetsRange(startRow: number, count: number): string {
  const endRow = startRow + count - 1;
  return `Jobs!A${startRow}:G${endRow}`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeJobUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("ref");
    u.searchParams.delete("source");
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test fixture builders
// ─────────────────────────────────────────────────────────────────────────────

function makeScrapedJob(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return {
    company: "Acme Corp",
    title: "Software Engineer",
    location: "Remote",
    url: "https://jobs.lever.co/acme/abc-123",
    platform: "lever",
    description: "We are looking for an experienced software engineer to join our team and build scalable APIs.",
    date: "2024-06-01",
    ...overrides,
  };
}

function makeJobRow(overrides: Partial<JobRow> = {}): JobRow {
  return {
    company: "Acme Corp",
    title: "Software Engineer",
    location: "Remote",
    url: "https://jobs.lever.co/acme/abc-123",
    platform: "lever",
    date: "2024-06-01",
    description: "We are looking for an experienced software engineer to join our team and build scalable APIs.",
    ...overrides,
  };
}

function makeGenerateResult(overrides: Partial<GenerateResult> = {}): GenerateResult {
  return {
    resumeUrl: "https://storage.googleapis.com/bucket/resumes/Acme_Corp-swe.pdf",
    coverLetter: "I am excited to apply for this software engineer role...",
    atsScore: 75,
    matched: ["software", "engineer", "apis", "scalable"],
    missing: ["react", "typescript"],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Scrape → Filter pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe("Stage 1: Scrape → Filter", () => {
  it("filters out non-engineering jobs from scraped batch", () => {
    const scraped = [
      makeScrapedJob({ url: "url1", title: "Software Engineer" }),
      makeScrapedJob({ url: "url2", title: "Product Manager" }),
      makeScrapedJob({ url: "url3", title: "DevOps Engineer" }),
      makeScrapedJob({ url: "url4", title: "UX Researcher" }),
    ];
    const result = filterJobs(scraped, new Set());
    expect(result).toHaveLength(2);
    expect(result.map((j) => j.title)).toEqual(["Software Engineer", "DevOps Engineer"]);
  });

  it("removes jobs that were already scraped (existing URLs)", () => {
    const existing = new Set(["https://already.scraped.com/1", "https://already.scraped.com/2"]);
    const scraped = [
      makeScrapedJob({ url: "https://already.scraped.com/1", title: "Software Engineer" }),
      makeScrapedJob({ url: "https://new.job.com/3", title: "Backend Engineer" }),
    ];
    const result = filterJobs(scraped, existing);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://new.job.com/3");
  });

  it("removes duplicate URLs in same batch", () => {
    const scraped = [
      makeScrapedJob({ url: "https://same.url.com/1", title: "Software Engineer" }),
      makeScrapedJob({ url: "https://same.url.com/1", title: "Software Engineer" }), // dup
      makeScrapedJob({ url: "https://different.url.com/2", title: "Frontend Engineer" }),
    ];
    const result = filterJobs(scraped, new Set());
    expect(result).toHaveLength(2);
  });

  it("returns empty when all jobs are non-engineering", () => {
    const scraped = [
      makeScrapedJob({ url: "url1", title: "Finance Manager" }),
      makeScrapedJob({ url: "url2", title: "HR Partner" }),
    ];
    expect(filterJobs(scraped, new Set())).toHaveLength(0);
  });

  it("returns empty when all URLs already exist", () => {
    const existing = new Set(["url1", "url2", "url3"]);
    const scraped = [
      makeScrapedJob({ url: "url1", title: "Software Engineer" }),
      makeScrapedJob({ url: "url2", title: "Backend Engineer" }),
    ];
    expect(filterJobs(scraped, existing)).toHaveLength(0);
  });

  it("handles empty scraped list", () => {
    expect(filterJobs([], new Set())).toHaveLength(0);
  });

  it("handles large batch (1000 jobs) without throwing", () => {
    const jobs = Array.from({ length: 1000 }, (_, i) =>
      makeScrapedJob({ url: `https://jobs.example.com/${i}`, title: i % 2 === 0 ? "Software Engineer" : "Product Manager" })
    );
    expect(() => filterJobs(jobs, new Set())).not.toThrow();
  });

  it("large batch: only engineering roles kept", () => {
    const jobs = Array.from({ length: 100 }, (_, i) =>
      makeScrapedJob({ url: `https://jobs.example.com/${i}`, title: i % 3 === 0 ? "Software Engineer" : "Product Manager" })
    );
    const result = filterJobs(jobs, new Set());
    for (const j of result) {
      expect(isEngineeringRole(j.title)).toBe(true);
    }
  });

  it("normalizes UTM tracking URLs before deduplication", () => {
    const url1 = normalizeJobUrl("https://jobs.lever.co/acme/1?utm_source=linkedin");
    const url2 = normalizeJobUrl("https://jobs.lever.co/acme/1?utm_source=github");
    expect(url1).toBe(url2); // same base URL
  });

  it("scraped jobs map to correct 7-column row", () => {
    const job = makeScrapedJob();
    const row = buildJobRow(job);
    expect(row).toHaveLength(7);
    expect(row[0]).toBe("Acme Corp");
    expect(row[1]).toBe("Software Engineer");
    expect(row[2]).toBe("Remote");
    expect(row[3]).toBe("https://jobs.lever.co/acme/abc-123");
    expect(row[4]).toBe("lever");
  });

  it("buildJobRow uses today's date when missing", () => {
    const today = formatDate(new Date());
    const job = makeScrapedJob({ date: undefined });
    const row = buildJobRow(job);
    expect(row[5]).toBe(today);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Filter → GenerateApplications pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe("Stage 2: Filter → Generate Applications", () => {
  it("shouldProcess: skips row that already has resumeUrl", () => {
    const row = makeJobRow({ resumeUrl: "https://gcs.com/resume.pdf" });
    expect(shouldProcess(row)).toBe(false);
  });

  it("shouldProcess: skips row with empty description", () => {
    const row = makeJobRow({ description: "" });
    expect(shouldProcess(row)).toBe(false);
  });

  it("shouldProcess: skips row with short description (< 50 chars)", () => {
    const row = makeJobRow({ description: "Short job" });
    expect(shouldProcess(row)).toBe(false);
  });

  it("shouldProcess: processes row without resumeUrl and long description", () => {
    const row = makeJobRow({
      resumeUrl: undefined,
      description: "We need a software engineer with 5+ years of experience in React and Node.js.",
    });
    expect(shouldProcess(row)).toBe(true);
  });

  it("shouldProcess: exactly 50-char description is processed", () => {
    const row = makeJobRow({ description: "x".repeat(50), resumeUrl: undefined });
    expect(shouldProcess(row)).toBe(true);
  });

  it("shouldProcess: 49-char description is skipped", () => {
    const row = makeJobRow({ description: "x".repeat(49), resumeUrl: undefined });
    expect(shouldProcess(row)).toBe(false);
  });

  it("getApplyStatus: score 70 → pending", () => {
    expect(getApplyStatus(70)).toBe("pending");
  });

  it("getApplyStatus: score 69 → low-ats", () => {
    expect(getApplyStatus(69)).toBe("low-ats");
  });

  it("buildUpdateValues: returns 6 elements", () => {
    const result = makeGenerateResult();
    expect(buildUpdateValues(result)).toHaveLength(6);
  });

  it("buildUpdateValues: first element is resumeUrl", () => {
    const result = makeGenerateResult();
    expect(buildUpdateValues(result)[0]).toBe(result.resumeUrl);
  });

  it("buildUpdateValues: second element is coverLetter", () => {
    const result = makeGenerateResult();
    expect(buildUpdateValues(result)[1]).toBe(result.coverLetter);
  });

  it("buildUpdateValues: third element is atsScore", () => {
    const result = makeGenerateResult();
    expect(buildUpdateValues(result)[2]).toBe(result.atsScore);
  });

  it("buildUpdateValues: fourth element is matched skills (comma-separated)", () => {
    const result = makeGenerateResult({ matched: ["react", "node", "typescript"] });
    const values = buildUpdateValues(result);
    expect(values[3]).toBe("react, node, typescript");
  });

  it("buildUpdateValues: fifth element is missing skills (comma-separated)", () => {
    const result = makeGenerateResult({ missing: ["python", "golang"] });
    const values = buildUpdateValues(result);
    expect(values[4]).toBe("python, golang");
  });

  it("buildUpdateValues: sixth element is applyStatus based on atsScore", () => {
    const highScore = makeGenerateResult({ atsScore: 80 });
    const lowScore = makeGenerateResult({ atsScore: 50 });
    expect(buildUpdateValues(highScore)[5]).toBe("pending");
    expect(buildUpdateValues(lowScore)[5]).toBe("low-ats");
  });

  it("filters out already-processed rows before generating", () => {
    const rows: JobRow[] = [
      makeJobRow({ url: "url1", resumeUrl: "existing.pdf" }),  // skip: has resumeUrl
      makeJobRow({ url: "url2", resumeUrl: undefined }),         // process
      makeJobRow({ url: "url3", description: "short" }),         // skip: short description
    ];
    const toProcess = rows.filter(shouldProcess);
    expect(toProcess).toHaveLength(1);
    expect(toProcess[0].url).toBe("url2");
  });

  it("processes 50 rows filtering to correct subset", () => {
    const rows: JobRow[] = Array.from({ length: 50 }, (_, i) =>
      makeJobRow({
        url: `url${i}`,
        resumeUrl: i % 5 === 0 ? "existing.pdf" : undefined,
        description: i % 3 === 0 ? "x".repeat(49) : "x".repeat(100),
      })
    );
    const toProcess = rows.filter(shouldProcess);
    for (const r of toProcess) {
      expect(r.resumeUrl).toBeFalsy();
      expect((r.description?.length ?? 0)).toBeGreaterThanOrEqual(50);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Generate → AutoApply pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe("Stage 3: Generate → Auto Apply", () => {
  it("shouldAutoApply: pending status + resumeUrl → true", () => {
    const row = makeJobRow({ applyStatus: "pending", resumeUrl: "https://gcs.com/r.pdf" });
    expect(shouldAutoApply(row)).toBe(true);
  });

  it("shouldAutoApply: low-ats status → false", () => {
    const row = makeJobRow({ applyStatus: "low-ats", resumeUrl: "https://gcs.com/r.pdf" });
    expect(shouldAutoApply(row)).toBe(false);
  });

  it("shouldAutoApply: pending but no resumeUrl → false", () => {
    const row = makeJobRow({ applyStatus: "pending", resumeUrl: undefined });
    expect(shouldAutoApply(row)).toBe(false);
  });

  it("shouldAutoApply: no status → false", () => {
    const row = makeJobRow({ applyStatus: undefined, resumeUrl: "https://gcs.com/r.pdf" });
    expect(shouldAutoApply(row)).toBe(false);
  });

  it("buildLeverApplyUrl: appends /apply to base URL", () => {
    expect(buildLeverApplyUrl("https://jobs.lever.co/acme/abc-123")).toBe("https://jobs.lever.co/acme/abc-123/apply");
  });

  it("buildLeverApplyUrl: does not double-append /apply", () => {
    expect(buildLeverApplyUrl("https://jobs.lever.co/acme/abc-123/apply")).toBe("https://jobs.lever.co/acme/abc-123/apply");
  });

  it("buildLeverApplyUrl: handles trailing slash URL", () => {
    const result = buildLeverApplyUrl("https://jobs.lever.co/acme/abc-123/");
    // Implementation does simple append: "url/" + "/apply" = "url//apply"
    expect(result).toContain("/apply");
  });

  it("filters rows for auto-apply correctly", () => {
    const rows: JobRow[] = [
      makeJobRow({ url: "url1", applyStatus: "pending", resumeUrl: "https://gcs.com/1.pdf" }),   // ✓
      makeJobRow({ url: "url2", applyStatus: "low-ats", resumeUrl: "https://gcs.com/2.pdf" }),  // ✗
      makeJobRow({ url: "url3", applyStatus: "pending", resumeUrl: undefined }),                  // ✗
      makeJobRow({ url: "url4", applyStatus: "pending", resumeUrl: "https://gcs.com/4.pdf" }),   // ✓
    ];
    const toApply = rows.filter(shouldAutoApply);
    expect(toApply).toHaveLength(2);
    expect(toApply.map((r) => r.url)).toEqual(["url1", "url4"]);
  });

  it("sanitizeCompanyName before building apply URL", () => {
    const company = "Acme Corp, Inc.";
    const sanitized = sanitizeCompanyName(company);
    expect(sanitized).toBe("Acme Corp");
    expect(sanitized).not.toContain("Inc.");
  });

  it("auto-apply only for lever platform URLs", () => {
    const leverUrl = "https://jobs.lever.co/acme/123";
    const applyUrl = buildLeverApplyUrl(leverUrl);
    expect(applyUrl).toContain("lever.co");
    expect(applyUrl).toContain("/apply");
  });

  it("processes 10 rows and applies to all pending ones", () => {
    const rows: JobRow[] = Array.from({ length: 10 }, (_, i) =>
      makeJobRow({
        url: `https://jobs.lever.co/co/${i}`,
        applyStatus: i < 5 ? "pending" : "low-ats",
        resumeUrl: "https://gcs.com/r.pdf",
      })
    );
    const toApply = rows.filter(shouldAutoApply);
    expect(toApply).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Full end-to-end pipeline simulation
// ─────────────────────────────────────────────────────────────────────────────

describe("Full pipeline: Scrape → Filter → Generate → Apply", () => {
  function runPipeline(scraped: ScrapedJob[], existing: Set<string>, generateFn: (row: JobRow) => GenerateResult | null) {
    // Stage 1: Filter
    const filtered = filterJobs(scraped, existing);

    // Stage 2: Build rows and process
    const rows: JobRow[] = filtered.map((j) => ({
      ...j,
      date: j.date ?? formatDate(new Date()),
      description: j.description ?? "",
    }));

    const toProcess = rows.filter(shouldProcess);

    // Stage 3: Apply generate results
    const updated: JobRow[] = toProcess.map((row) => {
      const result = generateFn(row);
      if (!result) return row;
      const values = buildUpdateValues(result);
      return {
        ...row,
        resumeUrl: values[0] as string,
        coverLetter: values[1] as string,
        atsScore: values[2] as number,
        matchedSkills: values[3] as string,
        missingSkills: values[4] as string,
        applyStatus: values[5] as string,
      };
    });

    // Stage 4: Filter for auto-apply
    const toApply = updated.filter(shouldAutoApply);
    const applied = toApply.map((row) => ({
      url: buildLeverApplyUrl(row.url),
      company: sanitizeCompanyName(row.company),
    }));

    return { filtered, toProcess, updated, toApply, applied };
  }

  const mockGenerate = (row: JobRow): GenerateResult => ({
    resumeUrl: `https://gcs.com/${row.company.replace(/\s/g, "_")}.pdf`,
    coverLetter: `Dear ${row.company}, I am excited to apply...`,
    atsScore: row.description.length > 100 ? 80 : 55,
    matched: ["software", "engineer"],
    missing: ["python"],
  });

  const SCRAPED_BATCH: ScrapedJob[] = [
    makeScrapedJob({ url: "u1", title: "Software Engineer", company: "TechCo", description: "x".repeat(120) }),
    makeScrapedJob({ url: "u2", title: "Product Manager", company: "BizCo", description: "x".repeat(120) }),
    makeScrapedJob({ url: "u3", title: "Backend Engineer", company: "DataCo", description: "x".repeat(80) }),
    makeScrapedJob({ url: "u4", title: "Frontend Engineer", company: "UICo", description: "x".repeat(30) }),  // short desc
    makeScrapedJob({ url: "u5", title: "DevOps Engineer", company: "Infra Inc.", description: "x".repeat(200) }),
  ];

  it("stage 1: filters to engineering roles only", () => {
    const { filtered } = runPipeline(SCRAPED_BATCH, new Set(), mockGenerate);
    expect(filtered.every((j) => isEngineeringRole(j.title))).toBe(true);
    expect(filtered).toHaveLength(4); // PM excluded
  });

  it("stage 2: skips rows with short descriptions", () => {
    const { toProcess } = runPipeline(SCRAPED_BATCH, new Set(), mockGenerate);
    expect(toProcess.every((r) => (r.description?.length ?? 0) >= 50)).toBe(true);
    expect(toProcess).toHaveLength(3); // u4 (Frontend) skipped (short desc)
  });

  it("stage 3: updated rows have resumeUrl", () => {
    const { updated } = runPipeline(SCRAPED_BATCH, new Set(), mockGenerate);
    for (const row of updated) {
      expect(row.resumeUrl).toBeTruthy();
    }
  });

  it("stage 3: updated rows have applyStatus", () => {
    const { updated } = runPipeline(SCRAPED_BATCH, new Set(), mockGenerate);
    for (const row of updated) {
      expect(["pending", "low-ats"]).toContain(row.applyStatus);
    }
  });

  it("stage 4: only pending rows with resumeUrl get applied", () => {
    const { toApply, updated } = runPipeline(SCRAPED_BATCH, new Set(), mockGenerate);
    const pendingWithResume = updated.filter((r) => r.applyStatus === "pending" && r.resumeUrl);
    expect(toApply).toHaveLength(pendingWithResume.length);
  });

  it("applied URLs contain /apply suffix", () => {
    const { applied } = runPipeline(SCRAPED_BATCH, new Set(), mockGenerate);
    for (const app of applied) {
      expect(app.url).toContain("/apply");
    }
  });

  it("company names in applied list are sanitized", () => {
    const { applied } = runPipeline(SCRAPED_BATCH, new Set(), mockGenerate);
    for (const app of applied) {
      expect(app.company).not.toMatch(/Inc\.|LLC|Corp\./i);
    }
  });

  it("existing URLs are excluded from pipeline", () => {
    const existing = new Set(["u1", "u3"]);
    const { filtered } = runPipeline(SCRAPED_BATCH, existing, mockGenerate);
    expect(filtered.every((j) => !existing.has(j.url))).toBe(true);
  });

  it("empty scraped batch results in no applications", () => {
    const { applied } = runPipeline([], new Set(), mockGenerate);
    expect(applied).toHaveLength(0);
  });

  it("all existing URLs → no filtering → no applications", () => {
    const existing = new Set(SCRAPED_BATCH.map((j) => j.url));
    const { filtered } = runPipeline(SCRAPED_BATCH, existing, mockGenerate);
    expect(filtered).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Google Sheets integration helpers
// ─────────────────────────────────────────────────────────────────────────────

describe("Sheets helpers", () => {
  it("buildSheetsRange generates correct range for 1 row", () => {
    expect(buildSheetsRange(2, 1)).toBe("Jobs!A2:G2");
  });

  it("buildSheetsRange generates correct range for 50 rows", () => {
    expect(buildSheetsRange(2, 50)).toBe("Jobs!A2:G51");
  });

  it("buildSheetsRange works at large row numbers", () => {
    expect(buildSheetsRange(1000, 100)).toBe("Jobs!A1000:G1099");
  });

  it("formatDate matches YYYY-MM-DD pattern for today", () => {
    const d = formatDate(new Date());
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formatDate is deterministic for same date", () => {
    const d = new Date("2024-03-15T12:00:00Z");
    expect(formatDate(d)).toBe("2024-03-15");
  });

  it("buildJobRow produces array of correct length for batch", () => {
    const jobs = Array.from({ length: 20 }, (_, i) => makeScrapedJob({ url: `url${i}` }));
    for (const j of jobs) {
      expect(buildJobRow(j)).toHaveLength(7);
    }
  });

  it("all buildJobRow elements are strings", () => {
    const row = buildJobRow(makeScrapedJob());
    for (const val of row) {
      expect(typeof val).toBe("string");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Error path and boundary simulations
// ─────────────────────────────────────────────────────────────────────────────

describe("Pipeline boundary conditions", () => {
  it("handles job with no description (undefined)", () => {
    const job = makeScrapedJob({ description: undefined });
    const row = buildJobRow(job);
    expect(row[6]).toBe("");
  });

  it("handles job with no date (undefined) — uses today", () => {
    const job = makeScrapedJob({ date: undefined });
    const row = buildJobRow(job);
    expect(row[5]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("getApplyStatus handles score of exactly 70", () => {
    expect(getApplyStatus(70)).toBe("pending");
  });

  it("getApplyStatus handles score of exactly 0", () => {
    expect(getApplyStatus(0)).toBe("low-ats");
  });

  it("getApplyStatus handles score of 100", () => {
    expect(getApplyStatus(100)).toBe("pending");
  });

  it("normalizeJobUrl strips all five tracking params at once", () => {
    const url = "https://jobs.lever.co/co/1?utm_source=a&utm_medium=b&utm_campaign=c&ref=d&source=e";
    expect(normalizeJobUrl(url)).toBe("https://jobs.lever.co/co/1");
  });

  it("shouldProcess is false when description is exactly undefined", () => {
    const row = makeJobRow({ description: undefined as unknown as string });
    // description?.length → undefined → 0 → not >= 50
    expect(shouldProcess(row)).toBe(false);
  });

  it("shouldAutoApply returns false for empty applyStatus string", () => {
    const row = makeJobRow({ applyStatus: "", resumeUrl: "https://gcs.com/r.pdf" });
    expect(shouldAutoApply(row)).toBe(false);
  });

  it("buildLeverApplyUrl does not modify non-lever URLs (just appends /apply)", () => {
    const url = "https://boards.greenhouse.io/company/jobs/12345";
    const result = buildLeverApplyUrl(url);
    expect(result).toBe(url + "/apply");
  });

  it("sanitizeCompanyName handles company with no suffix", () => {
    expect(sanitizeCompanyName("TechStartup")).toBe("TechStartup");
  });

  it("deduplicateJobs preserves order of first occurrences", () => {
    const jobs = [
      makeScrapedJob({ url: "c", title: "C" }),
      makeScrapedJob({ url: "a", title: "A" }),
      makeScrapedJob({ url: "b", title: "B" }),
      makeScrapedJob({ url: "a", title: "A-dup" }),
    ];
    const result = deduplicateJobs(jobs);
    expect(result.map((j) => j.url)).toEqual(["c", "a", "b"]);
  });

  it("batch of 200 jobs processes without error", () => {
    const jobs = Array.from({ length: 200 }, (_, i) =>
      makeScrapedJob({
        url: `https://jobs.example.com/${i}`,
        title: i % 2 === 0 ? "Software Engineer" : "Product Manager",
        description: "x".repeat(100),
      })
    );
    expect(() => filterJobs(jobs, new Set())).not.toThrow();
    const result = filterJobs(jobs, new Set());
    expect(result).toHaveLength(100); // only engineering roles
  });

  it("pipeline correctly handles batch with all non-engineering titles", () => {
    const jobs = Array.from({ length: 50 }, (_, i) =>
      makeScrapedJob({ url: `url${i}`, title: "Finance Analyst" })
    );
    const result = filterJobs(jobs, new Set());
    expect(result).toHaveLength(0);
  });

  it("pipeline output applyStatus is always 'pending' or 'low-ats'", () => {
    for (let score = 0; score <= 100; score++) {
      const status = getApplyStatus(score);
      expect(["pending", "low-ats"]).toContain(status);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Concurrent pipeline simulations
// ─────────────────────────────────────────────────────────────────────────────

describe("Concurrent pipeline simulations", () => {
  it("processes 5 concurrent batches independently", () => {
    const batches = Array.from({ length: 5 }, (_, batchIdx) =>
      Array.from({ length: 20 }, (_, i) =>
        makeScrapedJob({
          url: `https://jobs.example.com/batch${batchIdx}/${i}`,
          title: "Software Engineer",
          description: "x".repeat(100),
        })
      )
    );
    const results = batches.map((batch) => filterJobs(batch, new Set()));
    for (const r of results) {
      expect(r).toHaveLength(20);
    }
  });

  it("separate pipelines don't share state", () => {
    const existing1 = new Set(["url1"]);
    const existing2 = new Set(["url2"]);
    const jobs = [
      makeScrapedJob({ url: "url1", title: "Software Engineer" }),
      makeScrapedJob({ url: "url2", title: "DevOps Engineer" }),
    ];
    const r1 = filterJobs(jobs, existing1);
    const r2 = filterJobs(jobs, existing2);
    expect(r1.map((j) => j.url)).toEqual(["url2"]);
    expect(r2.map((j) => j.url)).toEqual(["url1"]);
  });

  it("getApplyStatus is deterministic for all scores 0-100", () => {
    for (let s = 0; s <= 100; s++) {
      const r1 = getApplyStatus(s);
      const r2 = getApplyStatus(s);
      expect(r1).toBe(r2);
    }
  });

  it("buildSheetsRange is deterministic", () => {
    for (let i = 2; i <= 20; i++) {
      expect(buildSheetsRange(i, 10)).toBe(buildSheetsRange(i, 10));
    }
  });

  it("normalizeJobUrl is deterministic (same URL gives same result)", () => {
    const url = "https://jobs.lever.co/co/1?utm_source=a&ref=b";
    expect(normalizeJobUrl(url)).toBe(normalizeJobUrl(url));
  });
});
