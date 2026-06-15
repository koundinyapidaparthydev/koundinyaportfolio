/**
 * __tests__/lib/resumeStore.test.ts
 *
 * Tests for lib/resumeStore.ts (getResume / saveResume).
 * The Node.js `fs` module is fully mocked so no real disk I/O occurs.
 */

import type { Resume } from "@/types/resume";

// ─── Mock fs BEFORE importing the module under test ──────────────────────────

const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();
const mockRename = jest.fn();

jest.mock("fs", () => ({
  promises: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    rename: (...args: unknown[]) => mockRename(...args),
  },
}));

const mockDownloadFromGCS = jest.fn();
const mockUploadToGCS = jest.fn();

jest.mock("@/lib/gcsUpload", () => ({
  downloadFromGCS: (...args: unknown[]) => mockDownloadFromGCS(...args),
  uploadToGCS: (...args: unknown[]) => mockUploadToGCS(...args),
  RESUME_GCS_KEY: "config/resume.json",
}));

// Import AFTER mock is in place
import { getResume, saveResume } from "@/lib/resumeStore";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const minimalResume: Resume = {
  personalInfo: {
    name: "Test User",
    title: "Engineer",
    email: "test@example.com",
    phone: "555-1234",
    location: "NYC",
    linkedin: "https://linkedin.com/in/test",
    github: "https://github.com/test",
    summary: "A test engineer.",
  },
  experience: [],
  projects: [],
  skills: [],
  education: [],
};

// ─── getResume ────────────────────────────────────────────────────────────────

describe("getResume", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GCS_SERVICE_ACCOUNT_JSON;
    delete process.env.GCS_BUCKET_NAME;
  });

  it("reads the resume file and parses JSON", async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify(minimalResume));

    const result = await getResume();

    expect(mockReadFile).toHaveBeenCalledTimes(1);
    // Verify it reads from .../data/resume.json
    expect(mockReadFile.mock.calls[0][0]).toMatch(/data[/\\]resume\.json$/);
    expect(mockReadFile.mock.calls[0][1]).toBe("utf-8");
    expect(result).toEqual(minimalResume);
  });

  it("returns the correct personalInfo fields", async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify(minimalResume));

    const resume = await getResume();
    expect(resume.personalInfo.name).toBe("Test User");
    expect(resume.personalInfo.email).toBe("test@example.com");
  });

  it("throws when the file is missing (readFile rejects)", async () => {
    const fsError = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValueOnce(fsError);

    await expect(getResume()).rejects.toThrow("ENOENT");
  });

  it("throws when the file contains invalid JSON", async () => {
    mockReadFile.mockResolvedValueOnce("not-valid-json{{{");

    await expect(getResume()).rejects.toThrow();
  });

  it("returns an object with all required top-level keys", async () => {
    const full: Resume = {
      ...minimalResume,
      experience: [
        {
          id: "exp-1",
          companyName: "Acme",
          role: "SWE",
          location: "Remote",
          date: "2023",
          startDate: "2023-01",
          endDate: "Present",
          points: ["Built stuff"],
          technologies: ["TypeScript"],
          otherRoles: [],
        },
      ],
      education: [
        {
          id: "edu-1",
          institution: "MIT",
          degree: "BS",
          field: "CS",
          graduationDate: "2022",
          location: "Cambridge",
        },
      ],
    };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(full));

    const result = await getResume();
    expect(result.experience).toHaveLength(1);
    expect(result.education).toHaveLength(1);
    expect(result.experience[0].companyName).toBe("Acme");
  });
});

// ─── saveResume ───────────────────────────────────────────────────────────────

