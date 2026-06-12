/**
 * @jest-environment node
 *
 * Tests for scripts/lib/hiring-cafe.mjs (pure helpers).
 */

import {
  APPLY_NOW_WINDOW_MS,
  HC_DEPARTMENTS,
  buildHiringCafeSearchState,
  buildHiringCafeSearchUrl,
  dedupeHcRows,
  getHcApplyUrl,
  getHcJobId,
  getJobDedupKey,
  parseHcItemToRow,
  partitionRowsByFetchedAt,
  extractHcItemsFromPayload,
} from "../../scripts/lib/hiring-cafe.mjs";

describe("buildHiringCafeSearchState", () => {
  it("uses department-based engineering search", () => {
    const state = buildHiringCafeSearchState();
    expect(state.departments).toEqual(HC_DEPARTMENTS);
    expect(state.sortBy).toBe("date");
    expect(state.dateFetchedPastNDays).toBe(2);
    expect(state).not.toHaveProperty("applicationFormEase");
  });

  it("builds a hiring.cafe URL with encoded searchState", () => {
    const url = buildHiringCafeSearchUrl();
    expect(url).toMatch(/^https:\/\/hiring\.cafe\/\?searchState=/);
    const encoded = url.split("searchState=")[1];
    const parsed = JSON.parse(decodeURIComponent(encoded));
    expect(parsed.departments).toEqual(HC_DEPARTMENTS);
  });
});

describe("getHcApplyUrl", () => {
  it("prefers real apply URL over hiring.cafe job link", () => {
    expect(
      getHcApplyUrl({
        objectID: "abc12345",
        hc_apply_url: "https://boards.greenhouse.io/acme/jobs/1",
      })
    ).toBe("https://boards.greenhouse.io/acme/jobs/1");
  });

  it("falls back to hiring.cafe job URL when no external apply link", () => {
    expect(getHcApplyUrl({ objectID: "abc12345" })).toBe(
      "https://hiring.cafe/job/abc12345"
    );
  });
});

describe("getHcJobId / getJobDedupKey", () => {
  it("extracts id from hiring.cafe job URL", () => {
    expect(getHcJobId("https://hiring.cafe/job/Ab12Cd34")).toBe("Ab12Cd34");
  });

  it("dedup key uses hc: prefix for HC job ids", () => {
    const row = ["Co", "Title", "Loc", "https://hiring.cafe/job/xyz98765", "hiring-cafe"];
    expect(getJobDedupKey(row)).toBe("hc:xyz98765");
  });
});

describe("parseHcItemToRow", () => {
  const fetchedAt = "2026-06-12T10:00:00.000Z";

  it("maps v5 schema fields to scrape row", () => {
    const row = parseHcItemToRow(
      {
        objectID: "jobid123",
        hc_title: "Senior Software Engineer",
        v5_processed_job_data: {
          company_name: "Stripe",
          formatted_workplace_location: "Remote, US",
          requirements_summary: "Build payments APIs",
          yearly_min_compensation: 180000,
          yearly_max_compensation: 220000,
        },
        hc_apply_url: "https://boards.greenhouse.io/stripe/jobs/1",
        posted_at: "2026-06-10T00:00:00.000Z",
      },
      fetchedAt
    );
    expect(row).not.toBeNull();
    expect(row![0]).toBe("Stripe");
    expect(row![1]).toBe("Senior Software Engineer");
    expect(row![3]).toBe("https://boards.greenhouse.io/stripe/jobs/1");
    expect(row![5]).toBe(fetchedAt);
    expect(row![6]).toBe("2026-06-10T00:00:00.000Z");
    expect(row![7]).toContain("Build payments APIs");
  });
});

describe("dedupeHcRows", () => {
  it("removes duplicates by apply URL / HC id", () => {
    const rows = [
      ["A", "Eng", "", "https://hiring.cafe/job/abc12345", "hiring-cafe"],
      ["B", "Eng", "", "https://boards.greenhouse.io/x/jobs/1", "hiring-cafe"],
      ["C", "Eng", "", "https://hiring.cafe/job/abc12345", "hiring-cafe"],
    ];
    expect(dedupeHcRows(rows)).toHaveLength(2);
  });
});

describe("partitionRowsByFetchedAt", () => {
  const now = Date.parse("2026-06-12T12:00:00.000Z");

  it("archives rows older than apply-now window", () => {
    const rows = [
      ["A", "t", "", "u1", "c", new Date(now - 2 * 60 * 60_000).toISOString()],
      ["B", "t", "", "u2", "c", new Date(now - 8 * 60 * 60_000).toISOString()],
    ];
    const { keep, archive } = partitionRowsByFetchedAt(rows, APPLY_NOW_WINDOW_MS, now);
    expect(keep).toHaveLength(1);
    expect(archive).toHaveLength(1);
    expect(keep[0][3]).toBe("u1");
    expect(archive[0][3]).toBe("u2");
  });

  it("uses 6 hour default window constant", () => {
    expect(APPLY_NOW_WINDOW_MS).toBe(6 * 60 * 60_000);
  });
});

describe("extractHcItemsFromPayload", () => {
  it("reads ssrHits from pageProps", () => {
    const items = extractHcItemsFromPayload({
      props: { pageProps: { ssrHits: [{ objectID: "1" }] } },
    });
    expect(items).toHaveLength(1);
    expect(items[0].objectID).toBe("1");
  });

  it("reads hits array from API response", () => {
    const items = extractHcItemsFromPayload({ hits: [{ id: "a" }, { id: "b" }] });
    expect(items).toHaveLength(2);
  });
});
