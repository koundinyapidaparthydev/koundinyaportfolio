import {
  applyAllJobsFilters,
  detectPlatformFromUrl,
  filterByTime,
  filterBySearch,
  filterByPlatform,
  filterByHasDescription,
  sortAllJobs,
  toggleSortColumn,
  uniqueCategories,
  formatRelativeTime,
  TIME_FILTERS,
  DEFAULT_ALL_JOBS_SORT,
  type AllJobsRow,
} from "@/lib/admin/allJobsFilters";

const NOW = Date.parse("2026-06-06T12:00:00.000Z");

function job(overrides: Partial<AllJobsRow> = {}): AllJobsRow {
  return {
    company: "Acme",
    title: "Software Engineer",
    location: "Remote, US",
    url: "https://job-boards.greenhouse.io/acme/jobs/1",
    category: "general",
    fetchedAt: new Date(NOW - 60 * 60_000).toISOString(),
    description: "A".repeat(40),
    ...overrides,
  };
}

describe("detectPlatformFromUrl", () => {
  it("detects greenhouse URLs", () => {
    expect(detectPlatformFromUrl("https://boards.greenhouse.io/foo")).toBe("greenhouse");
  });

  it("detects ashby URLs", () => {
    expect(detectPlatformFromUrl("https://jobs.ashbyhq.com/openai")).toBe("ashby");
  });

  it("detects workday URLs", () => {
    expect(detectPlatformFromUrl("https://foo.wd1.myworkdayjobs.com/en-US/jobs")).toBe("workday");
  });

  it("returns other for unknown hosts", () => {
    expect(detectPlatformFromUrl("https://example.com/careers")).toBe("other");
  });
});

describe("All Jobs time filters", () => {
  it("includes all-time as the last filter option", () => {
    expect(TIME_FILTERS[TIME_FILTERS.length - 1].id).toBe("all");
  });

  it("30m filter keeps jobs seen within 30 minutes", () => {
    const jobs = [
      job({ fetchedAt: new Date(NOW - 20 * 60_000).toISOString() }),
      job({ fetchedAt: new Date(NOW - 45 * 60_000).toISOString() }),
    ];
    expect(filterByTime(jobs, "30m", NOW)).toHaveLength(1);
  });

  it("all time filter returns every job", () => {
    const jobs = [
      job({ fetchedAt: new Date(NOW - 7 * 24 * 3_600_000).toISOString() }),
    ];
    expect(filterByTime(jobs, "all", NOW)).toHaveLength(1);
  });
});

describe("filterBySearch", () => {
  it("matches company, title, location, and URL", () => {
    const jobs = [
      job({ company: "Stripe", title: "Backend", location: "SF", url: "https://stripe.com/j/1" }),
      job({ company: "Other", title: "PM", location: "NYC", url: "https://other.com/j/2" }),
    ];
    expect(filterBySearch(jobs, "stripe")).toHaveLength(1);
    expect(filterBySearch(jobs, "backend")).toHaveLength(1);
    expect(filterBySearch(jobs, "sf")).toHaveLength(1);
    expect(filterBySearch(jobs, "stripe.com")).toHaveLength(1);
  });
});

describe("filterByPlatform", () => {
  it("filters by ATS platform", () => {
    const jobs = [
      job({ url: "https://jobs.ashbyhq.com/foo" }),
      job({ url: "https://boards.greenhouse.io/bar" }),
    ];
    expect(filterByPlatform(jobs, "ashby")).toHaveLength(1);
    expect(filterByPlatform(jobs, "greenhouse")).toHaveLength(1);
  });
});

describe("filterByHasDescription", () => {
  it("requires description of at least 30 characters when enabled", () => {
    const jobs = [
      job({ description: "short" }),
      job({ description: "x".repeat(30) }),
    ];
    expect(filterByHasDescription(jobs, true)).toHaveLength(1);
    expect(filterByHasDescription(jobs, false)).toHaveLength(2);
  });
});

