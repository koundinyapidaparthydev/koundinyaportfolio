import {
  COMPANIES_TIME_FILTERS,
  buildLastSeenUpdates,
  buildMaxAtsByCompany,
  filterCompaniesByCategories,
  filterCompaniesBySearch,
  filterJobsByCompaniesTime,
  sortCompanies,
  toggleCategoryFilter,
  type CompanyJobRow,
} from "@/lib/admin/companiesTabFilters";

describe("CompaniesTab time filters", () => {
  const now = Date.parse("2026-06-06T12:00:00.000Z");

  it("includes 10m as the first filter option", () => {
    expect(COMPANIES_TIME_FILTERS[0]).toEqual({
      id: "10m",
      label: "⚡ Last 10 mins",
      ms: 10 * 60_000,
    });
  });

  it("30m filter keeps jobs seen within 30 minutes", () => {
    const jobs: CompanyJobRow[] = [
      {
        company: "A",
        title: "Eng",
        location: "",
        url: "https://a.com",
        category: "general",
        fetchedAt: new Date(now - 20 * 60_000).toISOString(),
        description: "",
      },
      {
        company: "B",
        title: "Eng",
        location: "",
        url: "https://b.com",
        category: "general",
        fetchedAt: new Date(now - 45 * 60_000).toISOString(),
        description: "",
      },
    ];
    expect(filterJobsByCompaniesTime(jobs, "30m", now)).toHaveLength(1);
  });

  it("2h filter is wider than 30m", () => {
    const jobs: CompanyJobRow[] = [
      {
        company: "A",
        title: "Eng",
        location: "",
        url: "https://a.com",
        category: "general",
        fetchedAt: new Date(now - 90 * 60_000).toISOString(),
        description: "",
      },
    ];
    expect(filterJobsByCompaniesTime(jobs, "30m", now)).toHaveLength(0);
    expect(filterJobsByCompaniesTime(jobs, "2h", now)).toHaveLength(1);
  });
});

describe("CompaniesTab company filters", () => {
  const companies = [
    { name: "Airbnb", category: "travel" as const },
    { name: "OpenAI", category: "ai-agentic" as const },
    { name: "Google", category: "general" as const },
  ];

  it("returns all companies when no category filter is active", () => {
    expect(filterCompaniesByCategories(companies, new Set())).toHaveLength(3);
  });

  it("filters companies by selected categories", () => {
    const selected = new Set(["travel", "general"] as const);
    const result = filterCompaniesByCategories(companies, selected);
    expect(result.map((c) => c.name)).toEqual(["Airbnb", "Google"]);
  });

  it("filters companies by search query", () => {
    expect(filterCompaniesBySearch(companies, "open")).toEqual([companies[1]]);
  });

  it("sorts companies by name", () => {
    const sorted = sortCompanies(companies, "name", {});
    expect(sorted.map((c) => c.name)).toEqual(["Airbnb", "Google", "OpenAI"]);
  });

  it("sorts companies by job count descending", () => {
    const counts = { Airbnb: 2, OpenAI: 5, Google: 1 };
    const sorted = sortCompanies(companies, "jobCount", counts);
    expect(sorted.map((c) => c.name)).toEqual(["OpenAI", "Airbnb", "Google"]);
  });

  it("sorts companies by max ATS descending", () => {
    const counts = { Airbnb: 2, OpenAI: 5, Google: 1 };
    const maxAts = { Airbnb: 60, OpenAI: 92, Google: 75 };
    const sorted = sortCompanies(companies, "maxAts", counts, maxAts);
    expect(sorted.map((c) => c.name)).toEqual(["OpenAI", "Google", "Airbnb"]);
  });

  it("toggles category filters on and off", () => {
    let filters = toggleCategoryFilter(new Set(), "travel");
    expect([...filters]).toEqual(["travel"]);
    filters = toggleCategoryFilter(filters, "travel");
    expect([...filters]).toEqual([]);
  });
});

describe("buildMaxAtsByCompany", () => {
  it("returns highest score per company", () => {
    const jobs: CompanyJobRow[] = [
      { company: "Stripe", title: "A", location: "", url: "https://a", category: "g", fetchedAt: "", description: "" },
      { company: "Stripe", title: "B", location: "", url: "https://b", category: "g", fetchedAt: "", description: "" },
      { company: "Figma", title: "C", location: "", url: "https://c", category: "g", fetchedAt: "", description: "" },
    ];
    const scores = new Map([
      ["https://a", 80],
      ["https://b", 95],
      ["https://c", 70],
    ]);
    expect(buildMaxAtsByCompany(jobs, scores)).toEqual({ Stripe: 95, Figma: 70 });
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
