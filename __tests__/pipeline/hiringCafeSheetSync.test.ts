/**
 * @jest-environment node
 */

import {
  filterNewHcJobs,
  getRoleDedupKey,
  HC_PIPELINE_INTERVAL_MS,
} from "../../scripts/lib/hiring-cafe-sheet-sync.mjs";
import { getJobDedupKey } from "../../scripts/lib/hiring-cafe.mjs";

function row(company: string, title: string, url: string) {
  return [company, title, "US", url, "hiring-cafe", new Date().toISOString(), "", ""];
}

describe("getRoleDedupKey", () => {
  it("normalizes company and title", () => {
    expect(getRoleDedupKey(row("  Acme  ", "Software Engineer", "https://x.com"))).toBe(
      "role:acme|software engineer"
    );
  });
});

describe("filterNewHcJobs", () => {
  it("skips rows whose HC dedup key is already known", () => {
    const jobs = [row("Acme", "Engineer", "https://hiring.cafe/job/abc12345")];
    const key = getJobDedupKey(jobs[0]);
    const known = new Set([key]);
    expect(filterNewHcJobs(jobs, known, new Set())).toHaveLength(0);
  });

  it("skips duplicate company+title even with different URL", () => {
    const jobs = [
      row("Acme", "Engineer", "https://boards.greenhouse.io/acme/jobs/1"),
    ];
    const role = getRoleDedupKey(jobs[0]);
    expect(filterNewHcJobs(jobs, new Set(), new Set([role]))).toHaveLength(0);
  });

  it("returns only genuinely new rows", () => {
    const jobs = [
      row("Acme", "Engineer", "https://hiring.cafe/job/abc12345"),
      row("Beta", "Developer", "https://hiring.cafe/job/def67890"),
    ];
    expect(filterNewHcJobs(jobs, new Set(), new Set())).toHaveLength(2);
  });
});

describe("HC_PIPELINE_INTERVAL_MS", () => {
  it("is 10 minutes", () => {
    expect(HC_PIPELINE_INTERVAL_MS).toBe(600_000);
  });
});
