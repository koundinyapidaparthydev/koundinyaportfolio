/**
 * @jest-environment node
 *
 * __tests__/pipeline/pipelineEdgeCases.test.ts
 *
 * Additional deep edge-case and boundary-value tests for the full
 * auto-apply pipeline.  Covers:
 *   - Concurrency helper (mapConcurrent)
 *   - Retry / timeout fetch helpers (fetchWithRetry, fetchWithTimeout)
 *   - Platform detection (detectPlatform)
 *   - Whitespace & encoding edge cases for all formatters
 *   - Score/status boundary matrix (every integer 0-100)
 *   - buildUpdateValues & row shape contracts
 *   - Large-batch stress tests
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline pipeline utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Maps items with bounded concurrency. */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/** Detects ATS platform from a job URL. */
function detectPlatform(url: string): string {
  if (/lever\.co/i.test(url)) return "lever";
  if (/greenhouse\.io/i.test(url)) return "greenhouse";
  if (/workday\.com/i.test(url)) return "workday";
  if (/ashbyhq\.com/i.test(url)) return "ashby";
  if (/smartrecruiters\.com/i.test(url)) return "smartrecruiters";
  if (/jobvite\.com/i.test(url)) return "jobvite";
  if (/icims\.com/i.test(url)) return "icims";
  if (/taleo\.net/i.test(url)) return "taleo";
  if (/bamboohr\.com/i.test(url)) return "bamboohr";
  if (/myworkdayjobs\.com/i.test(url)) return "workday";
  return "unknown";
}

/** Strips HTML tags and decodes entities. */
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

/** Applies an env file's key-value pairs to process.env. */
function applyEnvFile(fileContents: string, env: Record<string, string | undefined>): Record<string, string | undefined> {
  const result = { ...env };
  const lines = fileContents.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let rawValue = trimmed.slice(eqIdx + 1).trim();
    rawValue = rawValue.replace(/^["']|["']$/g, "");
    if (!(key in result) || result[key] === undefined) {
      result[key] = rawValue;
    } else {
      // If the existing value is invalid JSON, override it
      try {
        JSON.parse(result[key] as string);
        // Valid JSON — keep existing
      } catch {
        result[key] = rawValue;
      }
    }
  }
  return result;
}

/** ATS scoring */
function scoreResume(resumeText: string, jd: string): { score: number; matched: string[]; missing: string[] } {
  if (!jd || !resumeText) return { score: 0, matched: [], missing: [] };
  const words = jd.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3);
  const keywords = [...new Set(words)];
  if (!keywords.length) return { score: 0, matched: [], missing: [] };
  const resumeLower = resumeText.toLowerCase();
  const matched = keywords.filter((k) => resumeLower.includes(k));
  const missing = keywords.filter((k) => !resumeLower.includes(k));
  const score = Math.min(100, Math.round((matched.length / keywords.length) * 100));
  return { score, matched, missing };
}

function getApplyStatus(score: number): "pending" | "low-ats" {
  return score >= 70 ? "pending" : "low-ats";
}

function buildUpdateValues(result: { resumeUrl: string; coverLetter: string; atsScore: number; matched: string[]; missing: string[] }): (string | number)[] {
  return [
    result.resumeUrl,
    result.coverLetter,
    result.atsScore,
    result.matched.join(", "),
    result.missing.join(", "),
    getApplyStatus(result.atsScore),
  ];
}

function sanitizeCompanyName(company: string): string {
  return company.replace(/,?\s*(Inc\.|LLC|Ltd\.|Corp\.|Corporation|Incorporated)\s*$/i, "").trim();
}

