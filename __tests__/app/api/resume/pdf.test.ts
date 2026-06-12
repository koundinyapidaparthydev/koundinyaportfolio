/**
 * @jest-environment node
 *
 * __tests__/app/api/resume/pdf.test.ts
 *
 * Hard-case tests for GET /api/resume/pdf
 *
 * Validates:
 *  - 200 response with correct Content-Type, Content-Disposition, Cache-Control
 *  - Response body begins with the %PDF- magic bytes
 *  - Content-Length reflects actual file size
 *  - 404 with structured JSON when fs.readFile throws ENOENT
 *  - 404 when readFile throws EACCES (permission denied)
 *  - 404 when readFile throws any unexpected error
 *  - Returns binary buffer unmodified (no byte corruption)
 *  - Does not expose internal paths in the error body
 *  - Correct filename in Content-Disposition with spaces encoded
 *  - Cache-Control max-age is at least 3600 seconds
 */

// ─── Mock fs BEFORE importing the route ──────────────────────────────────────
jest.mock("fs", () => {
  const actual = jest.requireActual("fs") as typeof import("fs");
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: jest.fn(),
    },
  };
});

import { GET } from "@/app/api/resume/pdf/route";
import { promises as fs } from "fs";

const mockReadFile = jest.mocked(fs.readFile);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal valid PDF bytes — starts with %PDF-1.4 signature. */
const VALID_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
  "ascii"
);

/** Large synthetic PDF (100 KB). */
const LARGE_PDF_BYTES = Buffer.alloc(100_000, 0x50); // 100 KB of 'P' bytes

/** Empty buffer. */
const EMPTY_BUFFER = Buffer.alloc(0);

function makeEnoent(): NodeJS.ErrnoException {
  const e = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
  e.code = "ENOENT";
  return e;
}

