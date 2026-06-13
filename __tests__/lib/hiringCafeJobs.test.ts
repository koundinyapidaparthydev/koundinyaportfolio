/**
 * @jest-environment node
 */

import { buildHiringCafeSearchUrl, isHiringCafeJob } from "@/lib/admin/hiringCafeJobs";

describe("buildHiringCafeSearchUrl", () => {
  it("matches pipeline search filters", () => {
    const url = buildHiringCafeSearchUrl();
    expect(url).toMatch(/^https:\/\/hiring\.cafe\/\?searchState=/);
    const parsed = JSON.parse(decodeURIComponent(url.split("searchState=")[1]!));
    expect(parsed.departments).toEqual(["Engineering", "Software Development"]);
    expect(parsed.dateFetchedPastNDays).toBe(2);
    expect(parsed.sortBy).toBe("date");
    expect(parsed).not.toHaveProperty("locations");
  });
});

describe("isHiringCafeJob", () => {
  it("matches hiring-cafe category", () => {
    expect(
      isHiringCafeJob({
        category: "hiring-cafe",
        url: "https://boards.greenhouse.io/acme/jobs/1",
      })
    ).toBe(true);
  });

  it("matches hiring.cafe URL even without category", () => {
    expect(
      isHiringCafeJob({
        category: "travel",
        url: "https://hiring.cafe/job/abc12345",
      })
    ).toBe(true);
  });

  it("excludes legacy portal rows", () => {
    expect(
      isHiringCafeJob({
        category: "fintech",
        url: "https://boards.greenhouse.io/stripe/jobs/1",
      })
    ).toBe(false);
  });
});
