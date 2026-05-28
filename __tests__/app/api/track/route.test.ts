/**
 * @jest-environment node
 */

const mockAppendVisitor = jest.fn().mockResolvedValue(undefined);
const mockSendVisitorNotification = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/visitorStore", () => ({
  appendVisitor: (...args: unknown[]) => mockAppendVisitor(...args),
}));

jest.mock("@/lib/emailNotification", () => ({
  sendVisitorNotification: (...args: unknown[]) =>
    mockSendVisitorNotification(...args),
}));

import { POST } from "@/app/api/track/route";
import { NextRequest } from "next/server";

function makeRequest(
  headers: Record<string, string> = {},
  body?: string
): NextRequest {
  return new NextRequest("http://localhost:3000/api/track", {
    method: "POST",
    headers,
    body: body ?? null,
  });
}

describe("POST /api/track", () => {
  beforeEach(() => jest.clearAllMocks());

  it("always returns 200 with { ok: true }", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("extracts IP from x-forwarded-for (uses first address)", async () => {
    await POST(makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }));
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "1.2.3.4" })
    );
  });

  it("extracts IP from cf-connecting-ip when x-forwarded-for is absent", async () => {
    await POST(makeRequest({ "cf-connecting-ip": "9.8.7.6" }));
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "9.8.7.6" })
    );
  });

  it("extracts IP from x-real-ip as last resort", async () => {
    await POST(makeRequest({ "x-real-ip": "3.3.3.3" }));
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "3.3.3.3" })
    );
  });

  it("falls back to 'Unknown' when no IP header is present", async () => {
    await POST(makeRequest());
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "Unknown" })
    );
  });

  it("parses the page field from the JSON body", async () => {
    await POST(
      makeRequest(
        { "content-type": "application/json" },
        JSON.stringify({ page: "/projects" })
      )
    );
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ page: "/projects" })
    );
  });

  it("defaults page to '/' when body is absent", async () => {
    await POST(makeRequest());
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ page: "/" })
    );
  });

  it("calls appendVisitor exactly once per request", async () => {
    await POST(makeRequest());
    // Fire-and-forget but the mock is synchronous — verify it was called
    expect(mockAppendVisitor).toHaveBeenCalledTimes(1);
  });

  it("calls sendVisitorNotification exactly once per request", async () => {
    await POST(makeRequest());
    expect(mockSendVisitorNotification).toHaveBeenCalledTimes(1);
  });

  // ── Extended tests ────────────────────────────────────────────────────────

  it("extracts referrer from request body", async () => {
    await POST(
      makeRequest(
        { "content-type": "application/json" },
        JSON.stringify({ referrer: "https://github.com" })
      )
    );
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ referrer: "https://github.com" })
    );
  });

  it("extracts language from request body", async () => {
    await POST(
      makeRequest(
        { "content-type": "application/json" },
        JSON.stringify({ language: "fr-FR" })
      )
    );
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ language: "fr-FR" })
    );
  });

  it("extracts screen from request body", async () => {
    await POST(
      makeRequest(
        { "content-type": "application/json" },
        JSON.stringify({ screen: "2560x1440" })
      )
    );
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ screen: "2560x1440" })
    );
  });

  it("extracts timezone from request body", async () => {
    await POST(
      makeRequest(
        { "content-type": "application/json" },
        JSON.stringify({ timezone: "Europe/Paris" })
      )
    );
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: "Europe/Paris" })
    );
  });

  it("extracts country from cf-ipcountry header", async () => {
    await POST(makeRequest({ "cf-ipcountry": "DE" }));
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ country: "DE" })
    );
  });

  it("extracts country from x-vercel-ip-country when cf-ipcountry is absent", async () => {
    await POST(makeRequest({ "x-vercel-ip-country": "JP" }));
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ country: "JP" })
    );
  });

  it("extracts city from x-vercel-ip-city header", async () => {
    await POST(makeRequest({ "x-vercel-ip-city": "Berlin" }));
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ city: "Berlin" })
    );
  });

  it("falls back language to accept-language header when body language is absent", async () => {
    await POST(makeRequest({ "accept-language": "es-ES,es;q=0.9" }));
    expect(mockAppendVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ language: "es-ES" })
    );
  });
});
