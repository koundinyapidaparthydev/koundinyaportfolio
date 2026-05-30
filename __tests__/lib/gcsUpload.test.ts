/**
 * @jest-environment node
 *
 * __tests__/lib/gcsUpload.test.ts
 *
 * Tests for lib/gcsUpload.ts (uploadToGCS).
 * @google-cloud/storage is fully mocked — no real GCS calls occur.
 *
 * Strategy for the module-level singleton (_storage):
 *   • The mock factory exposes shared jest.fn() objects via the module's
 *     `_mocks` property so every test can reconfigure save/getSignedUrl.
 *   • "Missing env-var" tests use jest.resetModules() + jest.doMock() so they
 *     get a fresh _storage = null each time.
 *   • "Upload behaviour" tests use the static import and reconfigure the
 *     shared mock functions in beforeEach.
 */

// ─── Mock factory ─────────────────────────────────────────────────────────────
// Must use only inline jest.fn() calls — no external variable references.
// Exposes _mocks so test code can reconfigure the nested functions.

jest.mock("@google-cloud/storage", () => {
  const mockSave = jest.fn().mockResolvedValue(undefined);
  const mockGetSignedUrl = jest
    .fn()
    .mockResolvedValue(["https://storage.googleapis.com/bucket/file.pdf?sig=abc"]);
  const mockFile = jest.fn().mockImplementation(() => ({
    save: mockSave,
    getSignedUrl: mockGetSignedUrl,
  }));
  const mockBucket = jest.fn().mockImplementation(() => ({ file: mockFile }));
  const MockStorage = jest.fn().mockImplementation(() => ({ bucket: mockBucket }));
  return {
    Storage: MockStorage,
    // Expose inner mocks so tests can reconfigure them
    _mocks: { mockSave, mockGetSignedUrl, mockFile, mockBucket, MockStorage },
  };
});

// ─── Imports (after mock) ─────────────────────────────────────────────────────
import * as GcsStorage from "@google-cloud/storage";
import { uploadToGCS } from "@/lib/gcsUpload";

// Unwrap shared mock functions from the factory
const {
  mockSave,
  mockGetSignedUrl,
  mockFile,
  mockBucket,
  MockStorage,
} = (GcsStorage as unknown as { _mocks: Record<string, jest.Mock> })._mocks;

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const SIGNED_URL = "https://storage.googleapis.com/bucket/file.pdf?sig=abc";
const DUMMY_BUFFER = Buffer.from("fake PDF content for tests");

const VALID_SA_JSON = JSON.stringify({
  type: "service_account",
  project_id: "test-project",
  private_key_id: "key-id",
  private_key: "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAK\n-----END RSA PRIVATE KEY-----",
  client_email: "sa@test-project.iam.gserviceaccount.com",
  client_id: "123456789",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
});

// ─────────────────────────────────────────────────────────────────────────────
// A) Missing env-var tests — each test gets a fresh module via resetModules
// ─────────────────────────────────────────────────────────────────────────────

