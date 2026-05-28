/**
 * @jest-environment node
 *
 * __tests__/app/api/contact/route.test.ts
 *
 * Tests for app/api/contact/route.ts (POST handler).
 * Mocks nodemailer so no real SMTP calls are made.
 */

// ─── Module mock (factory uses only inline jest.fn() — no external variables) ─

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
  createTransport: jest.fn(),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { POST } from "@/app/api/contact/route";
import { NextRequest } from "next/server";
import nodemailer from "nodemailer";

// Typed reference — safe because it comes AFTER import
const mockCreateTransport = nodemailer.createTransport as jest.Mock;
let mockSendMail: jest.Mock = jest.fn();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost/api/contact"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "Jane Doe",
  email: "jane@example.com",
  message: "Hello, this is a test message that is long enough.",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/contact", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail = jest.fn().mockResolvedValue({ messageId: "mock-id" });
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it("returns 200 { success: true } for a valid message", async () => {
    const req = makeRequest(validBody);
    const response = await POST(req);
    const body = await response.json() as { success: boolean };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("calls nodemailer.createTransport once", async () => {
    await POST(makeRequest(validBody));
    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
  });

  it("sends mail to the portfolio owner address", async () => {
    await POST(makeRequest(validBody));
    const callArg = mockSendMail.mock.calls[0][0] as { to: string };
    expect(callArg.to).toBe("koundinyapidaparthy@gmail.com");
  });

  it("sets replyTo to the sender's email", async () => {
    await POST(makeRequest(validBody));
    const callArg = mockSendMail.mock.calls[0][0] as { replyTo: string };
    expect(callArg.replyTo).toBe("jane@example.com");
  });

  it("uses a custom subject when provided", async () => {
    const req = makeRequest({ ...validBody, subject: "Job opportunity" });
    await POST(req);
    const callArg = mockSendMail.mock.calls[0][0] as { subject: string };
    expect(callArg.subject).toContain("Job opportunity");
  });

  it("defaults subject to 'Message from {name}' when omitted", async () => {
    await POST(makeRequest(validBody));
    const callArg = mockSendMail.mock.calls[0][0] as { subject: string };
    expect(callArg.subject).toContain("Message from Jane Doe");
  });

  it("includes sender's name in the email HTML body", async () => {
    await POST(makeRequest(validBody));
    const callArg = mockSendMail.mock.calls[0][0] as { html: string };
    expect(callArg.html).toContain("Jane Doe");
  });

  it("uses SMTP_* env vars when creating the transporter", async () => {
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "user@test.com";
    await POST(makeRequest(validBody));
    const callArg = (mockCreateTransport.mock.calls[0] as unknown[])[0] as {
      host: string;
      port: number;
      auth: { user: string };
    };
    expect(callArg.host).toBe("smtp.test.com");
    expect(callArg.port).toBe(465);
    expect(callArg.auth.user).toBe("user@test.com");
    // Cleanup
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
  });

  // ── Validation errors (400) ─────────────────────────────────────────────────

  it("returns 400 when name is shorter than 2 characters", async () => {
    const req = makeRequest({ ...validBody, name: "A" });
    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("returns 400 when email is invalid", async () => {
    const req = makeRequest({ ...validBody, email: "not-an-email" });
    const response = await POST(req);
    const body = await response.json() as { error: Record<string, unknown> };

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("returns 400 when message is shorter than 10 characters", async () => {
    const req = makeRequest({ ...validBody, message: "Too short" });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const req = makeRequest({ name: "Only Name" });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it("returns 400 validation error obj with fieldErrors shape", async () => {
    const req = makeRequest({ ...validBody, email: "bad" });
    const response = await POST(req);
    const body = await response.json() as { error: { email?: string[] } };

    expect(body.error.email).toBeDefined();
  });

  it("accepts an optional subject of length ≥ 2", async () => {
    const req = makeRequest({ ...validBody, subject: "Hi" });
    const response = await POST(req);
    expect(response.status).toBe(200);
  });

  it("rejects an optional subject shorter than 2 characters", async () => {
    const req = makeRequest({ ...validBody, subject: "X" });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  // ── Server error (500) ──────────────────────────────────────────────────────

  it("returns 500 when sendMail throws", async () => {
    mockSendMail.mockRejectedValueOnce(new Error("SMTP connection refused"));

    const req = makeRequest(validBody);
    const response = await POST(req);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toMatch(/failed/i);
  });

  it("does not leak error details in the 500 response", async () => {
    mockSendMail.mockRejectedValueOnce(new Error("internal secret"));
    const response = await POST(makeRequest(validBody));
    const body = await response.json() as { error: string };

    expect(body.error).not.toContain("internal secret");
  });
});
