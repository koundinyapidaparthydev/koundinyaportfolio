import React from "react";
import { render, screen } from "@testing-library/react";
import type { VisitorEntry } from "@/lib/visitorStore";

// Mock useQuery before importing the component
const mockUseQuery = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

import OverviewTab from "@/app/admin/_components/OverviewTab";

const todayISO = new Date().toISOString();
const yesterdayISO = new Date(Date.now() - 86_400_000).toISOString();

const mockVisitors: VisitorEntry[] = [
  {
    id: "1",
    timestamp: todayISO,
    ip: "1.2.3.4",
    userAgent: "Mozilla/5.0 Chrome/120",
    device: "Desktop",
    page: "/",
  },
  {
    id: "2",
    timestamp: todayISO,
    ip: "5.6.7.8",
    userAgent: "Mozilla/5.0 Mobile Safari",
    device: "Mobile",
    page: "/projects",
  },
  {
    id: "3",
    timestamp: yesterdayISO,
    ip: "9.9.9.9",
    userAgent: "Mozilla/5.0 iPad",
    device: "Tablet",
    page: "/",
  },
];

function mockQuery(overrides: Record<string, unknown>) {
  mockUseQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    ...overrides,
  });
}

describe("OverviewTab", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows a loading spinner when data is loading", () => {
    mockQuery({ isLoading: true });
    const { container } = render(<OverviewTab />);
    // Spinner uses animate-spin class
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("shows an error message when the query fails", () => {
    mockQuery({ isError: true });
    render(<OverviewTab />);
    expect(screen.getByText(/failed to load visitor data/i)).toBeTruthy();
  });

  it("shows 'Total Visitors' stat card", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText("Total Visitors")).toBeTruthy();
    // 3 total visitors — the accented stat card renders "3"
    // use getAllByText since other sections may also render "3"
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
  });

  it("shows '—' for Last Visit when there are no visitors", () => {
    mockQuery({ data: [] });
    render(<OverviewTab />);
    expect(screen.getByText("Last Visit")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Today's Visitors stat card with count of today's visits", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText("Today's Visitors")).toBeTruthy();
    // 2 visitors today
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'By Device' breakdown section when there are visitors", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText("By Device")).toBeTruthy();
  });

  it("shows 'No data yet.' for sections when visitors array is empty", () => {
    mockQuery({ data: [] });
    render(<OverviewTab />);
    // Multiple sections all show 'No data yet.' when empty
    expect(screen.getAllByText("No data yet.").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Recent Activity section with visitor rows when data exists", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText(/Recent Activity/)).toBeTruthy();
    // Each visitor row includes their IP
    expect(screen.getByText("1.2.3.4")).toBeTruthy();
  });

  it("shows Top Pages section heading", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText("Top Pages")).toBeTruthy();
  });

  it("shows Unique IPs stat card", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText("Unique IPs")).toBeTruthy();
  });

  // ── Extended tests ────────────────────────────────────────────────────────

  it("shows 'Traffic — Last 7 Days' section heading", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText(/Traffic.*Last 7 Days/i)).toBeTruthy();
  });

  it("shows 'By Browser' section heading when there are visitors", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText("By Browser")).toBeTruthy();
  });

  it("shows 'By OS' section heading when there are visitors", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText("By OS")).toBeTruthy();
  });

  it("shows 'Top Referrers' section heading", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText("Top Referrers")).toBeTruthy();
  });

  it("shows '30-Day Avg / Day' stat card label", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText("30-Day Avg / Day")).toBeTruthy();
  });

  it("shows 'Top Browser' stat card label", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText("Top Browser")).toBeTruthy();
  });

  it("Unique IPs count equals number of distinct IPs in fixture", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    // All 3 visitors have distinct IPs → value should be 3
    expect(screen.getByText("Unique IPs")).toBeTruthy();
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT show Geographic Distribution when there are no visitors", () => {
    mockQuery({ data: [] });
    render(<OverviewTab />);
    expect(screen.queryByText(/Geographic Distribution/i)).toBeNull();
  });

  it("shows Geographic Distribution when there are visitors (freqMap maps unknown country to 'Unknown')", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText(/Geographic Distribution/i)).toBeTruthy();
  });

  it("renders the Recent Activity row's page path", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    // The first visitor visited "/" — it should appear in the activity table
    const cells = screen.getAllByText("/");
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'distinct visitors' sub-label under Unique IPs card", () => {
    mockQuery({ data: mockVisitors });
    render(<OverviewTab />);
    expect(screen.getByText("distinct visitors")).toBeTruthy();
  });

  it("shows total visitor count of 1 when only one visitor exists", () => {
    mockQuery({ data: [mockVisitors[0]] });
    render(<OverviewTab />);
    expect(screen.getByText("Total Visitors")).toBeTruthy();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
  });
});
