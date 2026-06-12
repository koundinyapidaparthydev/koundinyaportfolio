/**
 * @jest-environment node
 */

jest.mock("@/lib/resumeStore", () => ({
  getResume: jest.fn(),
}));

jest.mock("@/lib/portfolioChat", () => ({
  buildPortfolioContext: jest.fn(() => '{"name":"Koundinya Pidaparthy"}'),
  generatePortfolioChatReply: jest.fn(),
}));

import { POST } from "@/app/api/chat/route";
import { NextRequest } from "next/server";
import { getResume } from "@/lib/resumeStore";
import { generatePortfolioChatReply } from "@/lib/portfolioChat";

const mockGetResume = jest.mocked(getResume);
const mockGenerate = jest.mocked(generatePortfolioChatReply);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost/api/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
    mockGetResume.mockResolvedValue({} as never);
    mockGenerate.mockResolvedValue("Koundinya is a full-stack engineer.");
  });

  afterAll(() => {
    process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns 422 for invalid payload", async () => {
    const res = await POST(makeRequest({ messages: [] }));
    expect(res.status).toBe(422);
  });

  it("returns 503 when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "What are his skills?" }],
      })
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/GEMINI_API_KEY/i);
  });

  it("returns assistant reply for a valid user message", async () => {
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "Tell me about his projects" }],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe("Koundinya is a full-stack engineer.");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("returns 422 when the last message is not from the user", async () => {
    const res = await POST(
      makeRequest({
        messages: [{ role: "assistant", content: "Hello" }],
      })
    );
    expect(res.status).toBe(422);
  });
});
