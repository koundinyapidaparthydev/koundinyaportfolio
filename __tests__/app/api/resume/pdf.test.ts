/**
 * @jest-environment node
 *
 * Tests for GET /api/resume/pdf — dynamic generation from data/resume.json
 */

jest.mock("@/lib/resumeStore", () => ({
  getResume: jest.fn(),
}));

jest.mock("@react-pdf/renderer", () => ({
  renderToBuffer: jest.fn(),
}));

jest.mock("@/lib/resumePdf", () => ({
  ResumePdfDocument: jest.fn().mockReturnValue(null),
}));

import { GET } from "@/app/api/resume/pdf/route";
import { getResume } from "@/lib/resumeStore";
import { renderToBuffer } from "@react-pdf/renderer";

const mockGetResume = jest.mocked(getResume);
const mockRenderToBuffer = jest.mocked(renderToBuffer);

const VALID_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
  "ascii"
);

const SAMPLE_RESUME = {
  personalInfo: {
    name: "Koundinya Pidaparthy",
    title: "Full Stack Software Engineer",
    email: "test@example.com",
    phone: "555-0000",
    location: "New York, NY",
    linkedin: "linkedin.com/in/test",
    github: "github.com/test",
    summary: "Engineer summary.",
  },
  experience: [],
  projects: [],
  skills: [],
  education: [],
};

describe("GET /api/resume/pdf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetResume.mockResolvedValue(SAMPLE_RESUME as never);
    mockRenderToBuffer.mockResolvedValue(VALID_PDF_BYTES as never);
  });

  it("returns 200 with application/pdf", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("sets Content-Disposition with download filename", async () => {
    const res = await GET();
    const cd = res.headers.get("Content-Disposition") ?? "";
    expect(cd).toContain("attachment");
    expect(cd).toContain("Koundinya_Pidaparthy_resume.pdf");
  });

  it("returns valid PDF magic bytes", async () => {
    const res = await GET();
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("loads resume from store and renders PDF", async () => {
    await GET();
    expect(mockGetResume).toHaveBeenCalledTimes(1);
    expect(mockRenderToBuffer).toHaveBeenCalledTimes(1);
  });

  it("returns 404 JSON when resume load fails", async () => {
    mockGetResume.mockRejectedValueOnce(new Error("ENOENT"));
    const res = await GET();
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });
});
