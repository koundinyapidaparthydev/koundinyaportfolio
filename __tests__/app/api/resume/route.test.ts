/**
 * @jest-environment node
 *
 * __tests__/app/api/resume/route.test.ts
 *
 * Tests for app/api/resume/route.ts (GET and PUT handlers).
 * Mocks getResume / saveResume and the auth guard.
 */

import type { Resume } from "@/types/resume";

// ─── Module mocks (factory uses only inline jest.fn() — no external vars) ─────

jest.mock("@/lib/resumeStore", () => ({
  getResume: jest.fn(),
  saveResume: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  requireAdminSession: jest.fn(),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { GET, PUT } from "@/app/api/resume/route";
import { NextRequest } from "next/server";
import { getResume, saveResume } from "@/lib/resumeStore";
import { requireAdminSession } from "@/lib/auth";

// Typed references to the auto-mocked functions
const mockGetResume = jest.mocked(getResume);
const mockSaveResume = jest.mocked(saveResume);
const mockRequireAdminSession = jest.mocked(requireAdminSession);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validResume: Resume = {
  personalInfo: {
    name: "Test User",
    title: "Engineer",
    email: "test@example.com",
    phone: "555-0001",
    location: "NYC",
    linkedin: "https://linkedin.com/in/test",
    github: "https://github.com/test",
    summary: "A brief summary.",
  },
  experience: [],
  projects: [],
  skills: [],
  education: [],
};

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost/api/resume"), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ─── GET /api/resume ──────────────────────────────────────────────────────────

describe("GET /api/resume", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 200 with the resume JSON", async () => {
    mockGetResume.mockResolvedValueOnce(validResume);

    const response = await GET();
    const data = await response.json() as Resume;

    expect(response.status).toBe(200);
    expect(data.personalInfo.name).toBe("Test User");
    expect(data.experience).toEqual([]);
  });

  it("returns Cache-Control header on success", async () => {
    mockGetResume.mockResolvedValueOnce(validResume);

    const response = await GET();
    expect(response.headers.get("Cache-Control")).toMatch(/s-maxage/);
  });

  it("returns 500 when getResume throws", async () => {
    mockGetResume.mockRejectedValueOnce(new Error("disk error"));

    const response = await GET();
    const body = await response.json() as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toMatch(/failed/i);
  });

  it("calls getResume exactly once", async () => {
    mockGetResume.mockResolvedValueOnce(validResume);
    await GET();
    expect(mockGetResume).toHaveBeenCalledTimes(1);
  });
});

// ─── PUT /api/resume ──────────────────────────────────────────────────────────

describe("PUT /api/resume", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // By default, the session is valid (admin)
    mockRequireAdminSession.mockResolvedValue({ user: { id: "admin-1", name: "Admin", email: "a@b.com", role: "admin" as const }, expires: "2099-01-01" });
    mockSaveResume.mockResolvedValue(undefined);
  });

  it("returns 200 with { success: true } for valid resume data", async () => {
    mockGetResume.mockResolvedValueOnce(validResume);

    const req = makeRequest("PUT", validResume);
    const response = await PUT(req);
    const body = await response.json() as { success: boolean };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("calls saveResume with the validated data", async () => {
    const req = makeRequest("PUT", validResume);
    await PUT(req);

    expect(mockSaveResume).toHaveBeenCalledTimes(1);
    const saved = mockSaveResume.mock.calls[0][0] as Resume;
    expect(saved.personalInfo.name).toBe("Test User");
  });

  it("returns 401 when no admin session exists", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const req = makeRequest("PUT", validResume);
    const response = await PUT(req);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/unauthorized/i);
    expect(mockSaveResume).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-JSON body", async () => {
    const req = new NextRequest(new URL("http://localhost/api/resume"), {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: "this is not json{{{",
    });
    const response = await PUT(req);

    expect(response.status).toBe(400);
  });

  it("returns 422 when required Zod fields are missing", async () => {
    const badPayload = { personalInfo: { name: "" } }; // clearly invalid
    const req = makeRequest("PUT", badPayload);
    const response = await PUT(req);
    const body = await response.json() as { error: string; details: unknown };

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/validation/i);
    expect(body.details).toBeDefined();
  });

  it("returns 422 with Zod error details when email is malformed", async () => {
    const bad = { ...validResume, personalInfo: { ...validResume.personalInfo, email: "not-an-email" } };
    const req = makeRequest("PUT", bad);
    const response = await PUT(req);

    expect(response.status).toBe(422);
  });

  it("returns 500 when saveResume throws", async () => {
    mockSaveResume.mockRejectedValueOnce(new Error("IO error"));

    const req = makeRequest("PUT", validResume);
    const response = await PUT(req);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toMatch(/failed/i);
  });

  it("returns saved data inside response body", async () => {
    const req = makeRequest("PUT", validResume);
    const response = await PUT(req);
    const body = await response.json() as { success: boolean; data: Resume };

    expect(body.data).toBeDefined();
    expect(body.data.personalInfo.name).toBe("Test User");
  });
});