describe("uploadToGCS – missing env-var guard", () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    // Re-register mock so the fresh module load gets mocked Storage
    jest.doMock("@google-cloud/storage", () => ({
      Storage: jest.fn().mockImplementation(() => ({
        bucket: jest.fn().mockImplementation(() => ({
          file: jest.fn().mockImplementation(() => ({
            save: jest.fn().mockResolvedValue(undefined),
            getSignedUrl: jest.fn().mockResolvedValue([SIGNED_URL]),
          })),
        })),
      })),
    }));
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
    jest.dontMock("@google-cloud/storage");
  });

  it("throws 'GCS_SERVICE_ACCOUNT_JSON is not set' when env var is absent", async () => {
    delete process.env.GCS_SERVICE_ACCOUNT_JSON;
    process.env.GCS_BUCKET_NAME = "test-bucket";
    const { uploadToGCS: fn } = await import("@/lib/gcsUpload");
    await expect(fn(DUMMY_BUFFER, "file.pdf")).rejects.toThrow("GCS_SERVICE_ACCOUNT_JSON is not set");
  });

  it("throws 'GCS_BUCKET_NAME is not set' when bucket env var is absent", async () => {
    process.env.GCS_SERVICE_ACCOUNT_JSON = VALID_SA_JSON;
    delete process.env.GCS_BUCKET_NAME;
    const { uploadToGCS: fn } = await import("@/lib/gcsUpload");
    await expect(fn(DUMMY_BUFFER, "file.pdf")).rejects.toThrow("GCS_BUCKET_NAME is not set");
  });

  it("throws when GCS_SERVICE_ACCOUNT_JSON is empty string", async () => {
    process.env.GCS_SERVICE_ACCOUNT_JSON = "";
    process.env.GCS_BUCKET_NAME = "test-bucket";
    const { uploadToGCS: fn } = await import("@/lib/gcsUpload");
    await expect(fn(DUMMY_BUFFER, "file.pdf")).rejects.toThrow();
  });

  it("throws 'GCS_BUCKET_NAME is not set' when bucket env var is empty string", async () => {
    process.env.GCS_SERVICE_ACCOUNT_JSON = VALID_SA_JSON;
    process.env.GCS_BUCKET_NAME = "";
    const { uploadToGCS: fn } = await import("@/lib/gcsUpload");
    await expect(fn(DUMMY_BUFFER, "file.pdf")).rejects.toThrow("GCS_BUCKET_NAME is not set");
  });

  it("throws SyntaxError when GCS_SERVICE_ACCOUNT_JSON is malformed JSON", async () => {
    process.env.GCS_SERVICE_ACCOUNT_JSON = "{ not valid json }";
    process.env.GCS_BUCKET_NAME = "test-bucket";
    const { uploadToGCS: fn } = await import("@/lib/gcsUpload");
    await expect(fn(DUMMY_BUFFER, "file.pdf")).rejects.toThrow(SyntaxError);
  });

  it("succeeds when both env vars are set", async () => {
    process.env.GCS_SERVICE_ACCOUNT_JSON = VALID_SA_JSON;
    process.env.GCS_BUCKET_NAME = "my-bucket";
    const { uploadToGCS: fn } = await import("@/lib/gcsUpload");
    await expect(fn(DUMMY_BUFFER, "file.pdf")).resolves.toBe(SIGNED_URL);
  });

  it("uses GCS_PROJECT_ID when set", async () => {
    process.env.GCS_SERVICE_ACCOUNT_JSON = VALID_SA_JSON;
    process.env.GCS_BUCKET_NAME = "my-bucket";
    process.env.GCS_PROJECT_ID = "custom-project-123";
    const { uploadToGCS: fn } = await import("@/lib/gcsUpload");
    await fn(DUMMY_BUFFER, "file.pdf");
    const { Storage: S } = await import("@google-cloud/storage");
    const calls = (S as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0]).toEqual(expect.objectContaining({ projectId: "custom-project-123" }));
  });

  it("falls back to 'jobseek-459701' when GCS_PROJECT_ID is unset", async () => {
    process.env.GCS_SERVICE_ACCOUNT_JSON = VALID_SA_JSON;
    process.env.GCS_BUCKET_NAME = "my-bucket";
    delete process.env.GCS_PROJECT_ID;
    const { uploadToGCS: fn } = await import("@/lib/gcsUpload");
    await fn(DUMMY_BUFFER, "file.pdf");
    const { Storage: S } = await import("@google-cloud/storage");
    const calls = (S as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0]).toEqual(expect.objectContaining({ projectId: "jobseek-459701" }));
  });

  it("passes parsed credentials object (not string) to Storage constructor", async () => {
    process.env.GCS_SERVICE_ACCOUNT_JSON = VALID_SA_JSON;
    process.env.GCS_BUCKET_NAME = "my-bucket";
    const { uploadToGCS: fn } = await import("@/lib/gcsUpload");
    await fn(DUMMY_BUFFER, "file.pdf");
    const { Storage: S } = await import("@google-cloud/storage");
    const arg = (S as jest.Mock).mock.calls[0][0] as { credentials: { type: string } };
    expect(typeof arg.credentials).toBe("object");
    expect(arg.credentials.type).toBe("service_account");
    expect(arg.credentials.type).not.toBe(typeof "");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B) Upload behaviour — reconfigure the shared mock functions each test
// ─────────────────────────────────────────────────────────────────────────────

describe("uploadToGCS – upload behaviour", () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default happy-path implementations
    mockSave.mockResolvedValue(undefined);
    mockGetSignedUrl.mockResolvedValue([SIGNED_URL]);
    process.env = {
      ...origEnv,
      GCS_SERVICE_ACCOUNT_JSON: VALID_SA_JSON,
      GCS_BUCKET_NAME: "test-bucket",
      GCS_PROJECT_ID: "test-project",
    };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  // ── Return value ──────────────────────────────────────────────────────────

  it("returns the signed URL string from getSignedUrl", async () => {
    const url = await uploadToGCS(DUMMY_BUFFER, "file.pdf");
    expect(url).toBe(SIGNED_URL);
  });

  it("returns a string type", async () => {
    const result = await uploadToGCS(DUMMY_BUFFER, "file.pdf");
    expect(typeof result).toBe("string");
  });

  it("returns the exact URL from getSignedUrl[0]", async () => {
    const custom = "https://storage.example.com/bucket/custom.pdf?token=XYZ";
    mockGetSignedUrl.mockResolvedValueOnce([custom, "second-url"]);
    const url = await uploadToGCS(DUMMY_BUFFER, "file.pdf");
    expect(url).toBe(custom);
  });

  it("does not return the second element of getSignedUrl array", async () => {
    mockGetSignedUrl.mockResolvedValueOnce(["first-url", "should-not-return-this"]);
    const url = await uploadToGCS(DUMMY_BUFFER, "file.pdf");
    expect(url).toBe("first-url");
    expect(url).not.toBe("should-not-return-this");
  });

  // ── File name ─────────────────────────────────────────────────────────────

  it("passes the fileName to bucket.file()", async () => {
    await uploadToGCS(DUMMY_BUFFER, "resumes/2024/ACME_Engineer.pdf");
    expect(mockFile).toHaveBeenCalledWith("resumes/2024/ACME_Engineer.pdf");
  });

  it.each([
    "resumes/2024-01-01/ACME_SoftwareEngineer.pdf",
    "resumes/2024-12-31/Google_SeniorSWE.pdf",
    "covers/2024-06-15/Meta_FrontendEngineer.pdf",
    "plain-file.pdf",
    "a/b/c/d/e/deep.pdf",
    "file with spaces.pdf",
    "file-with-dashes.pdf",
    "file_with_underscores.pdf",
    "UPPERCASE_FILE.PDF",
    "123numeric.pdf",
  ])("routes file name '%s' to bucket.file()", async (fileName) => {
    await uploadToGCS(DUMMY_BUFFER, fileName);
    expect(mockFile).toHaveBeenCalledWith(fileName);
  });

  // ── Bucket name ───────────────────────────────────────────────────────────

  it.each([
    "my-bucket",
    "prod-resumes",
    "koundinya-job-resumes",
    "test-bucket-123",
    "a",
    "bucket-with-many-hyphens-and-numbers-123",
  ])("calls storage.bucket() with env var bucket name '%s'", async (bucketName) => {
    process.env.GCS_BUCKET_NAME = bucketName;
    await uploadToGCS(DUMMY_BUFFER, "file.pdf");
    expect(mockBucket).toHaveBeenCalledWith(bucketName);
  });

  // ── Content type ──────────────────────────────────────────────────────────

  it.each([
    ["application/pdf", "application/pdf"],
    ["image/png", "image/png"],
    ["text/plain", "text/plain"],
    ["application/octet-stream", "application/octet-stream"],
    ["image/jpeg", "image/jpeg"],
    ["application/json", "application/json"],
  ])("saves with contentType '%s'", async (contentType, expected) => {
    await uploadToGCS(DUMMY_BUFFER, "file", contentType);
    expect(mockSave).toHaveBeenCalledWith(
      DUMMY_BUFFER,
      expect.objectContaining({ metadata: { contentType: expected } })
    );
  });

  it("defaults contentType to 'application/pdf'", async () => {
    await uploadToGCS(DUMMY_BUFFER, "file.pdf");
    expect(mockSave).toHaveBeenCalledWith(
      DUMMY_BUFFER,
      expect.objectContaining({ metadata: { contentType: "application/pdf" } })
    );
  });

  // ── save() options ────────────────────────────────────────────────────────

  it("passes resumable: false to file.save()", async () => {
    await uploadToGCS(DUMMY_BUFFER, "file.pdf");
    expect(mockSave).toHaveBeenCalledWith(
      DUMMY_BUFFER,
      expect.objectContaining({ resumable: false })
    );
  });

  it("passes the buffer as the first arg to save()", async () => {
    await uploadToGCS(DUMMY_BUFFER, "file.pdf");
    const firstArg = mockSave.mock.calls[0][0] as Buffer;
    expect(firstArg).toBe(DUMMY_BUFFER);
  });

  it("calls save() exactly once per upload", async () => {
    await uploadToGCS(DUMMY_BUFFER, "file.pdf");
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it("calls getSignedUrl() exactly once per upload", async () => {
    await uploadToGCS(DUMMY_BUFFER, "file.pdf");
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
  });

  // ── getSignedUrl options ──────────────────────────────────────────────────

  it("calls getSignedUrl with action: 'read'", async () => {
    await uploadToGCS(DUMMY_BUFFER, "file.pdf");
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({ action: "read" })
    );
  });

  it("sets getSignedUrl expires ~7 days from now", async () => {
    const before = Date.now();
    await uploadToGCS(DUMMY_BUFFER, "file.pdf");
    const after = Date.now();
    const opts = mockGetSignedUrl.mock.calls[0][0] as { expires: number };
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(opts.expires).toBeGreaterThanOrEqual(before + sevenDays - 1000);
    expect(opts.expires).toBeLessThanOrEqual(after + sevenDays + 1000);
  });

  it("getSignedUrl expiry is a number (ms timestamp)", async () => {
    await uploadToGCS(DUMMY_BUFFER, "file.pdf");
    const opts = mockGetSignedUrl.mock.calls[0][0] as { expires: number };
    expect(typeof opts.expires).toBe("number");
    expect(opts.expires).toBeGreaterThan(Date.now());
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  it("propagates save() rejection", async () => {
    mockSave.mockRejectedValueOnce(new Error("write failed"));
    await expect(uploadToGCS(DUMMY_BUFFER, "file.pdf")).rejects.toThrow("write failed");
  });

  it("propagates getSignedUrl() rejection", async () => {
    mockGetSignedUrl.mockRejectedValueOnce(new Error("signing failed"));
    await expect(uploadToGCS(DUMMY_BUFFER, "file.pdf")).rejects.toThrow("signing failed");
  });

  it("propagates 404 bucket-not-found error", async () => {
    const err = Object.assign(new Error("bucket does not exist"), { code: 404 });
    mockSave.mockRejectedValueOnce(err);
    await expect(uploadToGCS(DUMMY_BUFFER, "file.pdf")).rejects.toThrow("bucket does not exist");
  });

  it("propagates 403 permission-denied error", async () => {
    const err = Object.assign(new Error("access denied"), { code: 403 });
    mockSave.mockRejectedValueOnce(err);
    await expect(uploadToGCS(DUMMY_BUFFER, "file.pdf")).rejects.toThrow("access denied");
  });

  it("propagates network ECONNREFUSED error", async () => {
    mockSave.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(uploadToGCS(DUMMY_BUFFER, "file.pdf")).rejects.toThrow("ECONNREFUSED");
  });

  it("propagates getSignedUrl auth error", async () => {
    mockGetSignedUrl.mockRejectedValueOnce(new Error("403 Forbidden"));
    await expect(uploadToGCS(DUMMY_BUFFER, "file.pdf")).rejects.toThrow("403 Forbidden");
  });

  // ── Buffer sizes ──────────────────────────────────────────────────────────

  it("handles an empty buffer (0 bytes)", async () => {
    await expect(uploadToGCS(Buffer.alloc(0), "file.pdf")).resolves.toBe(SIGNED_URL);
  });

  it("handles a 1-byte buffer", async () => {
    await expect(uploadToGCS(Buffer.alloc(1), "file.pdf")).resolves.toBe(SIGNED_URL);
  });

  it("handles a 1 KB buffer", async () => {
    await expect(uploadToGCS(Buffer.alloc(1024), "file.pdf")).resolves.toBe(SIGNED_URL);
  });

  it("handles a 1 MB buffer", async () => {
    await expect(uploadToGCS(Buffer.alloc(1_000_000), "file.pdf")).resolves.toBe(SIGNED_URL);
  });

  it("handles a 10 MB buffer", async () => {
    await expect(uploadToGCS(Buffer.alloc(10_000_000), "file.pdf")).resolves.toBe(SIGNED_URL);
  });

  it("passes the correct buffer to save() regardless of size", async () => {
    const buf = Buffer.from("hello world PDF content");
    await uploadToGCS(buf, "file.pdf");
    expect(mockSave.mock.calls[0][0]).toBe(buf);
  });

  // ── Concurrent uploads ────────────────────────────────────────────────────

  it("handles 3 concurrent uploads and returns URLs for all", async () => {
    const bufs = Array.from({ length: 3 }, (_, i) => Buffer.from(`PDF ${i}`));
    const results = await Promise.all(bufs.map((b, i) => uploadToGCS(b, `file-${i}.pdf`)));
    expect(results).toHaveLength(3);
    results.forEach((url) => expect(typeof url).toBe("string"));
  });

  it("handles 10 concurrent uploads without error", async () => {
    const uploads = Array.from({ length: 10 }, (_, i) =>
      uploadToGCS(DUMMY_BUFFER, `file-${i}.pdf`)
    );
    await expect(Promise.all(uploads)).resolves.toHaveLength(10);
  });

  // ── Sequential uploads ────────────────────────────────────────────────────

  it("handles 5 sequential uploads each returning correct URL", async () => {
    for (let i = 0; i < 5; i++) {
      const url = await uploadToGCS(DUMMY_BUFFER, `file-${i}.pdf`);
      expect(url).toBe(SIGNED_URL);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C) ATS Scoring — pure function, no mocking needed
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateAtsScore", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let calc: (desc: string, resume: any) => { score: number; matched: string[]; missing: string[]; label: string };

  const resume = {
    personalInfo: { name: "T", title: "SWE", email: "t@t.com", phone: "5551234", location: "NY", linkedin: "", github: "", summary: "" },
    experience: [{
      company: "A", role: "SWE", start: "2022", end: "now",
      points: ["Built React apps with TypeScript on AWS"],
      technologies: ["React", "TypeScript", "AWS", "Node.js", "PostgreSQL"],
    }],
    projects: [{ name: "P", description: "proj", stack: ["Next.js", "Docker", "Redis"], url: "" }],
    skills: [
      { category: "FE", skills: ["React", "Next.js", "TypeScript", "HTML", "CSS"] },
      { category: "BE", skills: ["Node.js", "Express", "PostgreSQL", "Redis"] },
    ],
    education: [],
  };

  beforeAll(async () => {
    const m = await import("@/lib/atsScoring");
    calc = m.calculateAtsScore;
  });

  it("score is 0 for empty description", () => expect(calc("", resume).score).toBe(0));
  it("score is 0 for whitespace only", () => expect(calc("   ", resume).score).toBe(0));
  it("label is 'low' for empty description", () => expect(calc("", resume).label).toBe("low"));
  it("matched is [] for empty description", () => expect(calc("", resume).matched).toEqual([]));
  it("missing is [] for empty description", () => expect(calc("", resume).missing).toEqual([]));

  it("score is between 0 and 100", () => {
    const r = calc("React TypeScript Node.js", resume);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("has all four required fields in result", () => {
    const r = calc("React developer", resume);
    expect(r).toHaveProperty("score");
    expect(r).toHaveProperty("matched");
    expect(r).toHaveProperty("missing");
    expect(r).toHaveProperty("label");
  });

  it("matched and missing are arrays", () => {
    const r = calc("React developer", resume);
    expect(Array.isArray(r.matched)).toBe(true);
    expect(Array.isArray(r.missing)).toBe(true);
  });

  it("matches 'react' keyword", () => expect(calc("React developer needed", resume).matched).toContain("react"));
  it("matches 'typescript' keyword", () => expect(calc("TypeScript required", resume).matched).toContain("typescript"));

  it("matched and missing are mutually exclusive", () => {
    const r = calc("React TypeScript PostgreSQL GraphQL", resume);
    const matchSet = new Set(r.matched);
    r.missing.forEach((m) => expect(matchSet.has(m)).toBe(false));
  });

  it("higher match description scores higher than unrelated one", () => {
    const hi = calc("React TypeScript Node.js AWS PostgreSQL", resume);
    const lo = calc("COBOL FORTRAN Mainframe PL/1", resume);
    expect(hi.score).toBeGreaterThanOrEqual(lo.score);
  });

  it.each([
    ["Python machine learning TensorFlow"],
    ["Java Spring Boot Kubernetes"],
    ["Ruby Rails Redis Sidekiq"],
    ["Swift iOS Xcode"],
    ["C++ embedded RTOS"],
    ["PHP Laravel MySQL"],
  ])("does not crash on unrelated stack: '%s'", (desc) => {
    const r = calc(desc, resume);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it.each([
    "we are",
    "the team is looking for",
    "required skills include",
    "experience with the and or",
  ])("does not match stop words in: '%s'", (desc) => {
    const r = calc(desc, resume);
    expect(r.matched).toHaveLength(0);
  });

  it("label high implies score >= 70", () => {
    const r = calc("React TypeScript Node.js AWS", resume);
    if (r.label === "high") expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("label medium implies 40 <= score < 70", () => {
    const r = calc("React TypeScript Python Django", resume);
    if (r.label === "medium") {
      expect(r.score).toBeGreaterThanOrEqual(40);
      expect(r.score).toBeLessThan(70);
    }
  });

  it("label low implies score < 40", () => {
    const r = calc("COBOL FORTRAN Mainframe Assembly", resume);
    if (r.label === "low") expect(r.score).toBeLessThan(40);
  });

  it("score does not exceed 100 even for perfect match", () => {
    const perfectDesc = "React TypeScript Node.js Next.js AWS PostgreSQL Redis Express Docker";
    const r = calc(perfectDesc, resume);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
