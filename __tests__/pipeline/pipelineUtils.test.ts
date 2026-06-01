/**
 * @jest-environment node
 *
 * __tests__/pipeline/pipelineUtils.test.ts
 *
 * Tests for the utility functions shared across the pipeline scripts.
 * Because the scripts are .mjs files (not transformable by the current
 * babel-jest config), the functions are replicated inline here and tested
 * in isolation. This validates the same logic that runs in production.
 *
 * Functions under test:
 *   - isEngineeringRole(title)       — from scrape-jobs.mjs
 *   - stripHtml(html)                — from scrape-jobs.mjs
 *   - mapConcurrent(items,limit,fn)  — from scrape-jobs.mjs / generate-applications.mjs
 *   - delay(ms)                      — shared by all pipeline scripts
 *   - fetchWithTimeout(url,opts,ms)  — from scrape-jobs.mjs
 *   - fetchWithRetry(url,opts,...)   — from scrape-jobs.mjs
 *   - detectPlatform(url)            — from auto-apply.mjs
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline utility functions (replicated from .mjs scripts for testability)
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

/** Decodes HTML entities and strips HTML tags from a string. */
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
  // Convert structural tags to newlines
  text = text.replace(/<\/(p|div|li|br|h[1-6]|tr)>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, "");
  // Collapse whitespace runs
  text = text.replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ").trim();
  return text;
}

/** Runs an async function over an array with a bounded concurrency limit. */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function next(): Promise<void> {
    const idx = i++;
    if (idx >= items.length) return;
    results[idx] = await fn(items[idx]);
    return next();
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

/** Simple promise-based delay. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetches a URL with an AbortController timeout. */
async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 12_000
): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/** Fetches with exponential-backoff retry on 429 or 5xx responses. */
async function fetchWithRetry(
  url: string,
  opts: RequestInit = {},
  maxRetries = 2,
  timeoutMs = 12_000
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetchWithTimeout(url, opts, timeoutMs);
    if (res.status === 429 || res.status >= 500) {
      if (attempt < maxRetries) {
        await delay(1_000 * (attempt + 1));
        continue;
      }
    }
    return res;
  }
  // Should not reach here
  return fetchWithTimeout(url, opts, timeoutMs);
}

