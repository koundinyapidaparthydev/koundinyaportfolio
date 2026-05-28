/**
 * @jest-environment node
 *
 * __tests__/lib/emailNotification.test.ts
 *
 * Tests for lib/emailNotification.ts  (sendVisitorNotification).
 * nodemailer's `createTransport` is fully mocked so no real SMTP calls occur.
 */

// ─── Module mock (factory uses only inline jest.fn() — no external variables) ─

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
  createTransport: jest.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import nodemailer from "nodemailer";
import { sendVisitorNotification } from "@/lib/emailNotification";
import type { VisitorInfo } from "@/lib/emailNotification";

// Typed references — safe because they come AFTER imports
const mockCreateTransport = nodemailer.createTransport as jest.Mock;
let mockSendMail: jest.Mock = jest.fn();

// Mock global fetch used for ip-api.com geo lookup
const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseInfo: VisitorInfo = {
  ip: "8.8.8.8",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  timestamp: "2024-01-15T14:30:00.000Z",
};

const geoSuccess = {
  status: "success",
  city: "Mountain View",
  regionName: "California",
  country: "United States",
};

function makeGeoResponse(data: object, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(data),
  } as Response;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("sendVisitorNotification", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      EMAIL_FROM: "from@example.com",
      EMAIL_PASSWORD: "secret",
    };
    // Recreate sendMail mock and wire up createTransport to return it
    mockSendMail = jest.fn().mockResolvedValue({ messageId: "test-id" });
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── Credential guard ────────────────────────────────────────────────────────

  it("does nothing (no email sent) when EMAIL_PASSWORD is not set", async () => {
    delete process.env.EMAIL_PASSWORD;
    mockFetch.mockResolvedValue(makeGeoResponse(geoSuccess));

    await sendVisitorNotification(baseInfo);

    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  // ── Transport creation ──────────────────────────────────────────────────────

  it("creates a Gmail transporter with the correct credentials", async () => {
    mockFetch.mockResolvedValue(makeGeoResponse(geoSuccess));

    await sendVisitorNotification(baseInfo);

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        service: "gmail",
        auth: expect.objectContaining({
          user: "from@example.com",
          pass: "secret",
        }),
      })
    );
  });

  // ── sendMail call ───────────────────────────────────────────────────────────

  it("calls sendMail with the correct recipient", async () => {
    mockFetch.mockResolvedValue(makeGeoResponse(geoSuccess));

    await sendVisitorNotification(baseInfo);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const args = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    expect(args.to).toBe("koundinyapidaparthy@gmail.com");
  });

  it("calls sendMail with a subject containing the formatted timestamp", async () => {
    mockFetch.mockResolvedValue(makeGeoResponse(geoSuccess));

    await sendVisitorNotification(baseInfo);

    const args = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof args.subject).toBe("string");
    expect(args.subject).toMatch(/visitor/i);
  });

  it("includes IP address in the email HTML body", async () => {
    mockFetch.mockResolvedValue(makeGeoResponse(geoSuccess));

    await sendVisitorNotification(baseInfo);

    const args = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    expect((args.html as string)).toContain(baseInfo.ip);
  });

  it("includes geo location in the email HTML body", async () => {
    mockFetch.mockResolvedValue(makeGeoResponse(geoSuccess));

    await sendVisitorNotification(baseInfo);

    const args = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    expect((args.html as string)).toContain("Mountain View");
  });

  it("labels device as Desktop for a desktop user-agent", async () => {
    mockFetch.mockResolvedValue(makeGeoResponse(geoSuccess));

    await sendVisitorNotification(baseInfo); // baseInfo has desktop UA

    const args = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    expect((args.html as string)).toContain("Desktop");
  });

  it("labels device as Mobile for a mobile user-agent", async () => {
    mockFetch.mockResolvedValue(makeGeoResponse(geoSuccess));

    await sendVisitorNotification({
      ...baseInfo,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
    });

    const args = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    expect((args.html as string)).toContain("Mobile");
  });

  it("labels device as Tablet for an iPad user-agent", async () => {
    mockFetch.mockResolvedValue(makeGeoResponse(geoSuccess));

    await sendVisitorNotification({
      ...baseInfo,
      userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)",
    });

    const args = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    expect((args.html as string)).toContain("Tablet");
  });

  // ── Private / local IPs bypass geo lookup ──────────────────────────────────

  it("skips geo fetch for localhost (127.x.x.x)", async () => {
    await sendVisitorNotification({ ...baseInfo, ip: "127.0.0.1" });

    expect(mockFetch).not.toHaveBeenCalled();
    const args = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    expect((args.html as string)).toContain("Local / Private Network");
  });

  it("skips geo fetch for private 192.168.x.x range", async () => {
    await sendVisitorNotification({ ...baseInfo, ip: "192.168.1.1" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips geo fetch for private 10.x.x.x range", async () => {
    await sendVisitorNotification({ ...baseInfo, ip: "10.0.0.5" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips geo fetch for IPv6 loopback ::1", async () => {
    await sendVisitorNotification({ ...baseInfo, ip: "::1" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Geo lookup failure fallbacks ────────────────────────────────────────────

  it("falls back to 'Unknown' when geo API returns a non-ok response", async () => {
    mockFetch.mockResolvedValue(makeGeoResponse({}, false)); // ok: false

    await sendVisitorNotification(baseInfo);

    const args = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    expect((args.html as string)).toContain("Unknown");
  });

  it("falls back to 'Unknown' when geo API returns status:fail", async () => {
    mockFetch.mockResolvedValue(makeGeoResponse({ status: "fail" }));

    await sendVisitorNotification(baseInfo);

    const args = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    expect((args.html as string)).toContain("Unknown");
  });

  it("falls back to 'Unknown' when fetch throws a network error", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    await sendVisitorNotification(baseInfo);

    const args = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
    expect((args.html as string)).toContain("Unknown");
  });

  // ── sendMail errors are swallowed ───────────────────────────────────────────

  it("does NOT throw when sendMail rejects (failure is silenced)", async () => {
    mockFetch.mockResolvedValue(makeGeoResponse(geoSuccess));
    mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

    // Should resolve fine without propagating the error
    await expect(sendVisitorNotification(baseInfo)).resolves.toBeUndefined();
  });

  // ── Default email from env fallback ────────────────────────────────────────

  it("uses koundinyapidaparthy@gmail.com as default from when EMAIL_FROM not set", async () => {
    delete process.env.EMAIL_FROM;
    mockFetch.mockResolvedValue(makeGeoResponse(geoSuccess));

    await sendVisitorNotification(baseInfo);

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({
          user: "koundinyapidaparthy@gmail.com",
        }),
      })
    );
  });
});