describe("toggleSortColumn", () => {
  it("sets default direction when switching columns", () => {
    expect(toggleSortColumn(DEFAULT_ALL_JOBS_SORT, "company")).toEqual({
      column: "company",
      direction: "asc",
    });
    expect(
      toggleSortColumn({ column: "company", direction: "asc" }, "fetchedAt")
    ).toEqual({
      column: "fetchedAt",
      direction: "desc",
    });
  });

  it("toggles direction when clicking the same column", () => {
    const current = { column: "title" as const, direction: "asc" as const };
    expect(toggleSortColumn(current, "title")).toEqual({
      column: "title",
      direction: "desc",
    });
  });
});

describe("sortAllJobs", () => {
  it("sorts by company A-Z", () => {
    const jobs = [
      job({ company: "Zeta", title: "A" }),
      job({ company: "Alpha", title: "B" }),
    ];
    const sorted = sortAllJobs(jobs, { column: "company", direction: "asc" });
    expect(sorted[0].company).toBe("Alpha");
  });

  it("sorts newest first by fetchedAt desc", () => {
    const jobs = [
      job({ fetchedAt: new Date(NOW - 3_600_000).toISOString(), title: "old" }),
      job({ fetchedAt: new Date(NOW - 60_000).toISOString(), title: "new" }),
    ];
    const sorted = sortAllJobs(jobs, DEFAULT_ALL_JOBS_SORT);
    expect(sorted[0].title).toBe("new");
  });

  it("sorts by platform", () => {
    const jobs = [
      job({ url: "https://boards.greenhouse.io/foo", title: "gh" }),
      job({ url: "https://jobs.ashbyhq.com/foo", title: "ashby" }),
    ];
    const sorted = sortAllJobs(jobs, { column: "platform", direction: "asc" });
    expect(sorted[0].title).toBe("ashby");
  });
});

describe("applyAllJobsFilters", () => {
  it("combines search, category, time, platform, and description filters", () => {
    const jobs = [
      job({
        company: "OpenAI",
        category: "ai-agentic",
        url: "https://jobs.ashbyhq.com/openai",
        description: "x".repeat(40),
        fetchedAt: new Date(NOW - 10 * 60_000).toISOString(),
      }),
      job({
        company: "Lyft",
        category: "travel",
        url: "https://www.lyft.com/jobs/1",
        description: "",
        fetchedAt: new Date(NOW - 10 * 60_000).toISOString(),
      }),
    ];
    const result = applyAllJobsFilters(jobs, {
      search: "openai",
      category: "ai-agentic",
      timeFilter: "30m",
      platform: "ashby",
      hasDescription: true,
      countryLocation: "all",
      sort: DEFAULT_ALL_JOBS_SORT,
      now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0].company).toBe("OpenAI");
  });

  it("filters by country location", () => {
    const jobs = [
      job({ location: "San Francisco, CA", company: "US Co" }),
      job({ location: "Bangalore, India", company: "IN Co" }),
      job({ location: "London, UK", company: "UK Co" }),
    ];
    const usOnly = applyAllJobsFilters(jobs, {
      search: "",
      category: "all",
      timeFilter: "all",
      platform: "all",
      hasDescription: false,
      countryLocation: "us",
      sort: DEFAULT_ALL_JOBS_SORT,
      now: NOW,
    });
    expect(usOnly.map((j) => j.company)).toEqual(["US Co"]);
  });

  it("excludes unsupported locations when country filter is all", () => {
    const jobs = [
      job({ location: "San Francisco, CA", company: "US Co" }),
      job({ location: "London, UK", company: "UK Co" }),
    ];
    const result = applyAllJobsFilters(jobs, {
      search: "",
      category: "all",
      timeFilter: "all",
      platform: "all",
      hasDescription: false,
      countryLocation: "all",
      sort: DEFAULT_ALL_JOBS_SORT,
      now: NOW,
    });
    expect(result.map((j) => j.company)).toEqual(["US Co"]);
  });
});

describe("uniqueCategories", () => {
  it("returns sorted unique non-empty categories", () => {
    const cats = uniqueCategories([
      job({ category: "travel" }),
      job({ category: "general" }),
      job({ category: "travel" }),
      job({ category: "" }),
    ]);
    expect(cats).toEqual(["general", "travel"]);
  });
});

describe("formatRelativeTime", () => {
  it("formats minutes ago", () => {
    expect(formatRelativeTime(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("5m ago");
  });

  it("formats hours ago", () => {
    expect(formatRelativeTime(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe("3h ago");
  });
});
