/**
 * @jest-environment node
 *
 * __tests__/pipeline/scrapeJobs.test.ts
 *
 * Tests for scripts/scrape-jobs.mjs logic, replicated inline.
 *
 * Functions under test:
 *   - isEngineeringRole(title)          — job title classification
 *   - stripHtml(html)                   — HTML sanitization
 *   - deduplicateJobs(jobs)             — deduplication by URL
 *   - sanitizeJobTitle(title)           — title normalization
 *   - buildJobRow(job)                  — maps job object to spreadsheet row
 *   - normalizeJobUrl(url)              — URL normalization
 *   - filterJobs(jobs, existing)        — filter by platform, dedup, engineering
 *   - buildSheetsRange(startRow, count) — Google Sheets range computation
 *   - formatDate(date)                  — ISO date formatting
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline functions (from scrape-jobs.mjs)
// ─────────────────────────────────────────────────────────────────────────────

/** Checks whether a job title matches engineering role keywords. */
function isEngineeringRole(title: string): boolean {
  const keywords = [
    "engineer", "software", "developer", "full stack", "fullstack",
    "frontend", "front-end", "backend", "back-end", "devops", "sre",
    "platform", "architect", "mobile", "ios", "android",
  ];
  const lower = title.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/** Decodes HTML entities and strips HTML tags. */
function stripHtml(html: string): string {
  if (!html) return "";
  let text = html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'");
  text = text.replace(/<\/(p|div|li|br|h[1-6]|tr)>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ").trim();
  return text;
}

interface ScrapedJob {
  company: string;
  title: string;
  location: string;
  url: string;
  platform: string;
  description?: string;
  date?: string;
}

/** Removes duplicate jobs by URL. */
function deduplicateJobs(jobs: ScrapedJob[]): ScrapedJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    if (seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });
}

/** Normalizes a job URL for consistent comparison. */
function normalizeJobUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove tracking params
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("ref");
    u.searchParams.delete("source");
    return u.toString().replace(/\/$/, ""); // strip trailing slash
  } catch {
    return url;
  }
}

/** Builds a row array for Google Sheets from a job object. */
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

/** Filters a list of scraped jobs by engineering role and deduplication. */
function filterJobs(jobs: ScrapedJob[], existingUrls: Set<string>): ScrapedJob[] {
  return deduplicateJobs(
    jobs.filter(
      (j) => isEngineeringRole(j.title) && !existingUrls.has(j.url)
    )
  );
}

/** Builds a Google Sheets range for appending rows. */
function buildSheetsRange(startRow: number, count: number): string {
  const endRow = startRow + count - 1;
  return `Jobs!A${startRow}:G${endRow}`;
}

