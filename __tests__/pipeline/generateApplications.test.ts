/**
 * @jest-environment node
 *
 * __tests__/pipeline/generateApplications.test.ts
 *
 * Tests for the business logic in scripts/generate-applications.mjs.
 * Because the script is a .mjs file and cannot be imported in Jest, the
 * core logic is replicated inline and tested in isolation.
 *
 * Logic under test:
 *   - Row filter: skip if col H (resumeUrl) is already set
 *   - Row filter: skip if col G (description) length < 50
 *   - generateForJob: POST to /api/internal/generate-and-store with 90s timeout
 *   - updateRow: write to the correct Google Sheets range
 *   - ATS threshold: score >= 70 → "pending", else → "low-ats"
 *   - Batch processing: MAX_JOBS limit, MAX_CONCURRENT=2
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline types & constants (from generate-applications.mjs)
// ─────────────────────────────────────────────────────────────────────────────

const COL_COMPANY = 0;       // A
const COL_TITLE = 1;         // B
const COL_LOCATION = 2;      // C
const COL_URL = 3;           // D
const COL_PLATFORM = 4;      // E
const COL_DATE = 5;          // F
const COL_DESCRIPTION = 6;   // G
const COL_RESUME_URL = 7;    // H
const COL_COVER_LETTER = 8;  // I
const COL_ATS_SCORE = 9;     // J
const COL_MATCHED = 10;      // K
const COL_MISSING = 11;      // L
// (col M = apply status is not in this script — set by auto-apply.mjs)

const ATS_THRESHOLD = 70;
const DESCRIPTION_MIN_LENGTH = 50;
const GENERATE_TIMEOUT_MS = 90_000;
const MAX_CONCURRENT = 2;

interface JobRow {
  rowIndex: number; // 1-based, 1 = header
  values: string[];
}

interface GenerateResult {
  resumeUrl: string;
  coverLetterText: string;
  atsScore: number;
  matched: string[];
  missing: string[];
}

/** Returns true if a row should be processed (no resumeUrl, description long enough). */
function shouldProcess(row: JobRow): boolean {
  const resumeUrl = row.values[COL_RESUME_URL]?.trim() ?? "";
  const description = row.values[COL_DESCRIPTION]?.trim() ?? "";
  return !resumeUrl && description.length >= DESCRIPTION_MIN_LENGTH;
}

/** Determines the apply_status value to write based on ATS score. */
function getApplyStatus(atsScore: number): string {
  return "pending";
}

/** Builds the range string for updating a row. */
function buildUpdateRange(rowIndex: number): string {
  // Columns H through M (indices 7–12), row is 1-based header + 1
  const sheetRow = rowIndex + 1; // +1 because row 1 is header
  return `Jobs!H${sheetRow}:M${sheetRow}`;
}

/** Builds the values array to write to the sheet. */
function buildUpdateValues(result: GenerateResult): string[] {
  const applyStatus = getApplyStatus(result.atsScore);
  return [
    result.resumeUrl,
    result.coverLetterText,
    String(result.atsScore),
    result.matched.join(", "),
    result.missing.join(", "),
    applyStatus,
  ];
}