describe("saveResume", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GCS_SERVICE_ACCOUNT_JSON;
    delete process.env.GCS_BUCKET_NAME;
  });

  it("writes pretty-printed JSON to a temp file and renames it", async () => {
    mockWriteFile.mockResolvedValueOnce(undefined);
    mockRename.mockResolvedValueOnce(undefined);

    await saveResume(minimalResume);

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [tmpPath, content, encoding] = mockWriteFile.mock.calls[0] as [
      string,
      string,
      string
    ];
    expect(tmpPath).toMatch(/resume\.json\.tmp$/);
    expect(encoding).toBe("utf-8");
    expect(JSON.parse(content)).toEqual(minimalResume);
  });

  it("renames the temp file to resume.json", async () => {
    mockWriteFile.mockResolvedValueOnce(undefined);
    mockRename.mockResolvedValueOnce(undefined);

    await saveResume(minimalResume);

    expect(mockRename).toHaveBeenCalledTimes(1);
    const [from, to] = mockRename.mock.calls[0] as [string, string];
    expect(from).toMatch(/resume\.json\.tmp$/);
    expect(to).toMatch(/resume\.json$/);
    expect(to).not.toMatch(/\.tmp$/);
  });

  it("stores data round-trip — saved JSON matches the original object", async () => {
    let captured = "";
    mockWriteFile.mockImplementationOnce(
      (_path: string, data: string) => { captured = data; return Promise.resolve(); }
    );
    mockRename.mockResolvedValueOnce(undefined);

    await saveResume(minimalResume);
    expect(JSON.parse(captured)).toEqual(minimalResume);
  });

  it("propagates writeFile errors when GCS is not configured", async () => {
    mockWriteFile.mockRejectedValueOnce(new Error("ENOSP"));

    await expect(saveResume(minimalResume)).rejects.toThrow(
      "Resume cannot be saved: configure GCS credentials"
    );
    expect(mockRename).not.toHaveBeenCalled();
  });

  it("propagates rename errors when GCS is not configured", async () => {
    mockWriteFile.mockResolvedValueOnce(undefined);
    mockRename.mockRejectedValueOnce(new Error("EACCES"));

    await expect(saveResume(minimalResume)).rejects.toThrow(
      "Resume cannot be saved: configure GCS credentials"
    );
  });

  it("saves to GCS when credentials are configured", async () => {
    process.env.GCS_SERVICE_ACCOUNT_JSON = '{"type":"service_account"}';
    process.env.GCS_BUCKET_NAME = "test-bucket";
    mockUploadToGCS.mockResolvedValueOnce("https://storage.example/config/resume.json");
    mockWriteFile.mockRejectedValueOnce(new Error("EROFS"));

    await saveResume(minimalResume);

    expect(mockUploadToGCS).toHaveBeenCalledWith(
      expect.any(Buffer),
      "config/resume.json",
      "application/json"
    );
    const uploaded = JSON.parse(
      (mockUploadToGCS.mock.calls[0][0] as Buffer).toString("utf-8")
    );
    expect(uploaded).toEqual(minimalResume);
  });

  it("reads from GCS when credentials are configured", async () => {
    process.env.GCS_SERVICE_ACCOUNT_JSON = '{"type":"service_account"}';
    process.env.GCS_BUCKET_NAME = "test-bucket";
    mockDownloadFromGCS.mockResolvedValueOnce(
      Buffer.from(JSON.stringify(minimalResume), "utf-8")
    );

    const result = await getResume();

    expect(mockDownloadFromGCS).toHaveBeenCalledWith("config/resume.json");
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(result).toEqual(minimalResume);
  });

  it("falls back to disk when GCS read fails", async () => {
    process.env.GCS_SERVICE_ACCOUNT_JSON = '{"type":"service_account"}';
    process.env.GCS_BUCKET_NAME = "test-bucket";
    mockDownloadFromGCS.mockRejectedValueOnce(new Error("not found"));
    mockReadFile.mockResolvedValueOnce(JSON.stringify(minimalResume));

    const result = await getResume();

    expect(result).toEqual(minimalResume);
    expect(mockReadFile).toHaveBeenCalled();
  });
});