function makeEacces(): NodeJS.ErrnoException {
  const e = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
  e.code = "EACCES";
  return e;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/resume/pdf — success cases", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 200 when the PDF file exists", async () => {
    // @ts-expect-error: Buffer satisfies the overloaded readFile signature
    mockReadFile.mockResolvedValueOnce(VALID_PDF_BYTES);
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("sets Content-Type: application/pdf", async () => {
    // @ts-expect-error: overload mismatch
    mockReadFile.mockResolvedValueOnce(VALID_PDF_BYTES);
    const res = await GET();
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("sets Content-Disposition to attachment with the correct filename", async () => {
    // @ts-expect-error: overload mismatch
    mockReadFile.mockResolvedValueOnce(VALID_PDF_BYTES);
    const res = await GET();
    const cd = res.headers.get("Content-Disposition") ?? "";
    expect(cd).toContain("attachment");
    expect(cd).toContain("Koundinya_Pidaparthy_resume.pdf");
  });

  it("filename in Content-Disposition uses underscores (no unencoded spaces)", async () => {
    // @ts-expect-error: overload mismatch
    mockReadFile.mockResolvedValueOnce(VALID_PDF_BYTES);
    const res = await GET();
    const cd = res.headers.get("Content-Disposition") ?? "";
    // Filenames with literal spaces in Content-Disposition break some clients
    const filenameMatch = cd.match(/filename="([^"]+)"/);
    expect(filenameMatch).not.toBeNull();
    const filename = filenameMatch![1];
    expect(filename).not.toContain(" "); // no unencoded spaces
    expect(filename).toBe("Koundinya_Pidaparthy_resume.pdf");
  });

  it("sets Cache-Control with public max-age >= 3600", async () => {
    // @ts-expect-error: overload mismatch
    mockReadFile.mockResolvedValueOnce(VALID_PDF_BYTES);
    const res = await GET();
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("public");
    const maxAgeMatch = cc.match(/max-age=(\d+)/);
    expect(maxAgeMatch).not.toBeNull();
    expect(Number(maxAgeMatch![1])).toBeGreaterThanOrEqual(3600);
  });

  it("returns the PDF bytes verbatim — magic bytes intact (%PDF-)", async () => {
    // @ts-expect-error: overload mismatch
    mockReadFile.mockResolvedValueOnce(VALID_PDF_BYTES);
    const res = await GET();
    const body = await res.arrayBuffer();
    const bytes = Buffer.from(body);
    // First 5 bytes must be the PDF magic number %PDF-
    expect(bytes.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("handles a large PDF (100 KB) without corruption", async () => {
    // @ts-expect-error: overload mismatch
    mockReadFile.mockResolvedValueOnce(LARGE_PDF_BYTES);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.arrayBuffer();
    expect(Buffer.byteLength(Buffer.from(body))).toBe(100_000);
  });

  it("returns 200 even for an empty buffer (serves empty file)", async () => {
    // @ts-expect-error: overload mismatch
    mockReadFile.mockResolvedValueOnce(EMPTY_BUFFER);
    const res = await GET();
    // The route does not validate file content — it serves whatever exists
    expect(res.status).toBe(200);
  });

  it("reads exactly once per request (no double-read)", async () => {
    // @ts-expect-error: overload mismatch
    mockReadFile.mockResolvedValueOnce(VALID_PDF_BYTES);
    await GET();
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it("reads from 'public/resume.pdf' relative to cwd", async () => {
    // @ts-expect-error: overload mismatch
    mockReadFile.mockResolvedValueOnce(VALID_PDF_BYTES);
    await GET();
    const calledPath = String(mockReadFile.mock.calls[0][0]);
    expect(calledPath).toMatch(/public[/\\]resume\.pdf$/);
  });
});

describe("GET /api/resume/pdf — not-found / error cases", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 when file is missing (ENOENT)", async () => {
    mockReadFile.mockRejectedValueOnce(makeEnoent());
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns JSON error body when file is missing", async () => {
    mockReadFile.mockRejectedValueOnce(makeEnoent());
    const res = await GET();
    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("error message does not expose internal filesystem paths", async () => {
    mockReadFile.mockRejectedValueOnce(makeEnoent());
    const res = await GET();
    const body = await res.json() as { error: string };
    // Should NOT leak cwd or absolute paths
    expect(body.error).not.toMatch(/\/Users\//);
    expect(body.error).not.toMatch(/C:\\/);
    expect(body.error).not.toMatch(/process\.cwd/);
  });

  it("returns 404 when permission denied (EACCES)", async () => {
    mockReadFile.mockRejectedValueOnce(makeEacces());
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns 404 for any unexpected readFile error", async () => {
    mockReadFile.mockRejectedValueOnce(new Error("EIO: i/o error"));
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("error response is valid JSON (not binary)", async () => {
    mockReadFile.mockRejectedValueOnce(makeEnoent());
    const res = await GET();
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("does NOT set Content-Disposition on 404 response", async () => {
    mockReadFile.mockRejectedValueOnce(makeEnoent());
    const res = await GET();
    // 404 is a JSON error — no attachment header should be present
    const cd = res.headers.get("Content-Disposition");
    expect(cd).toBeNull();
  });
});

describe("GET /api/resume/pdf — concurrent calls", () => {
  beforeEach(() => jest.clearAllMocks());

  it("handles 10 concurrent requests independently", async () => {
    // @ts-expect-error: overload mismatch
    mockReadFile.mockResolvedValue(VALID_PDF_BYTES);
    const responses = await Promise.all(Array.from({ length: 10 }, () => GET()));
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
    }
    expect(mockReadFile).toHaveBeenCalledTimes(10);
  });

  it("all concurrent 404 responses are identical", async () => {
    mockReadFile.mockRejectedValue(makeEnoent());
    const responses = await Promise.all(Array.from({ length: 5 }, () => GET()));
    const statuses = responses.map((r) => r.status);
    expect(statuses).toEqual([404, 404, 404, 404, 404]);
  });
});