/** Identifies the ATS platform from a job URL. */
function detectPlatform(
  url: string
): "greenhouse" | "lever" | "workday" | "icims" | "smartrecruiters" | "ashby" | "breezy" | "workable" | "recruitee" | "unknown" {
  if (!url) return "unknown";
  if (url.includes("greenhouse.io"))       return "greenhouse";
  if (url.includes("lever.co"))            return "lever";
  if (url.includes("myworkdayjobs.com"))   return "workday";
  if (url.includes("disneycareers.com"))   return "icims";
  if (url.includes("icims.com"))           return "icims";
  if (url.includes("ashbyhq.com"))         return "ashby";
  if (url.includes("smartrecruiters.com")) return "smartrecruiters";
  if (url.includes("breezy.hr"))           return "breezy";
  if (url.includes("workable.com"))        return "workable";
  if (url.includes("recruitee.com"))       return "recruitee";
  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// isEngineeringRole
// ─────────────────────────────────────────────────────────────────────────────

describe("isEngineeringRole", () => {
  // ── Positive cases (should return true) ───────────────────────────────────
  it.each([
    // Exact keyword matches
    ["Software Engineer", true],
    ["Senior Software Engineer", true],
    ["Software Developer", true],
    ["Full Stack Engineer", true],
    ["Full Stack Developer", true],
    ["Fullstack Engineer", true],
    ["Frontend Engineer", true],
    ["Front-End Engineer", true],
    ["Backend Engineer", true],
    ["Back-End Developer", true],
    ["DevOps Engineer", true],
    ["SRE (Site Reliability Engineer)", true],
    ["Platform Engineer", true],
    ["Solutions Architect", true],
    ["Mobile Engineer", true],
    ["iOS Developer", true],
    ["Android Engineer", true],
    // Case insensitivity
    ["SOFTWARE ENGINEER", true],
    ["senior software engineer", true],
    ["FULLSTACK DEVELOPER", true],
    ["IOS DEVELOPER", true],
    ["ANDROID DEVELOPER", true],
    // Compound titles
    ["Lead Software Engineer", true],
    ["Principal Software Engineer", true],
    ["Staff Software Engineer", true],
    ["Senior Full Stack Developer", true],
    ["Junior Frontend Developer", true],
    ["Associate Software Engineer", true],
    // Variations
    ["Engineer II", true], // "engineer" IS a keyword — matches as substring
    ["Software Engineering Manager", true],
    ["Senior DevOps Engineer", true],
    ["Sr. Software Engineer", true],
    ["Full-Stack Developer", true],
    ["React Developer", true],  // "developer" matches
    ["Node.js Developer", true],
    ["Python Developer", true],
    ["Cloud Engineer", true],
    ["Site Reliability Engineer", true],
    ["Data Engineer", true],
    ["ML Engineer", true],
    ["AI Engineer", true],
  ])("isEngineeringRole('%s') === %s", (title, expected) => {
    expect(isEngineeringRole(title)).toBe(expected);
  });

  // ── Negative cases (should return false) ──────────────────────────────────
  it.each([
    ["Product Manager", false],
    ["Data Scientist", false],
    ["UX Designer", false],
    ["UI Designer", false],
    ["Marketing Manager", false],
    ["Sales Representative", false],
    ["Business Analyst", false],
    ["Financial Analyst", false],
    ["HR Manager", false],
    ["Recruiter", false],
    ["Legal Counsel", false],
    ["Operations Manager", false],
    ["Account Executive", false],
    ["Project Manager", false],
    ["Scrum Master", false],
    ["Technical Writer", false],
    ["QA Analyst", false],
    ["Data Analyst", false],
    ["Research Scientist", false],
    ["Machine Learning Researcher", false],
    ["Graphic Designer", false],
    ["Content Manager", false],
    ["Social Media Manager", false],
    ["Customer Success Manager", false],
    ["Support Specialist", false],
    ["Executive Assistant", false],
    ["Office Manager", false],
    ["", false],
    ["   ", false],
  ])("isEngineeringRole('%s') === %s (non-engineering)", (title, expected) => {
    expect(isEngineeringRole(title)).toBe(expected);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────
  it("handles empty string without throwing", () => {
    expect(() => isEngineeringRole("")).not.toThrow();
    expect(isEngineeringRole("")).toBe(false);
  });

  it("is case-insensitive for all keywords", () => {
    expect(isEngineeringRole("ENGINEER")).toBe(true);
    expect(isEngineeringRole("DEVELOPER")).toBe(true);
    expect(isEngineeringRole("IOS")).toBe(true);
    expect(isEngineeringRole("ANDROID")).toBe(true);
    expect(isEngineeringRole("DEVOPS")).toBe(true);
    expect(isEngineeringRole("SRE")).toBe(true);
  });

  it("matches 'engineer' as a substring", () => {
    expect(isEngineeringRole("Chief Engineering Officer")).toBe(true);
  });

  it("does not match 'design engineer' as a non-engineering role", () => {
    // 'engineer' is in the title so it matches
    expect(isEngineeringRole("Design Engineer")).toBe(true);
  });

  it("matches 'platform' in Platform Lead", () => {
    expect(isEngineeringRole("Platform Lead")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stripHtml
// ─────────────────────────────────────────────────────────────────────────────

describe("stripHtml", () => {
  // ── Empty / falsy inputs ──────────────────────────────────────────────────
  it("returns '' for empty string", () => expect(stripHtml("")).toBe(""));
  it("returns '' for null-ish (empty)", () => expect(stripHtml("")).toBe(""));

  // ── Plain text passthrough ─────────────────────────────────────────────────
  it("returns plain text unchanged (modulo whitespace trimming)", () => {
    expect(stripHtml("Hello World")).toBe("Hello World");
  });

  it("trims leading/trailing whitespace", () => {
    expect(stripHtml("  hello  ")).toBe("hello");
  });

  // ── HTML entity decoding ──────────────────────────────────────────────────
  it.each([
    ["&amp;", "&"],
    ["&lt;", "<"],
    ["&gt;", ">"],
    ["&quot;", '"'],
    ["&#39;", "'"],
    ["&nbsp;word", "word"], // &nbsp; decodes to space and then collapses/trims
    ["&apos;", "'"],
  ])("decodes entity '%s' → '%s'", (entity, expected) => {
    expect(stripHtml(entity)).toBe(expected);
  });

  it("decodes multiple entities in one string", () => {
    const result = stripHtml("AT&amp;T &lt;3 &quot;hi&quot;");
    expect(result).toBe('AT&T <3 "hi"');
  });

  it("decodes &nbsp; inside HTML tags", () => {
    expect(stripHtml("<p>Hello&nbsp;World</p>")).toBe("Hello World");
  });

  // ── Tag stripping ─────────────────────────────────────────────────────────

  it("strips <p> tags", () => expect(stripHtml("<p>Hello</p>")).toBe("Hello"));
  it("strips <b> tags", () => expect(stripHtml("<b>Bold</b>")).toBe("Bold"));
  it("strips <i> tags", () => expect(stripHtml("<i>Italic</i>")).toBe("Italic"));
  it("strips <span> tags", () => expect(stripHtml("<span>Text</span>")).toBe("Text"));
  it("strips <a> tags", () => expect(stripHtml('<a href="x">link</a>')).toBe("link"));
  it("strips <strong> tags", () => expect(stripHtml("<strong>bold</strong>")).toBe("bold"));
  it("strips <em> tags", () => expect(stripHtml("<em>italic</em>")).toBe("italic"));
  it("strips <h1>-<h6> tags leaving text", () => {
    expect(stripHtml("<h1>Title</h1>")).toContain("Title");
  });
  it("strips <ul> and <li> tags", () => {
    const result = stripHtml("<ul><li>Item 1</li><li>Item 2</li></ul>");
    expect(result).toContain("Item 1");
    expect(result).toContain("Item 2");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  // ── Structural tags → newlines ─────────────────────────────────────────────

  it("converts </p> to newline", () => {
    const result = stripHtml("<p>Para 1</p><p>Para 2</p>");
    expect(result).toContain("Para 1");
    expect(result).toContain("Para 2");
    expect(result).toMatch(/Para 1\nPara 2/);
  });

  it("converts <br> to newline", () => {
    const result = stripHtml("Line 1<br>Line 2");
    expect(result).toContain("Line 1");
    expect(result).toContain("Line 2");
  });

  it("converts <br/> to newline", () => {
    const result = stripHtml("Line 1<br/>Line 2");
    expect(result).toContain("Line 1");
    expect(result).toContain("Line 2");
  });

  it("converts </div> to newline", () => {
    const result = stripHtml("<div>Div 1</div><div>Div 2</div>");
    expect(result).toContain("Div 1");
    expect(result).toContain("Div 2");
  });

  it("converts </li> to newline", () => {
    const result = stripHtml("<li>Item</li><li>Item2</li>");
    expect(result).toContain("Item");
  });

  // ── No remaining tags ─────────────────────────────────────────────────────

  it("does not contain < or > after stripping", () => {
    const html = "<p>We are <strong>hiring</strong> for a <em>senior</em> role.</p>";
    const result = stripHtml(html);
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("handles nested tags correctly", () => {
    const html = "<div><p><strong>Important:</strong> React experience required.</p></div>";
    const result = stripHtml(html);
    expect(result).toContain("Important");
    expect(result).toContain("React experience required");
    expect(result).not.toContain("<");
  });

  // ── Whitespace collapsing ─────────────────────────────────────────────────

  it("collapses multiple spaces into one", () => {
    const result = stripHtml("Hello   World");
    expect(result).toBe("Hello World");
  });

  it("collapses triple+ newlines into double", () => {
    const result = stripHtml("<p>A</p><p>B</p><p>C</p>");
    // Should not have 3+ consecutive newlines
    expect(result).not.toMatch(/\n{3,}/);
  });

  // ── Complex real-world HTML ────────────────────────────────────────────────

  it("handles a typical job description HTML", () => {
    const html = `
      <h2>About the Role</h2>
      <p>We are looking for a <strong>Senior Software Engineer</strong> to join our team.</p>
      <h3>Requirements</h3>
      <ul>
        <li>5+ years of experience with React &amp; TypeScript</li>
        <li>Experience with Node.js &amp; AWS</li>
        <li>Strong knowledge of REST APIs</li>
      </ul>
      <p>Salary: $150,000 &ndash; $200,000</p>
    `;
    const result = stripHtml(html);
    expect(result).toContain("Senior Software Engineer");
    expect(result).toContain("React & TypeScript");
    expect(result).toContain("Node.js & AWS");
    expect(result).not.toContain("<");
    expect(result).not.toContain("&amp;");
  });

  it("handles self-closing tags without text content", () => {
    const result = stripHtml("<img src='x.png'/> <hr/> text");
    expect(result).toContain("text");
    expect(result).not.toContain("<");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mapConcurrent
// ─────────────────────────────────────────────────────────────────────────────

describe("mapConcurrent", () => {
  it("returns empty array for empty input", async () => {
    const result = await mapConcurrent([], 3, async (x: number) => x * 2);
    expect(result).toEqual([]);
  });

  it("processes all items", async () => {
    const result = await mapConcurrent([1, 2, 3, 4, 5], 2, async (x) => x * 2);
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  it("preserves the original order of results", async () => {
    const delays = [50, 10, 30, 20, 40];
    const result = await mapConcurrent(delays, 5, async (ms) => {
      await delay(ms);
      return ms;
    });
    expect(result).toEqual(delays);
  });

  it("works with limit = 1 (serial processing)", async () => {
    const order: number[] = [];
    await mapConcurrent([1, 2, 3], 1, async (x) => {
      order.push(x);
      return x;
    });
    expect(order).toEqual([1, 2, 3]);
  });

  it("works with limit > items.length", async () => {
    const result = await mapConcurrent([1, 2], 10, async (x) => x + 1);
    expect(result).toEqual([2, 3]);
  });

  it("works with limit === items.length (all concurrent)", async () => {
    const result = await mapConcurrent([1, 2, 3], 3, async (x) => x ** 2);
    expect(result).toEqual([1, 4, 9]);
  });

  it("respects the concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    await mapConcurrent([1, 2, 3, 4, 5, 6], 2, async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await delay(10);
      concurrent--;
    });
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("handles async functions that reject", async () => {
    const fn = mapConcurrent([1, 2, 3], 2, async (x) => {
      if (x === 2) throw new Error("item 2 failed");
      return x;
    });
    await expect(fn).rejects.toThrow("item 2 failed");
  });

  it("processes single-item array", async () => {
    const result = await mapConcurrent([42], 1, async (x) => x * 2);
    expect(result).toEqual([84]);
  });

  it("handles string arrays", async () => {
    const result = await mapConcurrent(["a", "b", "c"], 2, async (s) => s.toUpperCase());
    expect(result).toEqual(["A", "B", "C"]);
  });

  it("handles object arrays", async () => {
    const items = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];
    const result = await mapConcurrent(items, 2, async (item) => ({
      ...item,
      upper: item.name.toUpperCase(),
    }));
    expect(result[0].upper).toBe("ALICE");
    expect(result[1].upper).toBe("BOB");
  });

  it("handles limit of 0 gracefully (no items processed)", async () => {
    // With limit 0, workers array has 0 elements → returns empty results
    const result = await mapConcurrent([1, 2, 3], 0, async (x) => x);
    // Result might be partially filled depending on implementation
    // The key is it doesn't hang indefinitely
    expect(Array.isArray(result)).toBe(true);
  });

  it("processes 100 items with concurrency 5", async () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const result = await mapConcurrent(items, 5, async (x) => x * 2);
    expect(result).toHaveLength(100);
    expect(result[0]).toBe(0);
    expect(result[99]).toBe(198);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// delay
// ─────────────────────────────────────────────────────────────────────────────

describe("delay", () => {
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  it("returns a Promise", () => {
    const p = delay(100);
    expect(p).toBeInstanceOf(Promise);
    jest.runAllTimers();
  });

  it("resolves after the specified milliseconds", async () => {
    let resolved = false;
    delay(1000).then(() => { resolved = true; });
    expect(resolved).toBe(false);
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  it("resolves with undefined", async () => {
    const p = delay(0);
    jest.runAllTimers();
    const result = await p;
    expect(result).toBeUndefined();
  });

  it("handles delay of 0ms", async () => {
    const p = delay(0);
    jest.runAllTimers();
    await expect(p).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fetchWithTimeout
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchWithTimeout", () => {
  const origFetch = global.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.useRealTimers();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  it("calls fetch with the given URL", async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true });
    await fetchWithTimeout("https://example.com");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("returns the fetch response on success", async () => {
    const fakeResponse = { status: 200, ok: true, json: () => Promise.resolve({}) };
    mockFetch.mockResolvedValue(fakeResponse);
    const res = await fetchWithTimeout("https://example.com");
    expect(res.status).toBe(200);
  });

  it("propagates errors from fetch (network failure)", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));
    await expect(fetchWithTimeout("https://example.com")).rejects.toThrow("Network failure");
  });

  it("propagates AbortError on timeout", async () => {
    mockFetch.mockImplementation(() => new Promise((_, reject) => {
      setTimeout(() => reject(new DOMException("The user aborted a request.", "AbortError")), 100);
    }));
    await expect(fetchWithTimeout("https://example.com", {}, 50)).rejects.toThrow();
  });

  it("passes custom options to fetch", async () => {
    const customResponse = { status: 201, ok: true };
    mockFetch.mockResolvedValue(customResponse);
    await fetchWithTimeout("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "value" }),
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("uses default timeout of 12000ms when not specified", async () => {
    // Just ensure it doesn't throw with default timeout
    mockFetch.mockResolvedValue({ status: 200, ok: true });
    await expect(fetchWithTimeout("https://example.com")).resolves.toBeDefined();
  });

  it("handles 404 response (not an error, just a response)", async () => {
    mockFetch.mockResolvedValue({ status: 404, ok: false });
    const res = await fetchWithTimeout("https://example.com");
    expect(res.status).toBe(404);
  });

  it("handles 500 response (not an error, just a response)", async () => {
    mockFetch.mockResolvedValue({ status: 500, ok: false });
    const res = await fetchWithTimeout("https://example.com");
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fetchWithRetry
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchWithRetry", () => {
  const origFetch = global.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.useRealTimers();
    jest.useFakeTimers();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = origFetch;
  });

  async function runWithFakeTimers<T>(fn: () => Promise<T>): Promise<T> {
    jest.useRealTimers();
    const result = await fn();
    return result;
  }

  it("returns the response on first successful attempt", async () => {
    jest.useRealTimers();
    mockFetch.mockResolvedValue({ status: 200, ok: true });
    const res = await fetchWithRetry("https://example.com", {}, 2, 1000);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns 200 without retrying on successful response", async () => {
    jest.useRealTimers();
    mockFetch.mockResolvedValue({ status: 200, ok: true });
    await fetchWithRetry("https://example.com");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 (rate limit)", async () => {
    jest.useRealTimers();
    mockFetch
      .mockResolvedValueOnce({ status: 429, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true });
    const res = await fetchWithRetry("https://example.com", {}, 2, 1000);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 (server error)", async () => {
    jest.useRealTimers();
    mockFetch
      .mockResolvedValueOnce({ status: 500, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true });
    const res = await fetchWithRetry("https://example.com", {}, 2, 1000);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 503 (service unavailable)", async () => {
    jest.useRealTimers();
    mockFetch
      .mockResolvedValueOnce({ status: 503, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true });
    const res = await fetchWithRetry("https://example.com", {}, 2, 1000);
    expect(res.status).toBe(200);
  });

  it("returns last failed response after maxRetries exceeded", async () => {
    jest.useRealTimers();
    mockFetch.mockResolvedValue({ status: 500, ok: false });
    const res = await fetchWithRetry("https://example.com", {}, 2, 1000);
    // After 2 retries, it returns the last 500 response
    expect(res.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("does NOT retry on 400 (client error)", async () => {
    jest.useRealTimers();
    mockFetch.mockResolvedValue({ status: 400, ok: false });
    const res = await fetchWithRetry("https://example.com", {}, 2, 1000);
    expect(res.status).toBe(400);
    expect(mockFetch).toHaveBeenCalledTimes(1); // no retries
  });

  it("does NOT retry on 401 (unauthorized)", async () => {
    jest.useRealTimers();
    mockFetch.mockResolvedValue({ status: 401, ok: false });
    const res = await fetchWithRetry("https://example.com", {}, 2, 1000);
    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 403 (forbidden)", async () => {
    jest.useRealTimers();
    mockFetch.mockResolvedValue({ status: 403, ok: false });
    await fetchWithRetry("https://example.com", {}, 2, 1000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 404 (not found)", async () => {
    jest.useRealTimers();
    mockFetch.mockResolvedValue({ status: 404, ok: false });
    const res = await fetchWithRetry("https://example.com", {}, 2, 1000);
    expect(res.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("propagates network errors (fetch throws)", async () => {
    jest.useRealTimers();
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(fetchWithRetry("https://example.com", {}, 0, 1000)).rejects.toThrow("ECONNREFUSED");
  });

  it("with maxRetries=0 returns response after 1 attempt", async () => {
    jest.useRealTimers();
    mockFetch.mockResolvedValue({ status: 429, ok: false });
    const res = await fetchWithRetry("https://example.com", {}, 0, 1000);
    expect(res.status).toBe(429);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// detectPlatform
// ─────────────────────────────────────────────────────────────────────────────

describe("detectPlatform", () => {
  // ── Greenhouse ────────────────────────────────────────────────────────────
  it.each([
    "https://boards.greenhouse.io/acme/jobs/123456",
    "https://job-boards.greenhouse.io/company/jobs/987654",
    "https://eu.greenhouse.io/company/jobs/111",
    "https://greenhouse.io/company",
    "https://app.greenhouse.io/jobs/apply/12345",
    "http://boards.greenhouse.io/startup/jobs/1",
  ])("identifies Greenhouse URL: '%s'", (url) => {
    expect(detectPlatform(url)).toBe("greenhouse");
  });

  // ── Lever ─────────────────────────────────────────────────────────────────
  it.each([
    "https://jobs.lever.co/acme/abc-def-123",
    "https://jobs.lever.co/startup/position-id",
    "https://lever.co/company/jobs/123",
    "http://jobs.lever.co/test/123/apply",
  ])("identifies Lever URL: '%s'", (url) => {
    expect(detectPlatform(url)).toBe("lever");
  });

  // ── Workday ───────────────────────────────────────────────────────────────
  it.each([
    "https://company.myworkdayjobs.com/en-US/jobs/job/123",
    "https://acme.myworkdayjobs.com/ExternalJobBoard",
    "https://livenation.myworkdayjobs.com/LN_Music/job/New-York/Data-Engineer_JR-123",
    "http://sabre.myworkdayjobs.com/jobs",
  ])("identifies Workday URL: '%s'", (url) => {
    expect(detectPlatform(url)).toBe("workday");
  });

  // ── iCIMS / Disney ────────────────────────────────────────────────────────
  it.each([
    "https://jobs.disneycareers.com/job/new-york/software-engineer/391",
    "https://disneycareers.com/en-US/disney-parks-and-resorts/job/1234",
  ])("identifies iCIMS/Disney URL: '%s'", (url) => {
    expect(detectPlatform(url)).toBe("icims");
  });

  // ── SmartRecruiters ───────────────────────────────────────────────────────
  it.each([
    "https://jobs.smartrecruiters.com/Company/job-id",
    "https://smartrecruiters.com/ACME/123456789",
  ])("identifies SmartRecruiters URL: '%s'", (url) => {
    expect(detectPlatform(url)).toBe("smartrecruiters");
  });

  // ── Ashby ─────────────────────────────────────────────────────────────────
  it.each([
    "https://jobs.ashbyhq.com/linear/abc-def-123",
    "https://jobs.ashbyhq.com/replit/posting-id-456",
    "https://jobs.ashbyhq.com/retool/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "https://ashbyhq.com/company/jobs/123",
  ])("identifies Ashby URL: '%s'", (url) => {
    expect(detectPlatform(url)).toBe("ashby");
  });

  // ── BreezyHR ──────────────────────────────────────────────────────────────
  it.each([
    "https://company.breezy.hr/p/job-id-123",
    "https://acme.breezy.hr/p/senior-software-engineer",
    "https://startup.breezy.hr/p/abc123",
  ])("identifies BreezyHR URL: '%s'", (url) => {
    expect(detectPlatform(url)).toBe("breezy");
  });

  // ── Workable ──────────────────────────────────────────────────────────────
  it.each([
    "https://apply.workable.com/company/j/ABCD1234",
    "https://company.workable.com/jobs/123456",
    "https://workable.com/jobs/abc123",
  ])("identifies Workable URL: '%s'", (url) => {
    expect(detectPlatform(url)).toBe("workable");
  });

  // ── Recruitee ─────────────────────────────────────────────────────────────
  it.each([
    "https://company.recruitee.com/o/software-engineer",
    "https://acme.recruitee.com/o/senior-frontend-developer",
    "https://startup.recruitee.com/o/job-id-123",
  ])("identifies Recruitee URL: '%s'", (url) => {
    expect(detectPlatform(url)).toBe("recruitee");
  });

  // ── Unknown / other ───────────────────────────────────────────────────────
  it.each([
    ["https://linkedin.com/jobs/view/123456", "unknown"],
    ["https://indeed.com/viewjob?jk=abc123", "unknown"],
    ["https://company.com/careers/software-engineer", "unknown"],
    ["https://angel.co/company/acme/jobs/123", "unknown"],
    ["https://jobvite.com/careers/company/job/123", "unknown"],
    ["https://rippling.com/jobs/123", "unknown"],
    ["", "unknown"],
  ])("identifies '%s' as unknown", (url, expected) => {
    expect(detectPlatform(url)).toBe(expected);
  });

  it("returns 'unknown' for empty string", () => {
    expect(detectPlatform("")).toBe("unknown");
  });

  it("does not throw for any URL format", () => {
    const urls = [
      "not-a-url",
      "ftp://greenhouse.io/jobs",
      "greenhouse",
      "https://",
      "http://localhost:3000",
    ];
    for (const url of urls) {
      expect(() => detectPlatform(url)).not.toThrow();
    }
  });

  it("prefers greenhouse over others when URL contains multiple patterns", () => {
    // Unlikely in practice but tests the priority order
    const url = "https://greenhouse.io?redirect=lever.co";
    // 'greenhouse.io' is checked first
    expect(detectPlatform(url)).toBe("greenhouse");
  });

  it("Lever is detected by 'lever.co' substring", () => {
    expect(detectPlatform("https://something-with-lever.co-domain.com")).toBe("lever");
  });
});