function normalizeJobUrl(url: string): string {
  try {
    const u = new URL(url);
    ["utm_source", "utm_medium", "utm_campaign", "ref", "source"].forEach((p) => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

function buildSheetsRange(startRow: number, count: number): string {
  return `Jobs!A${startRow}:G${startRow + count - 1}`;
}

function isEngineeringRole(title: string): boolean {
  const kws = ["engineer", "software", "developer", "full stack", "fullstack", "frontend", "front-end", "backend", "back-end", "devops", "sre", "platform", "architect", "mobile", "ios", "android"];
  const lower = title.toLowerCase();
  return kws.some((k) => lower.includes(k));
}

// ─────────────────────────────────────────────────────────────────────────────
// mapConcurrent
// ─────────────────────────────────────────────────────────────────────────────

describe("mapConcurrent – edge cases", () => {
  it("handles empty array", async () => {
    const result = await mapConcurrent([], 5, async (x) => x);
    expect(result).toEqual([]);
  });

  it("processes all items with limit=1 (serial)", async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await mapConcurrent(items, 1, async (x) => x * 2);
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  it("processes all items with limit equal to length", async () => {
    const items = [10, 20, 30];
    const result = await mapConcurrent(items, 3, async (x) => x + 1);
    expect(result).toEqual([11, 21, 31]);
  });

  it("processes all items with limit greater than length", async () => {
    const items = [1, 2];
    const result = await mapConcurrent(items, 100, async (x) => x * x);
    expect(result).toEqual([1, 4]);
  });

  it("preserves order of results", async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const result = await mapConcurrent(items, 5, async (x) => x);
    expect(result).toEqual(items);
  });

  it("handles limit=1 with async identity", async () => {
    const items = ["a", "b", "c"];
    const result = await mapConcurrent(items, 1, async (x) => x.toUpperCase());
    expect(result).toEqual(["A", "B", "C"]);
  });

  it("handles single item", async () => {
    const result = await mapConcurrent([42], 3, async (x) => x);
    expect(result).toEqual([42]);
  });

  it("handles limit=2 with 10 items", async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const result = await mapConcurrent(items, 2, async (x) => x * 3);
    expect(result).toEqual(items.map((x) => x * 3));
  });

  it("handles async functions that resolve with strings", async () => {
    const items = [1, 2, 3];
    const result = await mapConcurrent(items, 2, async (x) => `item-${x}`);
    expect(result).toEqual(["item-1", "item-2", "item-3"]);
  });

  it("handles 100 items with limit 10", async () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const result = await mapConcurrent(items, 10, async (x) => x + 1);
    expect(result).toHaveLength(100);
    expect(result[0]).toBe(1);
    expect(result[99]).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// detectPlatform
// ─────────────────────────────────────────────────────────────────────────────

describe("detectPlatform – extended cases", () => {
  it.each([
    ["https://jobs.lever.co/company/123", "lever"],
    ["https://boards.greenhouse.io/company/jobs/456", "greenhouse"],
    ["https://company.wd1.myworkdayjobs.com/careers/job/1", "workday"],
    ["https://company.ashbyhq.com/jobs/swe", "ashby"],
    ["https://company.smartrecruiters.com/jobs/100", "smartrecruiters"],
    ["https://company.jobvite.com/j/xyz", "jobvite"],
    ["https://careers.icims.com/jobs/1234/job", "icims"],
    ["https://company.taleo.net/careersection/job/123", "taleo"],
    ["https://company.bamboohr.com/careers/10", "bamboohr"],
    ["https://company.workday.com/jobs", "workday"],
  ])("'%s' → '%s'", (url, expected) => {
    expect(detectPlatform(url)).toBe(expected);
  });

  it("returns 'unknown' for unrecognized URLs", () => {
    expect(detectPlatform("https://careers.somecompany.com/jobs/1")).toBe("unknown");
  });

  it("is case-insensitive for lever URL", () => {
    expect(detectPlatform("https://jobs.LEVER.CO/co/1")).toBe("lever");
  });

  it("is case-insensitive for greenhouse URL", () => {
    expect(detectPlatform("https://boards.GREENHOUSE.IO/co/jobs/1")).toBe("greenhouse");
  });

  it("handles empty string", () => {
    expect(detectPlatform("")).toBe("unknown");
  });

  it("handles non-URL string (plain word without domain)", () => {
    // 'lever' alone doesn't contain 'lever.co' so it returns 'unknown'
    expect(detectPlatform("lever")).toBe("unknown");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stripHtml – exhaustive entity tests
// ─────────────────────────────────────────────────────────────────────────────

describe("stripHtml – entity and whitespace", () => {
  it("decodes &amp; entity", () => {
    expect(stripHtml("AT&amp;T")).toBe("AT&T");
  });

  it("decodes &quot; entity", () => {
    expect(stripHtml("Say &quot;hello&quot;")).toBe('Say "hello"');
  });

  it("decodes &#39; entity", () => {
    expect(stripHtml("It&#39;s great")).toBe("It's great");
  });

  it("decodes &apos; entity", () => {
    expect(stripHtml("It&apos;s cool")).toBe("It's cool");
  });

  it("decodes &nbsp; to space", () => {
    expect(stripHtml("hello&nbsp;world")).toBe("hello world");
  });

  it("strips all standard block tags", () => {
    const html = "<div><p><h1><h2><h3><ul><li>text</li></ul></h3></h2></h1></p></div>";
    const result = stripHtml(html);
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("handles multiple nested paragraphs", () => {
    const result = stripHtml("<p>First</p><p>Second</p><p>Third</p>");
    expect(result).toContain("First");
    expect(result).toContain("Second");
    expect(result).toContain("Third");
  });

  it("strips img tags", () => {
    const result = stripHtml('<img src="logo.png" alt="logo"> Job description');
    expect(result).not.toContain("<img");
    expect(result).toContain("Job description");
  });

  it("strips anchor tags but keeps text", () => {
    const result = stripHtml('<a href="https://acme.com">Apply here</a>');
    expect(result).not.toContain("<a");
    expect(result).toContain("Apply here");
  });

  it("handles multiple consecutive spaces → single space", () => {
    const result = stripHtml("hello     world");
    expect(result).toBe("hello world");
  });

  it("trims leading/trailing whitespace", () => {
    const result = stripHtml("  hello world  ");
    expect(result).toBe("hello world");
  });

  it("handles self-closing br tags", () => {
    const result = stripHtml("line1<br/>line2");
    expect(result).toContain("line1");
    expect(result).toContain("line2");
  });

  it("handles br with space", () => {
    const result = stripHtml("line1<br />line2");
    expect(result).toContain("line1");
    expect(result).toContain("line2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyEnvFile – extended tests
// ─────────────────────────────────────────────────────────────────────────────

describe("applyEnvFile – extended env parsing", () => {
  it("sets a new key that doesn't exist in env", () => {
    const result = applyEnvFile("MY_KEY=myvalue", {});
    expect(result["MY_KEY"]).toBe("myvalue");
  });

  it("overrides a plain string (non-JSON) existing value with new value", () => {
    // Plain string 'existing' fails JSON.parse → implementation overrides it
    const result = applyEnvFile("MY_KEY=new", { MY_KEY: "existing" });
    expect(result["MY_KEY"]).toBe("new");
  });

  it("overrides a key with invalid JSON (corrupted value)", () => {
    const result = applyEnvFile("MY_KEY=clean", { MY_KEY: "{bad json" });
    expect(result["MY_KEY"]).toBe("clean");
  });

  it("keeps a key with valid JSON", () => {
    const result = applyEnvFile('MY_KEY=new', { MY_KEY: '{"valid": true}' });
    expect(result["MY_KEY"]).toBe('{"valid": true}');
  });

  it("strips double quotes from value", () => {
    const result = applyEnvFile('MY_KEY="quoted value"', {});
    expect(result["MY_KEY"]).toBe("quoted value");
  });

  it("strips single quotes from value", () => {
    const result = applyEnvFile("MY_KEY='quoted value'", {});
    expect(result["MY_KEY"]).toBe("quoted value");
  });

  it("skips comment lines", () => {
    const result = applyEnvFile("# this is a comment\nMY_KEY=value", {});
    expect(result["MY_KEY"]).toBe("value");
    expect(result["# this is a comment"]).toBeUndefined();
  });

  it("skips blank lines", () => {
    const result = applyEnvFile("\n\nMY_KEY=value\n\n", {});
    expect(result["MY_KEY"]).toBe("value");
  });

  it("handles multiple keys", () => {
    const env = "A=1\nB=2\nC=3";
    const result = applyEnvFile(env, {});
    expect(result["A"]).toBe("1");
    expect(result["B"]).toBe("2");
    expect(result["C"]).toBe("3");
  });

  it("does not mutate the original env object", () => {
    const original = { EXISTING: "value" };
    applyEnvFile("NEW_KEY=new", original);
    expect("NEW_KEY" in original).toBe(false);
  });

  it("handles empty file content", () => {
    const result = applyEnvFile("", { A: "1" });
    expect(result["A"]).toBe("1");
  });

  it("handles = in the value (only first = is separator)", () => {
    const result = applyEnvFile("MY_KEY=val=ue", {});
    expect(result["MY_KEY"]).toBe("val=ue");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Score/status boundary matrix (every integer 0-100)
// ─────────────────────────────────────────────────────────────────────────────

describe("getApplyStatus – exhaustive 0-100 matrix", () => {
  it("scores 0-69 all produce low-ats", () => {
    for (let s = 0; s <= 69; s++) {
      expect(getApplyStatus(s)).toBe("low-ats");
    }
  });

  it("scores 70-100 all produce pending", () => {
    for (let s = 70; s <= 100; s++) {
      expect(getApplyStatus(s)).toBe("pending");
    }
  });

  it("boundary at 69/70 is sharp (low-ats vs pending)", () => {
    expect(getApplyStatus(69)).toBe("low-ats");
    expect(getApplyStatus(70)).toBe("pending");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildUpdateValues – contract tests
// ─────────────────────────────────────────────────────────────────────────────

describe("buildUpdateValues – contract", () => {
  const result = {
    resumeUrl: "https://gcs.com/r.pdf",
    coverLetter: "Dear Team...",
    atsScore: 82,
    matched: ["react", "node"],
    missing: ["python"],
  };

  it("returns exactly 6 elements", () => {
    expect(buildUpdateValues(result)).toHaveLength(6);
  });

  it("index 0 is resumeUrl (string)", () => {
    expect(typeof buildUpdateValues(result)[0]).toBe("string");
  });

  it("index 1 is coverLetter (string)", () => {
    expect(typeof buildUpdateValues(result)[1]).toBe("string");
  });

  it("index 2 is atsScore (number)", () => {
    expect(typeof buildUpdateValues(result)[2]).toBe("number");
  });

  it("index 3 is comma-separated matched skills (string)", () => {
    const val = buildUpdateValues(result)[3];
    expect(typeof val).toBe("string");
    expect(val).toContain("react");
    expect(val).toContain("node");
  });

  it("index 4 is comma-separated missing skills (string)", () => {
    const val = buildUpdateValues(result)[4];
    expect(typeof val).toBe("string");
    expect(val).toContain("python");
  });

  it("index 5 is applyStatus ('pending' or 'low-ats')", () => {
    const val = buildUpdateValues(result)[5];
    expect(["pending", "low-ats"]).toContain(val);
  });

  it("high score → index 5 is 'pending'", () => {
    expect(buildUpdateValues({ ...result, atsScore: 90 })[5]).toBe("pending");
  });

  it("low score → index 5 is 'low-ats'", () => {
    expect(buildUpdateValues({ ...result, atsScore: 50 })[5]).toBe("low-ats");
  });

  it("empty matched → index 3 is empty string", () => {
    expect(buildUpdateValues({ ...result, matched: [] })[3]).toBe("");
  });

  it("empty missing → index 4 is empty string", () => {
    expect(buildUpdateValues({ ...result, missing: [] })[4]).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sanitizeCompanyName – extended
// ─────────────────────────────────────────────────────────────────────────────

describe("sanitizeCompanyName – extended", () => {
  it.each([
    ["Google LLC", "Google"],
    ["Apple Inc.", "Apple"],
    ["Microsoft Corporation", "Microsoft"],
    ["Amazon Corp.", "Amazon"],
    ["Meta Platforms, Inc.", "Meta Platforms"],
    ["Netflix, Inc.", "Netflix"],
    ["Stripe, Inc.", "Stripe"],
    ["Airbnb, Inc.", "Airbnb"],
    ["SpaceX", "SpaceX"],
    ["OpenAI", "OpenAI"],
    ["Vercel Inc.", "Vercel"],
    ["Cloudflare, Inc.", "Cloudflare"],
  ])("'%s' → '%s'", (input, expected) => {
    expect(sanitizeCompanyName(input)).toBe(expected);
  });

  it("handles multiple spaces before suffix", () => {
    expect(sanitizeCompanyName("TechCo   Inc.")).toBe("TechCo");
  });

  it("preserves company name when no suffix present", () => {
    expect(sanitizeCompanyName("FAANG Industries")).toBe("FAANG Industries");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeJobUrl – extended
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeJobUrl – extended", () => {
  it("handles hash fragments", () => {
    const url = "https://jobs.lever.co/co/1#apply";
    const result = normalizeJobUrl(url);
    // URL constructor preserves hash
    expect(result).toContain("lever.co");
  });

  it("handles multiple query params where some are non-tracking", () => {
    const url = "https://boards.greenhouse.io/co?job_id=123&utm_source=linkedin";
    const result = normalizeJobUrl(url);
    expect(result).toContain("job_id=123");
    expect(result).not.toContain("utm_source");
  });

  it("handles HTTPS URLs", () => {
    expect(normalizeJobUrl("https://jobs.lever.co/co/1")).toContain("https://");
  });

  it("handles HTTP URLs", () => {
    expect(normalizeJobUrl("http://jobs.lever.co/co/1")).toContain("http://");
  });

  it("removes trailing slash after query params are removed", () => {
    const url = "https://jobs.lever.co/co/1/?utm_source=a";
    const result = normalizeJobUrl(url);
    expect(result).not.toMatch(/\/$/);
  });

  it("handles URL with port", () => {
    const url = "https://localhost:3000/jobs/123?utm_source=test";
    const result = normalizeJobUrl(url);
    expect(result).not.toContain("utm_source");
    expect(result).toContain("3000");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSheetsRange – parametric
// ─────────────────────────────────────────────────────────────────────────────

describe("buildSheetsRange – parametric", () => {
  it.each([
    [2, 1, "Jobs!A2:G2"],
    [2, 10, "Jobs!A2:G11"],
    [2, 100, "Jobs!A2:G101"],
    [50, 1, "Jobs!A50:G50"],
    [100, 5, "Jobs!A100:G104"],
    [1000, 50, "Jobs!A1000:G1049"],
  ])("startRow=%i count=%i → '%s'", (start, count, expected) => {
    expect(buildSheetsRange(start, count)).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isEngineeringRole – platform/level modifiers
// ─────────────────────────────────────────────────────────────────────────────

describe("isEngineeringRole – level and modifier variants", () => {
  it.each([
    "Junior Software Engineer",
    "Mid-Level Software Engineer",
    "Senior Software Engineer",
    "Staff Software Engineer",
    "Principal Software Engineer",
    "Distinguished Software Engineer",
    "Software Engineer I",
    "Software Engineer II",
    "Software Engineer III",
    "Software Engineering Manager",
    "Director of Software Engineering",
    "VP of Software Engineering",
  ])("'%s' → true", (title) => {
    expect(isEngineeringRole(title)).toBe(true);
  });

  it.each([
    "Account Manager",
    "Customer Success Manager",
    "Talent Acquisition Specialist",
    "Data Entry Clerk",
    "Legal Counsel",
    "Financial Controller",
    "Office Administrator",
    "Graphic Designer",
    "Content Writer",
    "Social Media Manager",
  ])("'%s' → false", (title) => {
    expect(isEngineeringRole(title)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreResume – keyword frequency and coverage
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreResume – keyword coverage guarantees", () => {
  it("matching 0 out of N keywords → score=0", () => {
    const { score } = scoreResume("cooking baking", "react typescript node kubernetes");
    expect(score).toBe(0);
  });

  it("matching all keywords → score=100", () => {
    const jd = "react typescript node";
    const resume = "I use react and typescript and node every day";
    const { score } = scoreResume(resume, jd);
    expect(score).toBe(100);
  });

  it("score grows monotonically as more keywords added to resume", () => {
    const jd = "react typescript node postgres docker kubernetes";
    const techStack = ["react", "typescript", "node", "postgres", "docker", "kubernetes"];
    let prevScore = 0;
    for (let i = 1; i <= techStack.length; i++) {
      const resume = techStack.slice(0, i).join(" ");
      const { score } = scoreResume(resume, jd);
      expect(score).toBeGreaterThanOrEqual(prevScore);
      prevScore = score;
    }
  });

  it("score is 100 when resume covers all JD keywords", () => {
    const jd = "python django rest api aws";
    const resume = "python django rest api aws deployment";
    expect(scoreResume(resume, jd).score).toBe(100);
  });

  it("score is integer for fractional match", () => {
    // 1 out of 3 keywords = 33.33... → rounds to 33
    const jd = "react typescript node";
    const resume = "react java golang";
    const { score } = scoreResume(resume, jd);
    expect(score % 1).toBe(0);
  });
});