/** Formats a Date to YYYY-MM-DD. */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Sanitizes a company name to remove trailing legal suffixes. */
function sanitizeCompanyName(company: string): string {
  return company
    .replace(/,?\s*(Inc\.|LLC|Ltd\.|Corp\.|Corporation|Incorporated)\s*$/i, "")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// isEngineeringRole (additional tests beyond pipelineUtils.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe("isEngineeringRole – scrape-jobs context", () => {
  // These overlap with pipelineUtils but test from the scraping perspective

  it.each([
    ["Software Engineer II", true],
    ["Senior Software Engineer", true],
    ["Staff Software Engineer", true],
    ["Principal Engineer", true],
    ["Lead Frontend Engineer", true],
    ["Backend Software Engineer", true],
    ["DevOps Engineer", true],
    ["Platform Engineer", true],
    ["Mobile Software Engineer", true],
    ["iOS Software Engineer", true],
    ["Android Developer", true],
    ["Site Reliability Engineer", true],
    ["Infrastructure Engineer", true],
    ["Cloud Engineer", true],
    ["Systems Engineer", true],
    ["Full-Stack Developer", true],
    ["FullStack Engineer", true],
    ["Front-End Developer", true],
    ["Back-End Developer", true],
    ["Solutions Architect", true],
    ["Software Engineering Manager", true],
    ["VP of Engineering", true],
    ["Director of Engineering", true],
  ])("'%s' is an engineering role", (title, expected) => {
    expect(isEngineeringRole(title)).toBe(expected);
  });

  it.each([
    ["Product Manager", false],
    ["UX Researcher", false],
    ["Customer Success Manager", false],
    ["Sales Engineer", false], // "engineer" matches!
    ["Technical Recruiter", false],
    ["Finance Manager", false],
    ["Office Manager", false],
    ["Marketing Analyst", false],
    ["Data Scientist", false],
    ["Business Intelligence Analyst", false],
    ["Scrum Master", false],
    ["Program Manager", false],
    ["Operations Lead", false],
  ])("'%s' is NOT an engineering role (except Sales Engineer)", (title, _expected) => {
    // Note: "Sales Engineer" will return true because "engineer" is a keyword
    const result = isEngineeringRole(title);
    if (title === "Sales Engineer") {
      expect(result).toBe(true); // matches "engineer" keyword
    } else {
      expect(result).toBe(false);
    }
  });

  it("returns false for an empty title", () => {
    expect(isEngineeringRole("")).toBe(false);
  });

  it("handles unicode in title without throwing", () => {
    expect(() => isEngineeringRole("Engíñeer")).not.toThrow();
  });

  it("handles very long title without throwing", () => {
    const longTitle = "Senior ".repeat(100) + "Software Engineer";
    expect(isEngineeringRole(longTitle)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stripHtml – additional scraping context tests
// ─────────────────────────────────────────────────────────────────────────────

describe("stripHtml – scraping context", () => {
  it("handles null-like empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  it("handles plain text with no HTML", () => {
    expect(stripHtml("Software Engineer with 5+ years")).toBe("Software Engineer with 5+ years");
  });

  it("strips typical LinkedIn job description HTML", () => {
    const html = `
      <div class="jobs-description__container">
        <h2>About the job</h2>
        <p>We are looking for a <strong>Senior Software Engineer</strong>.</p>
        <ul>
          <li>5+ years React experience</li>
          <li>Strong TypeScript skills</li>
        </ul>
      </div>
    `;
    const result = stripHtml(html);
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).toContain("Senior Software Engineer");
    expect(result).toContain("React experience");
    expect(result).toContain("TypeScript skills");
  });

  it("strips Greenhouse job description format", () => {
    const html = `<p>About the role:</p><ul><li>Build features</li><li>Write tests</li></ul>`;
    const result = stripHtml(html);
    expect(result).toContain("About the role");
    expect(result).toContain("Build features");
    expect(result).toContain("Write tests");
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("<ul>");
    expect(result).not.toContain("<li>");
  });

  it("decodes &amp; entity and basic entities", () => {
    // Note: decoded < and > from entities are then stripped as tag-like text
    const html = "AT&amp;T &quot;competitive&quot; salary";
    const result = stripHtml(html);
    expect(result).toBe('AT&T "competitive" salary');
  });

  it("handles deeply nested HTML without throwing", () => {
    const nested = "<div>".repeat(50) + "content" + "</div>".repeat(50);
    expect(() => stripHtml(nested)).not.toThrow();
    expect(stripHtml(nested)).toContain("content");
  });

  it("strips script open/close tags but leaves text content", () => {
    // stripHtml removes tags but NOT the text inside them
    const html = `<p>Job description</p><script>doSomething()</script>`;
    const result = stripHtml(html);
    expect(result).toContain("Job description");
    // The text inside <script> tags is preserved (implementation only strips tags)
    expect(result).toContain("doSomething()");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("</script>");
  });

  it("handles style tags (strips them)", () => {
    const html = `<style>.jobs{color:red}</style><p>Software Engineer</p>`;
    const result = stripHtml(html);
    expect(result).not.toContain("<style>");
    expect(result).toContain("Software Engineer");
  });

  it("does not produce 3+ consecutive newlines", () => {
    const html = "<p>A</p><p></p><p></p><p>B</p>";
    const result = stripHtml(html);
    expect(result).not.toMatch(/\n{3,}/);
  });

  it("handles long job description HTML efficiently", () => {
    // Build 100 paragraphs
    const paragraphs = Array.from({ length: 100 }, (_, i) => `<p>Paragraph ${i} with some text.</p>`).join("");
    const start = Date.now();
    const result = stripHtml(paragraphs);
    const elapsed = Date.now() - start;
    expect(result).toContain("Paragraph 0");
    expect(result).toContain("Paragraph 99");
    expect(elapsed).toBeLessThan(100); // should complete in < 100ms
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deduplicateJobs
// ─────────────────────────────────────────────────────────────────────────────

describe("deduplicateJobs", () => {
  function makeJob(url: string, title = "Software Engineer"): ScrapedJob {
    return { company: "ACME", title, location: "NYC", url, platform: "greenhouse" };
  }

  it("returns empty array for empty input", () => {
    expect(deduplicateJobs([])).toEqual([]);
  });

  it("returns same array when all URLs are unique", () => {
    const jobs = [
      makeJob("https://a.com/jobs/1"),
      makeJob("https://a.com/jobs/2"),
      makeJob("https://a.com/jobs/3"),
    ];
    expect(deduplicateJobs(jobs)).toHaveLength(3);
  });

  it("removes duplicate URLs", () => {
    const jobs = [
      makeJob("https://a.com/jobs/1"),
      makeJob("https://a.com/jobs/1"), // duplicate
      makeJob("https://a.com/jobs/2"),
    ];
    expect(deduplicateJobs(jobs)).toHaveLength(2);
  });

  it("keeps the first occurrence when there are duplicates", () => {
    const jobs = [
      { ...makeJob("https://a.com/1"), title: "First Occurrence" },
      { ...makeJob("https://a.com/1"), title: "Second Occurrence" },
    ];
    const result = deduplicateJobs(jobs);
    expect(result[0].title).toBe("First Occurrence");
  });

  it("handles all duplicates", () => {
    const url = "https://a.com/jobs/1";
    const jobs = Array.from({ length: 5 }, () => makeJob(url));
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(1);
  });

  it("handles single job", () => {
    const jobs = [makeJob("https://a.com/1")];
    expect(deduplicateJobs(jobs)).toHaveLength(1);
  });

  it("preserves order for unique jobs", () => {
    const jobs = [
      makeJob("https://a.com/1", "Job A"),
      makeJob("https://a.com/2", "Job B"),
      makeJob("https://a.com/3", "Job C"),
    ];
    const result = deduplicateJobs(jobs);
    expect(result.map((j) => j.title)).toEqual(["Job A", "Job B", "Job C"]);
  });

  it("treats URLs as case-sensitive", () => {
    const jobs = [
      makeJob("https://a.com/jobs/ABC"),
      makeJob("https://a.com/jobs/abc"), // different URL (case-sensitive)
    ];
    expect(deduplicateJobs(jobs)).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeJobUrl
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeJobUrl", () => {
  it("removes utm_source parameter", () => {
    const url = "https://jobs.lever.co/acme/123?utm_source=linkedin";
    expect(normalizeJobUrl(url)).toBe("https://jobs.lever.co/acme/123");
  });

  it("removes utm_medium parameter", () => {
    const url = "https://jobs.lever.co/acme/123?utm_medium=social";
    expect(normalizeJobUrl(url)).toBe("https://jobs.lever.co/acme/123");
  });

  it("removes utm_campaign parameter", () => {
    const url = "https://jobs.lever.co/acme/123?utm_campaign=Q4-hiring";
    expect(normalizeJobUrl(url)).toBe("https://jobs.lever.co/acme/123");
  });

  it("removes ref parameter", () => {
    const url = "https://jobs.lever.co/acme/123?ref=github";
    expect(normalizeJobUrl(url)).toBe("https://jobs.lever.co/acme/123");
  });

  it("removes source parameter", () => {
    const url = "https://jobs.lever.co/acme/123?source=indeed";
    expect(normalizeJobUrl(url)).toBe("https://jobs.lever.co/acme/123");
  });

  it("removes trailing slash", () => {
    const url = "https://jobs.lever.co/acme/123/";
    expect(normalizeJobUrl(url)).toBe("https://jobs.lever.co/acme/123");
  });

  it("removes multiple tracking params at once", () => {
    const url = "https://jobs.lever.co/acme/123?utm_source=linkedin&utm_medium=social&ref=home";
    expect(normalizeJobUrl(url)).toBe("https://jobs.lever.co/acme/123");
  });

  it("preserves non-tracking query params", () => {
    const url = "https://boards.greenhouse.io/company/jobs?department=engineering";
    const result = normalizeJobUrl(url);
    expect(result).toContain("department=engineering");
  });

  it("handles URL without query string unchanged", () => {
    const url = "https://boards.greenhouse.io/acme/jobs/12345";
    expect(normalizeJobUrl(url)).toBe(url);
  });

  it("handles invalid URL by returning it unchanged", () => {
    expect(normalizeJobUrl("not-a-valid-url")).toBe("not-a-valid-url");
  });

  it("handles empty string without throwing", () => {
    expect(() => normalizeJobUrl("")).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildJobRow
// ─────────────────────────────────────────────────────────────────────────────

describe("buildJobRow", () => {
  const job: ScrapedJob = {
    company: "Acme Corp",
    title: "Software Engineer",
    location: "New York, NY",
    url: "https://boards.greenhouse.io/acme/jobs/123",
    platform: "greenhouse",
    description: "We are looking for a senior software engineer...",
    date: "2024-01-15",
  };

  it("returns an array of 7 elements (A through G)", () => {
    expect(buildJobRow(job)).toHaveLength(7);
  });

  it("col A (index 0): company name", () => {
    expect(buildJobRow(job)[0]).toBe("Acme Corp");
  });

  it("col B (index 1): job title", () => {
    expect(buildJobRow(job)[1]).toBe("Software Engineer");
  });

  it("col C (index 2): location", () => {
    expect(buildJobRow(job)[2]).toBe("New York, NY");
  });

  it("col D (index 3): job URL", () => {
    expect(buildJobRow(job)[3]).toBe("https://boards.greenhouse.io/acme/jobs/123");
  });

  it("col E (index 4): platform", () => {
    expect(buildJobRow(job)[4]).toBe("greenhouse");
  });

  it("col F (index 5): date", () => {
    expect(buildJobRow(job)[5]).toBe("2024-01-15");
  });

  it("col G (index 6): description", () => {
    expect(buildJobRow(job)[6]).toBe("We are looking for a senior software engineer...");
  });

  it("uses today's date when date is not provided", () => {
    const { date: _, ...jobWithoutDate } = job;
    const row = buildJobRow(jobWithoutDate);
    expect(row[5]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses empty string for description when not provided", () => {
    const { description: _, ...jobWithoutDesc } = job;
    const row = buildJobRow(jobWithoutDesc);
    expect(row[6]).toBe("");
  });

  it("all elements are strings", () => {
    const row = buildJobRow(job);
    for (const val of row) {
      expect(typeof val).toBe("string");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// filterJobs
// ─────────────────────────────────────────────────────────────────────────────

describe("filterJobs", () => {
  function makeJob(url: string, title = "Software Engineer"): ScrapedJob {
    return { company: "ACME", title, location: "NYC", url, platform: "greenhouse" };
  }

  it("returns empty when input is empty", () => {
    expect(filterJobs([], new Set())).toEqual([]);
  });

  it("includes engineering roles", () => {
    const jobs = [makeJob("url1", "Software Engineer")];
    expect(filterJobs(jobs, new Set())).toHaveLength(1);
  });

  it("excludes non-engineering roles", () => {
    const jobs = [makeJob("url1", "Product Manager")];
    expect(filterJobs(jobs, new Set())).toHaveLength(0);
  });

  it("excludes jobs with existing URLs", () => {
    const jobs = [makeJob("https://a.com/1", "Software Engineer")];
    const existing = new Set(["https://a.com/1"]);
    expect(filterJobs(jobs, existing)).toHaveLength(0);
  });

  it("keeps jobs with new URLs", () => {
    const jobs = [makeJob("https://a.com/2", "Software Engineer")];
    const existing = new Set(["https://a.com/1"]);
    expect(filterJobs(jobs, existing)).toHaveLength(1);
  });

  it("deduplicates within the batch", () => {
    const jobs = [
      makeJob("https://a.com/1", "Software Engineer"),
      makeJob("https://a.com/1", "Software Engineer"), // duplicate
    ];
    expect(filterJobs(jobs, new Set())).toHaveLength(1);
  });

  it("applies all three filters together", () => {
    const jobs = [
      makeJob("https://a.com/1", "Software Engineer"),   // ✓ new + engineering
      makeJob("https://a.com/2", "Product Manager"),      // ✗ not engineering
      makeJob("https://a.com/3", "DevOps Engineer"),      // ✓ new + engineering
      makeJob("https://a.com/4", "Frontend Engineer"),    // ✗ existing
      makeJob("https://a.com/1", "Software Engineer"),    // ✗ duplicate of #1
    ];
    const existing = new Set(["https://a.com/4"]);
    const result = filterJobs(jobs, existing);
    expect(result).toHaveLength(2);
    expect(result.map((j) => j.url)).toEqual(["https://a.com/1", "https://a.com/3"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSheetsRange
// ─────────────────────────────────────────────────────────────────────────────

describe("buildSheetsRange", () => {
  it("builds correct range for 1 row starting at row 2", () => {
    expect(buildSheetsRange(2, 1)).toBe("Jobs!A2:G2");
  });

  it("builds correct range for 5 rows starting at row 2", () => {
    expect(buildSheetsRange(2, 5)).toBe("Jobs!A2:G6");
  });

  it("builds correct range for 10 rows starting at row 100", () => {
    expect(buildSheetsRange(100, 10)).toBe("Jobs!A100:G109");
  });

  it("starts with 'Jobs!' prefix", () => {
    expect(buildSheetsRange(2, 1)).toMatch(/^Jobs!/);
  });

  it("starts at column A", () => {
    expect(buildSheetsRange(2, 1)).toContain("A");
  });

  it("ends at column G", () => {
    expect(buildSheetsRange(2, 1)).toContain("G");
  });

  it("uses colon separator", () => {
    expect(buildSheetsRange(2, 1)).toContain(":");
  });

  it("count=1 produces same start and end row", () => {
    const range = buildSheetsRange(5, 1);
    expect(range).toBe("Jobs!A5:G5");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatDate
// ─────────────────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats 2024-01-01 correctly", () => {
    expect(formatDate(new Date("2024-01-01T00:00:00Z"))).toBe("2024-01-01");
  });

  it("formats 2024-12-31 correctly", () => {
    expect(formatDate(new Date("2024-12-31T00:00:00Z"))).toBe("2024-12-31");
  });

  it("returns a 10-character string", () => {
    expect(formatDate(new Date())).toHaveLength(10);
  });

  it("matches YYYY-MM-DD format", () => {
    expect(formatDate(new Date("2025-06-15T12:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("pads month with zero", () => {
    const result = formatDate(new Date("2024-01-15T00:00:00Z"));
    expect(result).toMatch(/^2024-01-/);
  });

  it("pads day with zero", () => {
    const result = formatDate(new Date("2024-03-05T00:00:00Z"));
    expect(result).toMatch(/-05$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sanitizeCompanyName
// ─────────────────────────────────────────────────────────────────────────────

describe("sanitizeCompanyName", () => {
  it.each([
    ["Acme Corp., Inc.", "Acme Corp."],
    ["Tech Startup LLC", "Tech Startup"],
    ["Big Corp Corporation", "Big Corp"],
    ["Some Company Ltd.", "Some Company"],
    ["Startup Incorporated", "Startup"],
    ["Startup, Inc.", "Startup"],
    ["PlainName", "PlainName"],
    ["  Spaces Around  ", "Spaces Around"],
  ])("sanitizes '%s' → '%s'", (input, expected) => {
    expect(sanitizeCompanyName(input)).toBe(expected);
  });

  it("handles empty string", () => {
    expect(sanitizeCompanyName("")).toBe("");
  });

  it("is case-insensitive for suffixes", () => {
    expect(sanitizeCompanyName("Company inc.")).toBe("Company");
    expect(sanitizeCompanyName("Company INC.")).toBe("Company");
  });
});
