/**
 * Time-filter logic mirrored from CompaniesTab.tsx
 */

type TimeFilter = "30m" | "2h" | "12h" | "1d" | "2d";

interface Job {
  fetchedAt: string;
}

const NEW_JOB_WINDOW_MS = 30 * 60_000;

const TIME_FILTERS: { id: TimeFilter; label: string; ms: number }[] = [
  { id: "30m", label: "⚡ Last 30 mins", ms: NEW_JOB_WINDOW_MS },
  { id: "2h", label: "Last 2 hrs", ms: 2 * 3_600_000 },
  { id: "12h", label: "Last 12 hrs", ms: 12 * 3_600_000 },
  { id: "1d", label: "Last 24 hrs", ms: 24 * 3_600_000 },
  { id: "2d", label: "Last 48 hrs", ms: 48 * 3_600_000 },
];

function filterByTime(jobs: Job[], filter: TimeFilter, now = Date.now()): Job[] {
  const { ms } = TIME_FILTERS.find((f) => f.id === filter)!;
  return jobs.filter(
    (j) => j.fetchedAt && now - new Date(j.fetchedAt).getTime() <= ms
  );
}

function buildLastSeenUpdates(
  sheetUrls: string[],
  scrapedUrls: Set<string>,
  timestamp: string
) {
  return sheetUrls
    .map((url, idx) => ({ url, sheetRow: idx + 2 }))
    .filter(({ url }) => url && scrapedUrls.has(url))
    .map(({ sheetRow }) => ({
      range: `Jobs!F${sheetRow}`,
      values: [[timestamp]],
    }));
}

describe("CompaniesTab time filters", () => {
  const now = Date.parse("2026-06-06T12:00:00.000Z");

  it("includes 30m as the first filter option", () => {
    expect(TIME_FILTERS[0]).toEqual({
      id: "30m",
      label: "⚡ Last 30 mins",
      ms: 30 * 60_000,
    });
  });

  it("30m filter keeps jobs seen within 30 minutes", () => {
    const jobs: Job[] = [
      { fetchedAt: new Date(now - 20 * 60_000).toISOString() },
      { fetchedAt: new Date(now - 45 * 60_000).toISOString() },
    ];
    expect(filterByTime(jobs, "30m", now)).toHaveLength(1);
  });

  it("2h filter is wider than 30m", () => {
    const jobs: Job[] = [
      { fetchedAt: new Date(now - 90 * 60_000).toISOString() },
    ];
    expect(filterByTime(jobs, "30m", now)).toHaveLength(0);
    expect(filterByTime(jobs, "2h", now)).toHaveLength(1);
  });
});

describe("refreshLastSeenAt row selection", () => {
  it("updates fetchedAt only for URLs still on the board", () => {
    const scraped = new Set([
      "https://example.com/a",
      "https://example.com/c",
    ]);
    const updates = buildLastSeenUpdates(
      ["https://example.com/a", "https://example.com/b", "https://example.com/c"],
      scraped,
      "2026-06-06T12:00:00.000Z"
    );
    expect(updates).toEqual([
      { range: "Jobs!F2", values: [["2026-06-06T12:00:00.000Z"]] },
      { range: "Jobs!F4", values: [["2026-06-06T12:00:00.000Z"]] },
    ]);
  });
});
