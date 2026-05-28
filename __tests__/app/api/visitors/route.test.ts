/**
 * @jest-environment node
 */

const mockRequireAdminSession = jest.fn();
const mockGetVisitors = jest.fn();

jest.mock("@/lib/auth", () => ({
  requireAdminSession: () => mockRequireAdminSession(),
}));

jest.mock("@/lib/visitorStore", () => ({
  getVisitors: () => mockGetVisitors(),
}));

import { GET } from "@/app/api/visitors/route";

const sampleVisitors = [
  {
    id: "1",
    timestamp: "2026-05-26T10:00:00.000Z",
    ip: "1.2.3.4",
    userAgent: "Chrome/120",
    device: "Desktop" as const,
    page: "/",
  },
  {
    id: "2",
    timestamp: "2026-05-26T09:00:00.000Z",
    ip: "5.6.7.8",
    userAgent: "Mobile Safari",
    device: "Mobile" as const,
    page: "/projects",
  },
];

describe("GET /api/visitors", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when there is no admin session", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns visitor array when admin session is present", async () => {
    mockRequireAdminSession.mockResolvedValueOnce({ user: { role: "admin" } });
    mockGetVisitors.mockResolvedValueOnce(sampleVisitors);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as typeof sampleVisitors;
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe("1");
  });

  it("returns an empty array when there are no visitors", async () => {
    mockRequireAdminSession.mockResolvedValueOnce({ user: { role: "admin" } });
    mockGetVisitors.mockResolvedValueOnce([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toEqual([]);
  });
});
