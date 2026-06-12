/**
 * @jest-environment node
 *
 * Tests for scripts/lib/hiring-cafe.mjs (pure helpers).
 */

import {
  APPLY_NOW_WINDOW_MS,
  HC_DEPARTMENTS,
  HC_LOCATIONS,
  HC_US_LOCATION,
  buildHiringCafeSearchState,
  buildHiringCafeSearchUrl,
  dedupeHcRows,
  getHcApplyUrl,
  getHcJobId,
  getJobDedupKey,
  parseHcItemToRow,
  partitionRowsByFetchedAt,
  extractHcItemsFromPayload,
  parseRelativePostedTime,
  extractRelativePostedFromText,
  resolvePostedAt,
} from "../../scripts/lib/hiring-cafe.mjs";
import { isUsHcJob } from "../../scripts/lib/job-location-match.mjs";

describe("buildHiringCafeSearchState", () => {
  it("uses department-based engineering search with US locations", () => {
    const state = buildHiringCafeSearchState();
    expect(state.departments).toEqual(HC_DEPARTMENTS);
    expect(state.locations).toEqual(HC_LOCATIONS);
    expect(state.locations[0]).toEqual(HC_US_LOCATION);
    expect(state.locations[0].formatted_address).toBe("United States");
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
    expect(parsed.locations).toEqual(HC_LOCATIONS);
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

describe("parseRelativePostedTime", () => {
  const ref = new Date("2026-06-12T12:00:00.000Z");
  const now = ref.getTime();

  it("parses minute-relative strings", () => {
    expect(parseRelativePostedTime("48m", ref)).toBe("2026-06-12T11:12:00.000Z");
    expect(parseRelativePostedTime("48m", now)).toBe(new Date(now - 48 * 60_000).toISOString());
  });

  it("parses hour-relative strings", () => {
    expect(parseRelativePostedTime("1h", ref)).toBe("2026-06-12T11:00:00.000Z");
    expect(parseRelativePostedTime("2h", ref)).toBe("2026-06-12T10:00:00.000Z");
    expect(parseRelativePostedTime("2h", now)).toBe(new Date(now - 2 * 3_600_000).toISOString());
  });

  it("parses just now", () => {
    expect(parseRelativePostedTime("just now", ref)).toBe(ref.toISOString());
  });

  it("extracts relative time from card text", () => {
    expect(extractRelativePostedFromText("Stripe · Senior Eng · 1h · Remote", ref)).toBe(
      "2026-06-12T11:00:00.000Z"
    );
    expect(extractRelativePostedFromText("Stripe · Remote · 48m · $180k", ref)).toBe(
      "2026-06-12T11:12:00.000Z"
    );
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

  it("maps date_posted and listed_at fields", () => {
    const row = parseHcItemToRow(
      {
        objectID: "jobid123",
        hc_title: "Engineer",
        hc_apply_url: "https://hiring.cafe/job/jobid123",
        date_posted: "2026-06-11T08:00:00.000Z",
      },
      fetchedAt
    );
    expect(row![6]).toBe("2026-06-11T08:00:00.000Z");
  });

  it("resolves relative posted fields from API rows", () => {
    const row = parseHcItemToRow(
      {
        objectID: "jobid123",
        hc_title: "Engineer",
        hc_apply_url: "https://hiring.cafe/job/jobid123",
        timeAgo: "48m",
      },
      fetchedAt
    );
    expect(row![6]).toBe("2026-06-12T09:12:00.000Z");
  });

  it("resolves relative_posted via resolvePostedAt", () => {
    expect(resolvePostedAt("1h", fetchedAt)).toBe("2026-06-12T09:00:00.000Z");
    expect(resolvePostedAt("2026-06-11T08:00:00.000Z", fetchedAt)).toBe(
      "2026-06-11T08:00:00.000Z"
    );
  });
});

describe("isUsHcJob", () => {
  it("accepts US-only locations", () => {
    expect(isUsHcJob("United States")).toBe(true);
    expect(isUsHcJob("San Francisco, CA")).toBe(true);
    expect(isUsHcJob("Denver or San Antonio or United States")).toBe(true);
    expect(isUsHcJob("Raleigh or Morrisville")).toBe(true);
  });

  it("rejects India and multi-country listings", () => {
    expect(isUsHcJob("Bangalore, India")).toBe(false);
    expect(isUsHcJob("Bangalore or India or United States")).toBe(false);
    expect(isUsHcJob("Hyderabad or Bengaluru or India or United States")).toBe(false);
    expect(isUsHcJob("")).toBe(false);
    expect(isUsHcJob("Remote")).toBe(false);
  });
});

describe("dedupeHcRows", () => {
  it("drops duplicate company+title with different URLs", () => {
    const rows = [
      ["Acme", "Engineer", "US", "https://hiring.cafe/job/abc12345", "hiring-cafe", "t1", "", ""],
      ["Acme", "Engineer", "US", "https://boards.greenhouse.io/acme/1", "hiring-cafe", "t2", "", ""],
    ];
    expect(dedupeHcRows(rows)).toHaveLength(1);
  });
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