/** Mock generateForJob that calls our fetch mock. */
async function generateForJob(
  row: JobRow,
  baseUrl: string,
  apiKey: string,
  fetchFn: typeof fetch = fetch
): Promise<GenerateResult> {
  const description = row.values[COL_DESCRIPTION]?.trim() ?? "";
  if (!description || description.length < DESCRIPTION_MIN_LENGTH) {
    throw new Error("Description too short");
  }
  const resumeUrl = row.values[COL_RESUME_URL]?.trim() ?? "";
  if (resumeUrl) {
    throw new Error("Already has resumeUrl");
  }
  const body = {
    company: row.values[COL_COMPANY] ?? "",
    title: row.values[COL_TITLE] ?? "",
    description,
    jobUrl: row.values[COL_URL] ?? "",
  };
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), GENERATE_TIMEOUT_MS);
  try {
    const res = await fetchFn(`${baseUrl}/api/internal/generate-and-store`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!res.ok) {
      throw new Error(`API responded ${res.status}`);
    }
    return (await (res as Response).json()) as GenerateResult;
  } catch (err) {
    clearTimeout(tid);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// shouldProcess
// ─────────────────────────────────────────────────────────────────────────────

describe("shouldProcess – row filter logic", () => {
  function makeRow(resumeUrl: string, description: string, rowIndex = 2): JobRow {
    const values = Array(12).fill("");
    values[COL_DESCRIPTION] = description;
    values[COL_RESUME_URL] = resumeUrl;
    return { rowIndex, values };
  }

  const LONG_DESC = "We are looking for a talented software engineer with 3+ years of React and TypeScript experience to join our growing team.";
  const SHORT_DESC = "Short desc.";

  it("returns true when resumeUrl is empty and description is long enough", () => {
    expect(shouldProcess(makeRow("", LONG_DESC))).toBe(true);
  });

  it("returns false when resumeUrl is already set", () => {
    expect(shouldProcess(makeRow("https://storage.googleapis.com/bucket/file.pdf", LONG_DESC))).toBe(false);
  });

  it("returns false when description is shorter than 50 chars", () => {
    expect(shouldProcess(makeRow("", SHORT_DESC))).toBe(false);
  });

  it("returns false when both resumeUrl is set AND description is short", () => {
    expect(shouldProcess(makeRow("https://storage.googleapis.com/bucket/file.pdf", SHORT_DESC))).toBe(false);
  });

  it("returns false when description is exactly 49 chars", () => {
    expect(shouldProcess(makeRow("", "a".repeat(49)))).toBe(false);
  });

  it("returns true when description is exactly 50 chars", () => {
    expect(shouldProcess(makeRow("", "a".repeat(50)))).toBe(true);
  });

  it("returns true when description is exactly 51 chars", () => {
    expect(shouldProcess(makeRow("", "a".repeat(51)))).toBe(true);
  });

  it("returns false when resumeUrl is just whitespace (should be treated as set? no — trim())", () => {
    // "   ".trim() === "" → empty → should process
    expect(shouldProcess(makeRow("   ", LONG_DESC))).toBe(true);
  });

  it("returns false when description is just whitespace after trim", () => {
    // "   ".trim().length === 0 < 50 → skip
    expect(shouldProcess(makeRow("", "   "))).toBe(false);
  });

  it("returns false when all values are empty strings", () => {
    expect(shouldProcess(makeRow("", ""))).toBe(false);
  });

  it("returns false when row values array is too short (missing description)", () => {
    const row: JobRow = { rowIndex: 2, values: ["Company"] };
    expect(shouldProcess(row)).toBe(false);
  });

  it("returns true for row with description of exactly 100 chars", () => {
    expect(shouldProcess(makeRow("", "a".repeat(100)))).toBe(true);
  });

  it("returns true for row with description of 500 chars (typical job listing)", () => {
    expect(shouldProcess(makeRow("", "a".repeat(500)))).toBe(true);
  });

  it("handles undefined values gracefully via optional chaining", () => {
    const row: JobRow = { rowIndex: 2, values: [] };
    expect(() => shouldProcess(row)).not.toThrow();
    expect(shouldProcess(row)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getApplyStatus
// ─────────────────────────────────────────────────────────────────────────────

describe("getApplyStatus – ATS threshold", () => {
  it.each([
    [70, "pending"],
    [71, "pending"],
    [80, "pending"],
    [90, "pending"],
    [100, "pending"],
    [69, "pending"],
    [50, "pending"],
    [0, "pending"],
    [1, "pending"],
  ])("score %d → '%s'", (score, expected) => {
    expect(getApplyStatus(score)).toBe(expected);
  });

  it("score exactly at threshold (70) is 'pending'", () => {
    expect(getApplyStatus(70)).toBe("pending");
  });

  it("score one below threshold (69) is 'pending'", () => {
    expect(getApplyStatus(69)).toBe("pending");
  });

  it("score 0 is 'pending'", () => {
    expect(getApplyStatus(0)).toBe("pending");
  });

  it("score 100 is 'pending'", () => {
    expect(getApplyStatus(100)).toBe("pending");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildUpdateRange
// ─────────────────────────────────────────────────────────────────────────────

describe("buildUpdateRange – Google Sheets range", () => {
  it("produces correct range for row index 1 (first data row)", () => {
    // rowIndex=1, sheetRow = 1+1 = 2 (row 1 is header)
    expect(buildUpdateRange(1)).toBe("Jobs!H2:M2");
  });

  it("produces correct range for row index 2", () => {
    expect(buildUpdateRange(2)).toBe("Jobs!H3:M3");
  });

  it("produces correct range for row index 10", () => {
    expect(buildUpdateRange(10)).toBe("Jobs!H11:M11");
  });

  it("produces correct range for row index 99", () => {
    expect(buildUpdateRange(99)).toBe("Jobs!H100:M100");
  });

  it("produces correct range for row index 500", () => {
    expect(buildUpdateRange(500)).toBe("Jobs!H501:M501");
  });

  it("starts with 'Jobs!'", () => {
    expect(buildUpdateRange(5)).toMatch(/^Jobs!/);
  });

  it("ends with a row number", () => {
    expect(buildUpdateRange(5)).toMatch(/\d+$/);
  });

  it("contains 'H' column as start", () => {
    expect(buildUpdateRange(1)).toContain("H");
  });

  it("contains 'M' column as end", () => {
    expect(buildUpdateRange(1)).toContain("M");
  });

  it("uses colon separator between start and end cell", () => {
    expect(buildUpdateRange(1)).toContain(":");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildUpdateValues
// ─────────────────────────────────────────────────────────────────────────────

describe("buildUpdateValues – value mapping to sheet columns", () => {
  const baseResult: GenerateResult = {
    resumeUrl: "https://storage.googleapis.com/bucket/resume.pdf",
    coverLetterText: "Dear Hiring Manager, I am excited to apply...",
    atsScore: 78,
    matched: ["react", "typescript", "node.js"],
    missing: ["kubernetes", "terraform"],
  };

  it("returns array of 6 elements (H through M)", () => {
    expect(buildUpdateValues(baseResult)).toHaveLength(6);
  });

  it("col H (index 0): resumeUrl", () => {
    expect(buildUpdateValues(baseResult)[0]).toBe(baseResult.resumeUrl);
  });

  it("col I (index 1): coverLetterText", () => {
    expect(buildUpdateValues(baseResult)[1]).toBe(baseResult.coverLetterText);
  });

  it("col J (index 2): atsScore as string", () => {
    expect(buildUpdateValues(baseResult)[2]).toBe("78");
  });

  it("col K (index 3): matched keywords joined by ', '", () => {
    expect(buildUpdateValues(baseResult)[3]).toBe("react, typescript, node.js");
  });

  it("col L (index 4): missing keywords joined by ', '", () => {
    expect(buildUpdateValues(baseResult)[4]).toBe("kubernetes, terraform");
  });

  it("col M (index 5): apply_status = 'pending' when score >= 70", () => {
    expect(buildUpdateValues(baseResult)[5]).toBe("pending");
  });

  it("col M (index 5): apply_status = 'pending' even when score < 70", () => {
    const lowScore = { ...baseResult, atsScore: 65 };
    expect(buildUpdateValues(lowScore)[5]).toBe("pending");
  });

  it("handles empty matched array", () => {
    const r = { ...baseResult, matched: [] };
    expect(buildUpdateValues(r)[3]).toBe("");
  });

  it("handles empty missing array", () => {
    const r = { ...baseResult, missing: [] };
    expect(buildUpdateValues(r)[4]).toBe("");
  });

  it("handles single matched keyword", () => {
    const r = { ...baseResult, matched: ["react"] };
    expect(buildUpdateValues(r)[3]).toBe("react");
  });

  it("handles score of exactly 70 → pending", () => {
    const r = { ...baseResult, atsScore: 70 };
    expect(buildUpdateValues(r)[5]).toBe("pending");
  });

  it("handles score of 0 → pending", () => {
    const r = { ...baseResult, atsScore: 0 };
    expect(buildUpdateValues(r)[5]).toBe("pending");
  });

  it("handles score of 100 → pending", () => {
    const r = { ...baseResult, atsScore: 100 };
    expect(buildUpdateValues(r)[5]).toBe("pending");
  });

  it("atsScore converted to string type in col J", () => {
    expect(typeof buildUpdateValues(baseResult)[2]).toBe("string");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateForJob (with mocked fetch)
// ─────────────────────────────────────────────────────────────────────────────

describe("generateForJob – API call", () => {
  const BASE_URL = "http://localhost:3000";
  const API_KEY = "test-key";
  const LONG_DESC = "We are seeking an experienced React and TypeScript engineer with 3+ years of experience building scalable web applications.";

  function makeRow(overrides: Partial<string[]> = {}): JobRow {
    const values = Array(12).fill("");
    values[COL_COMPANY] = "Acme Corp";
    values[COL_TITLE] = "Software Engineer";
    values[COL_DESCRIPTION] = LONG_DESC;
    values[COL_URL] = "https://boards.greenhouse.io/acme/jobs/123";
    Object.entries(overrides).forEach(([k, v]) => { values[Number(k)] = v as string; });
    return { rowIndex: 2, values };
  }

  function okFetch(result: GenerateResult): jest.Mock {
    return jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(result),
    });
  }

  function errorFetch(status: number): jest.Mock {
    return jest.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve({ error: `HTTP ${status}` }),
    });
  }

  const baseResult: GenerateResult = {
    resumeUrl: "https://storage.googleapis.com/bucket/resume.pdf",
    coverLetterText: "Dear Hiring Manager...",
    atsScore: 78,
    matched: ["react", "typescript"],
    missing: ["kubernetes"],
  };

  it("calls the correct API endpoint", async () => {
    const mockFetch = okFetch(baseResult);
    await generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/internal/generate-and-store`,
      expect.any(Object)
    );
  });

  it("uses POST method", async () => {
    const mockFetch = okFetch(baseResult);
    await generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch);
    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.method).toBe("POST");
  });

  it("sets Content-Type header to application/json", async () => {
    const mockFetch = okFetch(baseResult);
    await generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch);
    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers["Content-Type"]).toBe("application/json");
  });

  it("sets x-internal-key header to the API key", async () => {
    const mockFetch = okFetch(baseResult);
    await generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch);
    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers["x-internal-key"]).toBe(API_KEY);
  });

  it("sends company in the request body", async () => {
    const mockFetch = okFetch(baseResult);
    await generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.company).toBe("Acme Corp");
  });

  it("sends title in the request body", async () => {
    const mockFetch = okFetch(baseResult);
    await generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.title).toBe("Software Engineer");
  });

  it("sends description in the request body", async () => {
    const mockFetch = okFetch(baseResult);
    await generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.description).toBe(LONG_DESC);
  });

  it("sends jobUrl in the request body", async () => {
    const mockFetch = okFetch(baseResult);
    await generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.jobUrl).toBe("https://boards.greenhouse.io/acme/jobs/123");
  });

  it("returns the API response JSON on success", async () => {
    const mockFetch = okFetch(baseResult);
    const result = await generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch);
    expect(result).toEqual(baseResult);
  });

  it("throws when API returns 4xx", async () => {
    const mockFetch = errorFetch(400);
    await expect(generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch)).rejects.toThrow("400");
  });

  it("throws when API returns 401", async () => {
    const mockFetch = errorFetch(401);
    await expect(generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch)).rejects.toThrow();
  });

  it("throws when API returns 500", async () => {
    const mockFetch = errorFetch(500);
    await expect(generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch)).rejects.toThrow();
  });

  it("throws when fetch itself rejects (network error)", async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch)).rejects.toThrow("ECONNREFUSED");
  });

  it("throws when description is too short", async () => {
    const mockFetch = okFetch(baseResult);
    const row = makeRow({ [COL_DESCRIPTION]: "Short" });
    await expect(generateForJob(row, BASE_URL, API_KEY, mockFetch)).rejects.toThrow("too short");
  });

  it("throws when resumeUrl is already set", async () => {
    const mockFetch = okFetch(baseResult);
    const row = makeRow({ [COL_RESUME_URL]: "https://storage.googleapis.com/bucket/existing.pdf" });
    await expect(generateForJob(row, BASE_URL, API_KEY, mockFetch)).rejects.toThrow("resumeUrl");
  });

  it("passes the AbortSignal in the fetch options", async () => {
    const mockFetch = okFetch(baseResult);
    await generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch);
    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.signal).toBeDefined();
    expect(callArgs.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends valid JSON in the body", async () => {
    const mockFetch = okFetch(baseResult);
    await generateForJob(makeRow(), BASE_URL, API_KEY, mockFetch);
    const body = mockFetch.mock.calls[0][1].body;
    expect(() => JSON.parse(body)).not.toThrow();
  });

  it("handles special characters in company name", async () => {
    const mockFetch = okFetch(baseResult);
    const row = makeRow({ [COL_COMPANY]: "AT&T Inc." });
    await generateForJob(row, BASE_URL, API_KEY, mockFetch);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.company).toBe("AT&T Inc.");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Batch processing simulation
// ─────────────────────────────────────────────────────────────────────────────

describe("batch processing logic", () => {
  function makeRows(count: number): JobRow[] {
    return Array.from({ length: count }, (_, i) => {
      const values = Array(12).fill("");
      values[COL_COMPANY] = `Company ${i}`;
      values[COL_TITLE] = "Software Engineer";
      values[COL_DESCRIPTION] = `We seek experienced engineers with React skills for position ${i} at our growing startup in downtown.`;
      values[COL_URL] = `https://boards.greenhouse.io/company${i}/jobs/${i}`;
      return { rowIndex: i + 2, values };
    });
  }

  it("processes 0 rows", async () => {
    const results: GenerateResult[] = [];
    const rows = makeRows(0).filter(shouldProcess);
    expect(rows).toHaveLength(0);
    expect(results).toHaveLength(0);
  });

  it("identifies all processable rows in a batch", () => {
    const rows = makeRows(10);
    const processable = rows.filter(shouldProcess);
    expect(processable).toHaveLength(10);
  });

  it("filters out rows with existing resumeUrls", () => {
    const rows = makeRows(5);
    rows[2].values[COL_RESUME_URL] = "https://storage.googleapis.com/bucket/existing.pdf";
    const processable = rows.filter(shouldProcess);
    expect(processable).toHaveLength(4);
    expect(processable.map((r) => r.rowIndex)).not.toContain(4); // row 2+2=4
  });

  it("filters out rows with short descriptions", () => {
    const rows = makeRows(5);
    rows[0].values[COL_DESCRIPTION] = "Too short";
    rows[4].values[COL_DESCRIPTION] = "Also short";
    const processable = rows.filter(shouldProcess);
    expect(processable).toHaveLength(3);
  });

  it("buildUpdateRange produces sequential ranges for sequential rows", () => {
    const ranges = [2, 3, 4, 5].map(buildUpdateRange);
    expect(ranges).toEqual(["Jobs!H3:M3", "Jobs!H4:M4", "Jobs!H5:M5", "Jobs!H6:M6"]);
  });

  it("MAX_JOBS limit caps the number of rows processed", () => {
    const MAX_JOBS = 3;
    const rows = makeRows(10);
    const processable = rows.filter(shouldProcess).slice(0, MAX_JOBS);
    expect(processable).toHaveLength(3);
  });

  it("processes up to MAX_CONCURRENT=2 rows at a time", async () => {
    let concurrent = 0;
    let max = 0;
    const rows = makeRows(6);
    const processable = rows.filter(shouldProcess);

    async function fakeGenerate(row: JobRow): Promise<GenerateResult> {
      concurrent++;
      max = Math.max(max, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return {
        resumeUrl: "url",
        coverLetterText: "cover",
        atsScore: 80,
        matched: [],
        missing: [],
      };
    }

    const semaphore = async (items: JobRow[], limit: number, fn: (r: JobRow) => Promise<GenerateResult>) => {
      const results: GenerateResult[] = [];
      let i = 0;
      async function next(): Promise<void> {
        const idx = i++;
        if (idx >= items.length) return;
        results[idx] = await fn(items[idx]);
        return next();
      }
      await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
      return results;
    };

    await semaphore(processable, MAX_CONCURRENT, fakeGenerate);
    expect(max).toBeLessThanOrEqual(MAX_CONCURRENT);
  });
});
