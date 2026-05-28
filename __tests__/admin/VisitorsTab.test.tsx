import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { VisitorEntry } from "@/lib/visitorStore";

const mockUseQuery = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

import VisitorsTab from "@/app/admin/_components/VisitorsTab";

function makeVisitor(n: number): VisitorEntry {
  return {
    id: String(n),
    timestamp: new Date(Date.now() - n * 60_000).toISOString(),
    ip: `10.0.${Math.floor(n / 256)}.${n % 256}`,
    userAgent: "Mozilla/5.0 Chrome/120",
    device: n % 3 === 0 ? "Mobile" : n % 3 === 1 ? "Tablet" : "Desktop",
    page: n % 2 === 0 ? "/" : "/projects",
    browser: "Chrome",
    os: "macOS",
    country: "US",
    referrer: "https://google.com",
    language: "en-US",
    screen: "1920x1080",
    timezone: "America/New_York",
  };
}

function mockQuery(overrides: Record<string, unknown>) {
  mockUseQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    ...overrides,
  });
}

describe("VisitorsTab", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows a loading spinner when data is loading", () => {
    mockQuery({ isLoading: true });
    const { container } = render(<VisitorsTab />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("shows an error message when the query fails", () => {
    mockQuery({ isError: true });
    render(<VisitorsTab />);
    expect(screen.getByText(/failed to load visitor data/i)).toBeTruthy();
  });

  it("shows 'No visitors recorded yet.' when the list is empty", () => {
    mockQuery({ data: [] });
    render(<VisitorsTab />);
    expect(screen.getByText(/no visitors recorded yet/i)).toBeTruthy();
  });

  it("renders a table row for each visitor on the first page (≤25)", () => {
    const visitors = Array.from({ length: 5 }, (_, i) => makeVisitor(i));
    mockQuery({ data: visitors });
    render(<VisitorsTab />);
    // Each row shows the IP — all 5 should be present
    visitors.forEach((v) => {
      expect(screen.getByText(v.ip)).toBeTruthy();
    });
  });

  it("does NOT show pagination buttons when there are 25 or fewer visitors", () => {
    mockQuery({ data: Array.from({ length: 25 }, (_, i) => makeVisitor(i)) });
    render(<VisitorsTab />);
    expect(screen.queryByRole("button", { name: /next/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /previous/i })).toBeNull();
  });

  it("shows pagination buttons when there are more than 25 visitors", () => {
    mockQuery({ data: Array.from({ length: 30 }, (_, i) => makeVisitor(i)) });
    render(<VisitorsTab />);
    // Both Next and Previous buttons should be present
    expect(screen.getByRole("button", { name: /next/i })).toBeTruthy();
  });

  it("shows the next page after clicking Next", () => {
    const visitors = Array.from({ length: 30 }, (_, i) => makeVisitor(i));
    mockQuery({ data: visitors });
    render(<VisitorsTab />);
    // First page shows visitor 0
    expect(screen.getByText(visitors[0].ip)).toBeTruthy();
    // Click Next
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    // Page 2 shows visitor 25
    expect(screen.getByText(visitors[25].ip)).toBeTruthy();
  });

  // ── Extended tests ────────────────────────────────────────────────────────

  it("renders the Export CSV button", () => {
    mockQuery({ data: Array.from({ length: 3 }, (_, i) => makeVisitor(i)) });
    render(<VisitorsTab />);
    expect(screen.getByRole("button", { name: /export csv/i })).toBeTruthy();
  });

  it("renders the Refresh button", () => {
    mockQuery({ data: Array.from({ length: 3 }, (_, i) => makeVisitor(i)) });
    render(<VisitorsTab />);
    expect(screen.getByRole("button", { name: /refresh/i })).toBeTruthy();
  });

  it("renders a search input with placeholder text", () => {
    mockQuery({ data: Array.from({ length: 3 }, (_, i) => makeVisitor(i)) });
    render(<VisitorsTab />);
    const input = document.querySelector<HTMLInputElement>("input[type='search']");
    expect(input).toBeTruthy();
    expect(input?.placeholder).toMatch(/filter/i);
  });

  it("renders the Timestamp column header in the table", () => {
    mockQuery({ data: Array.from({ length: 3 }, (_, i) => makeVisitor(i)) });
    render(<VisitorsTab />);
    expect(screen.getByText("Timestamp")).toBeTruthy();
  });

  it("renders the Browser column header in the table", () => {
    mockQuery({ data: Array.from({ length: 3 }, (_, i) => makeVisitor(i)) });
    render(<VisitorsTab />);
    expect(screen.getByText("Browser")).toBeTruthy();
  });

  it("renders the OS column header in the table", () => {
    mockQuery({ data: Array.from({ length: 3 }, (_, i) => makeVisitor(i)) });
    render(<VisitorsTab />);
    expect(screen.getByText("OS")).toBeTruthy();
  });

  it("renders the Country column header in the table", () => {
    mockQuery({ data: Array.from({ length: 3 }, (_, i) => makeVisitor(i)) });
    render(<VisitorsTab />);
    expect(screen.getByText("Country")).toBeTruthy();
  });

  it("renders the Referrer column header in the table", () => {
    mockQuery({ data: Array.from({ length: 3 }, (_, i) => makeVisitor(i)) });
    render(<VisitorsTab />);
    expect(screen.getByText("Referrer")).toBeTruthy();
  });

  it("filtering by IP shows only matching rows", () => {
    const v0 = makeVisitor(0); // ip = 10.0.0.0
    const v1 = makeVisitor(1); // ip = 10.0.0.1
    mockQuery({ data: [v0, v1] });
    render(<VisitorsTab />);
    const input = document.querySelector<HTMLInputElement>("input[type='search']")!;
    fireEvent.change(input, { target: { value: v0.ip } });
    // v0's IP still in DOM
    expect(screen.getByText(v0.ip)).toBeTruthy();
    // v1's IP no longer visible
    expect(screen.queryByText(v1.ip)).toBeNull();
  });

  it("shows 'No results for...' message when filter matches nothing", () => {
    mockQuery({ data: Array.from({ length: 3 }, (_, i) => makeVisitor(i)) });
    render(<VisitorsTab />);
    const input = document.querySelector<HTMLInputElement>("input[type='search']")!;
    fireEvent.change(input, { target: { value: "255.255.255.255" } });
    expect(screen.getByText(/no results for/i)).toBeTruthy();
  });

  it("shows '# of # visits' count label when filter is active", () => {
    const visitors = Array.from({ length: 5 }, (_, i) => makeVisitor(i));
    mockQuery({ data: visitors });
    render(<VisitorsTab />);
    const input = document.querySelector<HTMLInputElement>("input[type='search']")!;
    // Filter to only "/" pages — all even-indexed visitors
    fireEvent.change(input, { target: { value: "projects" } });
    // Only odd-indexed visitors have page "/projects" → 2 of 5 match
    expect(screen.getByText(/of \d+ visit/i)).toBeTruthy();
  });

  it("clicking Refresh calls refetch", () => {
    const mockRefetch = jest.fn();
    mockUseQuery.mockReturnValue({
      data: Array.from({ length: 2 }, (_, i) => makeVisitor(i)),
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    render(<VisitorsTab />);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(mockRefetch).toHaveBeenCalled();
  });
});
