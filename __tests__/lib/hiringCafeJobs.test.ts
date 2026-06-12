/**
 * @jest-environment node
 */

import { isHiringCafeJob } from "@/lib/admin/hiringCafeJobs";

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
