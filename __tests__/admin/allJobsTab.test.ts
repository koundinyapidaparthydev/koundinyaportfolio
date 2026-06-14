import {
  APPLY_NOW_WINDOW_MS,
  applyAllJobsFilters,
  detectPlatformFromUrl,
  filterByTime,
  filterByAtsFriendly,
  filterByResumeModified,
  isResumeModified,
  jobTimeTimestamp,
  filterBySearch,
  filterByPlatform,
  filterByHasDescription,
  sortAllJobs,
  toggleSortColumn,
  formatRelativeTime,
  formatOpenDate,
  parseAtsScore,
  TIME_FILTERS,
  DEFAULT_ALL_JOBS_SORT,
  DEFAULT_TIME_FILTER,
  DEFAULT_COUNTRY_LOCATION,
  DEFAULT_ATS_MIN_SCORE,
  NON_TAILORED_MIN_SCORE,
  DEFAULT_RESUME_MODIFIED_FILTER,
  DEFAULT_APPLIED_VISIBILITY_FILTER,
  filterByAppliedVisibility,
  isJobApplied,
  isJobSkipped,
  formatAtsScoreDisplay,
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
    postedAt: new Date(NOW - 60 * 60_000).toISOString(),
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
  it("defaults to 10m window aligned with scrape interval", () => {
    expect(DEFAULT_TIME_FILTER).toBe("10m");
  });

  it("includes 10m and 20m discovery filters", () => {
    expect(TIME_FILTERS.some((f) => f.id === "10m")).toBe(true);
    expect(TIME_FILTERS.some((f) => f.id === "20m")).toBe(true);
    expect(TIME_FILTERS.find((f) => f.id === "10m")?.ms).toBe(10 * 60_000);
    expect(TIME_FILTERS.find((f) => f.id === "20m")?.ms).toBe(20 * 60_000);
  });

  it("defaults to US-only location filter", () => {
    expect(DEFAULT_COUNTRY_LOCATION).toBe("us");
  });

  it("includes all-time as the last filter option", () => {
    expect(TIME_FILTERS[TIME_FILTERS.length - 1].id).toBe("all");
  });

  it("30m filter keeps jobs discovered within 30 minutes", () => {
    const jobs = [
      job({ fetchedAt: new Date(NOW - 20 * 60_000).toISOString() }),
      job({ fetchedAt: new Date(NOW - 45 * 60_000).toISOString() }),
    ];
    expect(filterByTime(jobs, "30m", NOW)).toHaveLength(1);
  });

  it("includes 12h apply-now filter", () => {
    const twelveH = TIME_FILTERS.find((f) => f.id === "12h");
    expect(twelveH?.ms).toBe(APPLY_NOW_WINDOW_MS);
    expect(twelveH?.label).toMatch(/12h/);
  });

  it("prefers fetchedAt over postedAt for time windows", () => {
    const j = job({
      postedAt: new Date(NOW - 10 * 60_000).toISOString(),
      fetchedAt: new Date(NOW - 5 * 60 * 60_000).toISOString(),
    });
    expect(jobTimeTimestamp(j)).toBe(Date.parse(j.fetchedAt));
  });

  it("falls back to postedAt when fetchedAt is missing", () => {
    const jobs = [
      job({
        fetchedAt: "",
        postedAt: new Date(NOW - 10 * 60_000).toISOString(),
      }),
      job({
        fetchedAt: "",
        postedAt: new Date(NOW - 45 * 60_000).toISOString(),
      }),
    ];
    expect(filterByTime(jobs, "30m", NOW)).toHaveLength(1);
  });

  it("all time filter returns every job including those missing postedAt", () => {
    const jobs = [
      job({ postedAt: new Date(NOW - 7 * 24 * 3_600_000).toISOString() }),
      job({ postedAt: "" }),
    ];
    expect(filterByTime(jobs, "all", NOW)).toHaveLength(2);
  });

  it("uses fetchedAt for window even when postedAt is older", () => {
    const jobs = [
      job({
        postedAt: new Date(NOW - 7 * 24 * 3_600_000).toISOString(),
        fetchedAt: new Date(NOW - 10 * 60_000).toISOString(),
      }),
    ];
    expect(filterByTime(jobs, "30m", NOW)).toHaveLength(1);
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
      toggleSortColumn({ column: "company", direction: "asc" }, "postedAt")
    ).toEqual({
      column: "postedAt",
      direction: "desc",
    });
    expect(toggleSortColumn(DEFAULT_ALL_JOBS_SORT, "company")).toEqual({
      column: "company",
      direction: "asc",
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

describe("ATS thresholds", () => {
  it("uses 75% as the default minimum ATS score", () => {
    expect(DEFAULT_ATS_MIN_SCORE).toBe(75);
  });

  it("uses 90% as the non-tailored resume filter bar (skip-tailor threshold)", () => {
    expect(NON_TAILORED_MIN_SCORE).toBe(90);
  });

  it("defaults resume filter to all jobs", () => {
    expect(DEFAULT_RESUME_MODIFIED_FILTER).toBe("all");
  });
});

describe("filterByAtsFriendly", () => {
  it("keeps jobs at or above the default ATS threshold", () => {
    const jobs = [
      job({ atsScore: "80", title: "high" }),
      job({ atsScore: "50", title: "low" }),
      job({ atsScore: "", title: "missing" }),
    ];
    const result = filterByAtsFriendly(jobs, true, DEFAULT_ATS_MIN_SCORE);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("high");
  });

  it("is disabled when filter is off", () => {
    const jobs = [job({ atsScore: "40" })];
    expect(filterByAtsFriendly(jobs, false)).toHaveLength(1);
  });
});

describe("filterByResumeModified", () => {
  it("shows base-resume jobs at or above 90% for non-modified filter", () => {
    const jobs = [
      job({ atsScore: "92", resumeModified: "no" }),
      job({ atsScore: "85", resumeModified: "no" }),
      job({ atsScore: "82", resumeModified: "yes", resumeUrl: "https://x/r.pdf" }),
    ];
    const result = filterByResumeModified(jobs, "non-modified");
    expect(result).toHaveLength(1);
    expect(result[0].atsScore).toBe("92");
  });

  it("returns all jobs when filter is all", () => {
    const jobs = [
      job({ atsScore: "40", resumeModified: "yes" }),
      job({ atsScore: "90", resumeModified: "no" }),
    ];
    expect(filterByResumeModified(jobs, "all")).toHaveLength(2);
  });
});

describe("parseAtsScore", () => {
  it("parses numeric ATS scores", () => {
    expect(parseAtsScore("72")).toBe(72);
    expect(parseAtsScore("")).toBeNull();
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

  it("sorts highest ATS first by default", () => {
    const jobs = [
      job({ atsScore: "40", title: "low" }),
      job({ atsScore: "88", title: "high" }),
    ];
    const sorted = sortAllJobs(jobs, DEFAULT_ALL_JOBS_SORT);
    expect(sorted[0].title).toBe("high");
  });

  it("sorts newest first by postedAt desc", () => {
    const jobs = [
      job({ postedAt: new Date(NOW - 3_600_000).toISOString(), title: "old" }),
      job({ postedAt: new Date(NOW - 60_000).toISOString(), title: "new" }),
    ];
    const sorted = sortAllJobs(jobs, { column: "postedAt", direction: "desc" });
    expect(sorted[0].title).toBe("new");
  });

  it("sorts jobs without postedAt to the bottom", () => {
    const jobs = [
      job({ postedAt: "", title: "missing" }),
      job({ postedAt: new Date(NOW - 3_600_000).toISOString(), title: "dated" }),
    ];
    const sorted = sortAllJobs(jobs, { column: "postedAt", direction: "desc" });
    expect(sorted[0].title).toBe("dated");
    expect(sorted[1].title).toBe("missing");
  });
});

describe("applyAllJobsFilters", () => {
  it("combines search, location, and description filters", () => {
    const jobs = [
      job({
        company: "OpenAI",
        url: "https://jobs.ashbyhq.com/openai",
        description: "x".repeat(40),
        fetchedAt: new Date(NOW - 10 * 60_000).toISOString(),
        postedAt: new Date(NOW - 10 * 60_000).toISOString(),
        location: "San Francisco, CA",
      }),
      job({
        company: "Lyft",
        url: "https://www.lyft.com/jobs/1",
        description: "",
        postedAt: new Date(NOW - 10 * 60_000).toISOString(),
        location: "London, UK",
      }),
    ];
    const result = applyAllJobsFilters(jobs, {
      search: "openai",
      hasDescription: true,
      resumeModifiedFilter: "all",
      countryLocation: "all",
      sort: DEFAULT_ALL_JOBS_SORT,
      now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0].company).toBe("OpenAI");
  });

  it("shows search matches even when resume filter is enabled", () => {
    const jobs = [
      job({
        company: "JPMorgan Chase",
        title: "AEM Lead Software Engineer",
        atsScore: "25",
        location: "Jersey City, NJ",
        fetchedAt: new Date(NOW - 10 * 60_000).toISOString(),
      }),
      job({
        company: "Stripe",
        title: "Staff Engineer",
        atsScore: "80",
        resumeModified: "no",
        location: "San Francisco, CA",
        fetchedAt: new Date(NOW - 10 * 60_000).toISOString(),
      }),
    ];
    const result = applyAllJobsFilters(jobs, {
      search: "AEM Lead",
      hasDescription: false,
      resumeModifiedFilter: "non-modified",
      countryLocation: "all",
      sort: DEFAULT_ALL_JOBS_SORT,
      now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("AEM Lead Software Engineer");
  });

  it("filters by country location", () => {
    const jobs = [
      job({ location: "San Francisco, CA", company: "US Co" }),
      job({ location: "Bangalore, India", company: "IN Co" }),
      job({ location: "London, UK", company: "UK Co" }),
    ];
    const usOnly = applyAllJobsFilters(jobs, {
      search: "",
      hasDescription: false,
      resumeModifiedFilter: "all",
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
      hasDescription: false,
      resumeModifiedFilter: "all",
      countryLocation: "all",
      sort: DEFAULT_ALL_JOBS_SORT,
      now: NOW,
    });
    expect(result.map((j) => j.company)).toEqual(["US Co"]);
  });
});

describe("formatAtsScoreDisplay", () => {
  it("shows pre-tailor delta for AI-tailored jobs", () => {
    const display = formatAtsScoreDisplay({
      atsScore: "55",
      preTailorAtsScore: "40",
      resumeModified: "yes",
    });
    expect(display.text).toBe("55%");
    expect(display.preText).toBe("was 40%");
    expect(display.improved).toBe(true);
  });

  it("returns dash when ATS score missing", () => {
    expect(formatAtsScoreDisplay({}).text).toBe("—");
  });
});

describe("applied job visibility", () => {
  it("defaults to hiding applied jobs", () => {
    expect(DEFAULT_APPLIED_VISIBILITY_FILTER).toBe("hide-applied");
  });

  it("detects applied status from sheet column K", () => {
    expect(isJobApplied({ applyStatus: "applied" })).toBe(true);
    expect(isJobApplied({ applyStatus: "Applied" })).toBe(true);
    expect(isJobApplied({ applyStatus: "" })).toBe(false);
  });

  it("filters out applied jobs unless include-applied is selected", () => {
    const jobs = [
      job({ company: "Open", applyStatus: "" }),
      job({ company: "Done", applyStatus: "applied" }),
    ];
    expect(filterByAppliedVisibility(jobs, "hide-applied")).toHaveLength(1);
    expect(filterByAppliedVisibility(jobs, "hide-applied")[0].company).toBe("Open");
    expect(filterByAppliedVisibility(jobs, "include-applied")).toHaveLength(2);
  });

  it("detects skip status from sheet column V", () => {
    expect(isJobSkipped({ skipApply: "yes" })).toBe(true);
    expect(isJobSkipped({ skipApply: "Yes" })).toBe(true);
    expect(isJobSkipped({ skipApply: "" })).toBe(false);
  });

  it("filters out skipped jobs in active view", () => {
    const jobs = [
      job({ company: "Open", skipApply: "" }),
      job({ company: "Intern", skipApply: "yes" }),
    ];
    expect(filterByAppliedVisibility(jobs, "hide-applied")).toHaveLength(1);
    expect(filterByAppliedVisibility(jobs, "hide-applied")[0].company).toBe("Open");
    expect(filterByAppliedVisibility(jobs, "include-applied")).toHaveLength(2);
  });

  it("hides applied jobs in applyAllJobsFilters by default", () => {
    const jobs = [
      job({ company: "Active", applyStatus: "" }),
      job({ company: "Applied Co", applyStatus: "applied" }),
    ];
    const result = applyAllJobsFilters(jobs, {
      search: "",
      hasDescription: false,
      resumeModifiedFilter: "all",
      countryLocation: "all",
      sort: DEFAULT_ALL_JOBS_SORT,
      now: NOW,
    });
    expect(result.map((j) => j.company)).toEqual(["Active"]);
  });
});

describe("formatRelativeTime", () => {
  it("formats minutes ago", () => {
    expect(formatRelativeTime(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("5m ago");
  });

  it("formats hours ago", () => {
    expect(formatRelativeTime(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe("3h ago");
  });

  it('returns em dash for empty dates', () => {
    expect(formatRelativeTime("", NOW)).toBe("—");
  });
});

describe("formatOpenDate", () => {
  it("formats ISO timestamps as a medium locale date", () => {
    expect(formatOpenDate("2026-06-01T15:30:00.000Z")).toBe("Jun 1, 2026");
  });

  it('returns em dash for empty dates', () => {
    expect(formatOpenDate("")).toBe("—");
  });
});
