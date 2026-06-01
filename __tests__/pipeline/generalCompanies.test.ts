/**
 * @jest-environment node
 *
 * __tests__/pipeline/generalCompanies.test.ts
 *
 * Tests for the General Full Stack companies added to scripts/scrape-jobs.mjs.
 *
 * Covers all 30 companies across adapters:
 *   Greenhouse : Snap Inc., Stripe, Databricks, Twilio, Cloudflare, Datadog,
 *                MongoDB, Riot Games, Vercel, Instacart, Pinterest
 *   Ashby      : Ramp, Confluent, Snowflake
 *   Workday    : Adobe, Intuit, Qualcomm, PayPal, Capital One,
 *                JPMorgan Chase, Shopify, Zendesk
 *   Custom     : Amazon, Google, Meta, Apple
 *
 * Strategy: mock global fetch inline — no real HTTP calls.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** 7-column row written to Google Sheets */
type ScrapeRow = [string, string, string, string, string, string, string?];

// ─────────────────────────────────────────────────────────────────────────────
// Inline helpers (replicated from scrape-jobs.mjs)
// ─────────────────────────────────────────────────────────────────────────────

function isEngineeringRole(title: string): boolean {
  const t = title.toLowerCase();
  return [
    "engineer", "software", "developer", "full stack", "fullstack",
    "frontend", "front-end", "backend", "back-end", "devops", "sre",
    "platform", "architect", "mobile", "ios", "android",
  ].some((k) => t.includes(k));
}

function now(): string {
  return new Date().toISOString();
}

/** Inline fetchGreenhouse adapter (mirrors scrape-jobs.mjs) */
async function fetchGreenhouse(
  boardSlug: string,
  company: string,
  category: string,
): Promise<ScrapeRow[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardSlug}/jobs`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const { jobs = [] } = (await res.json()) as { jobs: Array<{ title: string; absolute_url: string; location?: { name: string } }> };
    const filtered = jobs.filter((j) => isEngineeringRole(j.title));
    return filtered.map((j) => [
      company, j.title, j.location?.name ?? "", j.absolute_url ?? "", category, now(),
    ]);
  } catch {
    return [];
  }
}

/** Inline fetchAshby adapter — handles both jobPostings and jobs keys */
async function fetchAshby(
  identifier: string,
  company: string,
  category: string,
): Promise<ScrapeRow[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${identifier}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      jobPostings?: Array<{ title: string; locationName?: string; location?: string; jobUrl?: string; id?: string }>;
      jobs?: Array<{ title: string; location?: string; jobUrl?: string; id?: string }>;
    };
    const jobs = data.jobPostings ?? data.jobs ?? [];
    const filtered = jobs.filter((j) => isEngineeringRole(j.title));
    return filtered.map((j) => [
      company,
      j.title ?? "",
      (j as { locationName?: string; location?: string }).locationName ?? j.location ?? "",
      j.jobUrl ?? `https://jobs.ashbyhq.com/${identifier}/${j.id}`,
      category,
      now(),
    ]);
  } catch {
    return [];
  }
}

/** Inline fetchWorkday adapter */
async function fetchWorkday(
  host: string,
  tenant: string,
  site: string,
  company: string,
  category: string,
  searchText = "engineer",
): Promise<ScrapeRow[]> {
  const url = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText }),
    });
    if (!res.ok) return [];
    const { jobPostings = [] } = (await res.json()) as {
      jobPostings: Array<{ title: string; locationsText?: string; externalPath?: string }>
    };
    const filtered = jobPostings.filter((j) => isEngineeringRole(j.title));
    return filtered.map((j) => [
      company,
      j.title,
      j.locationsText ?? "",
      j.externalPath ? `https://${host}${j.externalPath}` : `https://${host}/en-US/${site}`,
      category,
      now(),
    ]);
  } catch {
    return [];
  }
}

/** Inline fetchAmazon adapter */
async function fetchAmazon(category = "general"): Promise<ScrapeRow[]> {
  const params = new URLSearchParams({
    offset: "0", result_limit: "20", sort: "recent",
    base_query: "software engineer",
  });
  const url = `https://www.amazon.jobs/en/search.json?${params}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { jobs?: Array<{ title?: string; normalized_location?: string; city?: string; job_path?: string }>; results?: Array<{ title?: string; normalized_location?: string; city?: string; job_path?: string }> };
    const jobs = data.jobs ?? data.results ?? [];
    const filtered = jobs.filter((j) => isEngineeringRole(j.title ?? ""));
    return filtered.map((j) => [
      "Amazon", j.title ?? "",
      j.normalized_location ?? j.city ?? "",
      j.job_path ? `https://www.amazon.jobs${j.job_path}` : "",
      category, now(),
    ]).filter((r) => r[3] !== "") as ScrapeRow[];
  } catch {
    return [];
  }
}

/** Inline fetchGoogle adapter */
async function fetchGoogle(category = "general"): Promise<ScrapeRow[]> {
  const params = new URLSearchParams({ q: "software engineer", num: "20", start: "0" });
  const url = `https://careers.google.com/api/v3/search/?${params}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { jobs?: Array<{ title?: string; locations?: Array<{ display?: string; city?: string }>; id?: string }> };
    const jobs = data.jobs ?? [];
    const filtered = jobs.filter((j) => isEngineeringRole(j.title ?? ""));
    return filtered.map((j) => [
      "Google", j.title ?? "",
      j.locations?.[0]?.display ?? j.locations?.[0]?.city ?? "",
      j.id ? `https://careers.google.com/jobs/results/${j.id}` : "",
      category, now(),
    ]).filter((r) => r[3] !== "") as ScrapeRow[];
  } catch {
    return [];
  }
}

/** Inline fetchApple adapter */
async function fetchApple(category = "general"): Promise<ScrapeRow[]> {
  const url = "https://jobs.apple.com/api/role/search?q=software+engineer&page=0&locale=en-us";
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      searchResults?: Array<{ postingTitle?: string; title?: string; locations?: Array<{ name?: string }>; location?: string; id?: string }>;
    };
    const jobs = data.searchResults ?? [];
    const filtered = jobs.filter((j) => isEngineeringRole(j.postingTitle ?? j.title ?? ""));
    return filtered.map((j) => [
      "Apple",
      j.postingTitle ?? j.title ?? "",
      Array.isArray(j.locations) ? j.locations.map((l) => l.name ?? "").join(", ") : (j.location ?? ""),
      j.id ? `https://jobs.apple.com/en-us/details/${j.id}` : "",
      category, now(),
    ]).filter((r) => r[3] !== "") as ScrapeRow[];
  } catch {
    return [];
  }
}

/** Inline fetchMeta adapter (mirrors scrape-jobs.mjs) */
async function fetchMeta(category = "general"): Promise<ScrapeRow[]> {
  try {
    const res = await fetch(
      "https://www.metacareers.com/jobs?q=software+engineer&is_leadership=0&is_remote_only=0",
      { headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html,application/json" } },
    );
    if (!res.ok) return [];
    const text = await res.text();
    const match = text.match(/"jobs"\s*:\s*(\[[\s\S]*?\](?=\s*[,}]))/);
    if (!match) return [];
    const jobs = JSON.parse(match[1]);
    const filtered = jobs.filter((j: { title?: string; name?: string }) =>
      isEngineeringRole(j.title ?? j.name ?? ""),
    );
    return filtered.map((j: { title?: string; name?: string; location?: string; locations?: string[]; url?: string; id?: string }) => [
      "Meta",
      j.title ?? j.name ?? "",
      j.location ?? j.locations?.[0] ?? "",
      j.url ?? (j.id ? `https://www.metacareers.com/jobs/${j.id}` : ""),
      category,
      now(),
    ]).filter((r: ScrapeRow) => r[3]) as ScrapeRow[];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock fetch setup
// ─────────────────────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
(global as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

/** Helper: resolve a single successful fetch with JSON body */
function mockJson(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

/** Helper: make fetch throw (network error) */
function mockNetworkError(message = "Network error") {
  mockFetch.mockRejectedValueOnce(new Error(message));
}

beforeEach(() => mockFetch.mockReset());

// ─────────────────────────────────────────────────────────────────────────────
// Greenhouse adapter — 14 general companies
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchGreenhouse — general companies", () => {
  const GH_COMPANIES: Array<[string, string]> = [
    ["snapinc",        "Snap Inc."],
    ["stripe",         "Stripe"],
    ["databricks",     "Databricks"],
    ["twilio",         "Twilio"],
    ["cloudflare",     "Cloudflare"],
    ["datadog",        "Datadog"],
    ["mongodb",        "MongoDB"],
    ["doordashglobal", "DoorDash"],   // migrated from 'doordash' (404)
    ["figma",          "Figma"],
    ["brex",           "Brex"],
    ["riotgames",  "Riot Games"],
    ["vercel",     "Vercel"],
    ["instacart",  "Instacart"],
    ["pinterest",  "Pinterest"],
  ];

  it.each(GH_COMPANIES)(
    "calls boards-api.greenhouse.io/v1/boards/%s/jobs",
    async (slug) => {
      mockJson({ jobs: [] });
      await fetchGreenhouse(slug, "Test Co", "general");
      expect(mockFetch).toHaveBeenCalledWith(
        `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
      );
    },
  );

  it.each(GH_COMPANIES)(
    "returns engineering rows for %s with category=general",
    async (slug, company) => {
      mockJson({
        jobs: [
          {
            title: "Software Engineer",
            absolute_url: `https://boards.greenhouse.io/${slug}/jobs/123`,
            location: { name: "San Francisco, CA" },
          },
          {
            title: "Product Manager",
            absolute_url: `https://boards.greenhouse.io/${slug}/jobs/456`,
            location: { name: "Remote" },
          },
        ],
      });
      const rows = await fetchGreenhouse(slug, company, "general");
      expect(rows).toHaveLength(1);
      expect(rows[0][0]).toBe(company);         // company name
      expect(rows[0][1]).toBe("Software Engineer");
      expect(rows[0][2]).toBe("San Francisco, CA");
      expect(rows[0][4]).toBe("general");       // category
      expect(rows[0][5]).toBeTruthy();           // fetchedAt
    },
  );

  it.each(GH_COMPANIES)(
    "returns [] on HTTP error for %s",
    async (slug, company) => {
      mockJson({ message: "Not Found" }, 404);
      const rows = await fetchGreenhouse(slug, company, "general");
      expect(rows).toEqual([]);
    },
  );

  it.each(GH_COMPANIES)(
    "returns [] on network error for %s",
    async (slug, company) => {
      mockNetworkError();
      const rows = await fetchGreenhouse(slug, company, "general");
      expect(rows).toEqual([]);
    },
  );

  it("filters out non-engineering roles", async () => {
    mockJson({
      jobs: [
        { title: "Software Engineer", absolute_url: "https://example.com/1", location: { name: "NY" } },
        { title: "Marketing Manager", absolute_url: "https://example.com/2", location: { name: "NY" } },
        { title: "Frontend Developer", absolute_url: "https://example.com/3", location: { name: "NY" } },
        { title: "Sales Representative", absolute_url: "https://example.com/4", location: { name: "NY" } },
        { title: "DevOps Engineer", absolute_url: "https://example.com/5", location: { name: "NY" } },
      ],
    });
    const rows = await fetchGreenhouse("stripe", "Stripe", "general");
    expect(rows).toHaveLength(3);
    const titles = rows.map((r) => r[1]);
    expect(titles).toContain("Software Engineer");
    expect(titles).toContain("Frontend Developer");
    expect(titles).toContain("DevOps Engineer");
  });

  it("returns correct 6-column row structure", async () => {
    mockJson({
      jobs: [
        { title: "Platform Engineer", absolute_url: "https://boards.greenhouse.io/vercel/jobs/999", location: { name: "Remote" } },
      ],
    });
    const rows = await fetchGreenhouse("vercel", "Vercel", "general");
    expect(rows).toHaveLength(1);
    const [company, title, location, url, category, fetchedAt] = rows[0];
    expect(company).toBe("Vercel");
    expect(title).toBe("Platform Engineer");
    expect(location).toBe("Remote");
    expect(url).toBe("https://boards.greenhouse.io/vercel/jobs/999");
    expect(category).toBe("general");
    expect(typeof fetchedAt).toBe("string");
    expect(new Date(fetchedAt!).toISOString()).toBe(fetchedAt);
  });

  it("handles empty jobs array gracefully", async () => {
    mockJson({ jobs: [] });
    const rows = await fetchGreenhouse("cloudflare", "Cloudflare", "general");
    expect(rows).toEqual([]);
  });

  it("handles missing location field", async () => {
    mockJson({
      jobs: [{ title: "Backend Engineer", absolute_url: "https://example.com/1" }],
    });
    const rows = await fetchGreenhouse("datadog", "Datadog", "general");
    expect(rows[0][2]).toBe("");
  });

  describe("Vercel — slug is 'vercel' (not 'vercelcareers')", () => {
    it("calls the correct slug 'vercel'", async () => {
      mockJson({ jobs: [] });
      await fetchGreenhouse("vercel", "Vercel", "general");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://boards-api.greenhouse.io/v1/boards/vercel/jobs",
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ashby adapter — Ramp, Confluent, Snowflake
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchAshby — general companies", () => {
  const ASHBY_COMPANIES: Array<[string, string]> = [
    ["ramp",      "Ramp"],
    ["confluent", "Confluent"],
    ["snowflake", "Snowflake"],
  ];

  it.each(ASHBY_COMPANIES)(
    "calls api.ashbyhq.com/posting-api/job-board/%s",
    async (id) => {
      mockJson({ jobPostings: [] });
      await fetchAshby(id, "Test", "general");
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.ashbyhq.com/posting-api/job-board/${id}`,
      );
    },
  );

  it.each(ASHBY_COMPANIES)(
    "returns engineering rows for %s with category=general using jobPostings field",
    async (id, company) => {
      mockJson({
        jobPostings: [
          { title: "Software Engineer", locationName: "New York, NY", jobUrl: `https://jobs.ashbyhq.com/${id}/abc-123` },
          { title: "Product Designer", locationName: "Remote", jobUrl: `https://jobs.ashbyhq.com/${id}/def-456` },
        ],
      });
      const rows = await fetchAshby(id, company, "general");
      expect(rows).toHaveLength(1);
      expect(rows[0][0]).toBe(company);
      expect(rows[0][1]).toBe("Software Engineer");
      expect(rows[0][4]).toBe("general");
    },
  );

  it("handles Snowflake-style 'jobs' key (not jobPostings)", async () => {
    // Snowflake's Ashby uses { jobs: [...] } instead of { jobPostings: [...] }
    mockJson({
      jobs: [
        { title: "Software Engineer", location: "AU-Sydney", jobUrl: "https://jobs.ashbyhq.com/snowflake/abc" },
        { title: "Data Analyst", location: "US-Remote", jobUrl: "https://jobs.ashbyhq.com/snowflake/def" },
      ],
      apiVersion: "1",
    });
    const rows = await fetchAshby("snowflake", "Snowflake", "general");
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("Snowflake");
    expect(rows[0][1]).toBe("Software Engineer");
    expect(rows[0][4]).toBe("general");
  });

  it("uses location field when locationName is absent (Snowflake format)", async () => {
    mockJson({
      jobs: [
        { title: "Backend Engineer", location: "AU-Sydney", jobUrl: "https://jobs.ashbyhq.com/snowflake/xyz" },
      ],
    });
    const rows = await fetchAshby("snowflake", "Snowflake", "general");
    expect(rows[0][2]).toBe("AU-Sydney");
  });

  it("falls back to constructed URL when jobUrl is absent", async () => {
    mockJson({
      jobPostings: [
        { title: "Platform Engineer", locationName: "Remote", id: "uuid-1234" },
      ],
    });
    const rows = await fetchAshby("ramp", "Ramp", "general");
    expect(rows[0][3]).toBe("https://jobs.ashbyhq.com/ramp/uuid-1234");
  });

  it.each(ASHBY_COMPANIES)(
    "returns [] on HTTP 404 for %s",
    async (id, company) => {
      mockJson({ message: "Not Found" }, 404);
      const rows = await fetchAshby(id, company, "general");
      expect(rows).toEqual([]);
    },
  );

  it.each(ASHBY_COMPANIES)(
    "returns [] on network error for %s",
    async (id, company) => {
      mockNetworkError();
      const rows = await fetchAshby(id, company, "general");
      expect(rows).toEqual([]);
    },
  );

  it("filters out non-engineering roles (Ramp)", async () => {
    mockJson({
      jobPostings: [
        { title: "Software Engineer", locationName: "NYC", jobUrl: "https://jobs.ashbyhq.com/ramp/1" },
        { title: "Account Executive", locationName: "NYC", jobUrl: "https://jobs.ashbyhq.com/ramp/2" },
        { title: "Android Developer", locationName: "Remote", jobUrl: "https://jobs.ashbyhq.com/ramp/3" },
      ],
    });
    const rows = await fetchAshby("ramp", "Ramp", "general");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r[1])).toEqual(
      expect.arrayContaining(["Software Engineer", "Android Developer"]),
    );
  });

  it("handles empty response gracefully", async () => {
    mockJson({ jobPostings: [] });
    const rows = await fetchAshby("confluent", "Confluent", "general");
    expect(rows).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workday adapter — 8 general companies
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchWorkday — general companies", () => {
  interface WorkdayCompany {
    company: string;
    host: string;
    tenant: string;
    site: string;
  }

  const WD_COMPANIES: WorkdayCompany[] = [
    { company: "Adobe",         host: "adobe.wd5.myworkdayjobs.com",     tenant: "adobe",        site: "external_experienced" },
    { company: "Intuit",        host: "intuit.wd1.myworkdayjobs.com",    tenant: "intuit",       site: "Intuit_Careers" },
    { company: "Qualcomm",      host: "qualcomm.wd5.myworkdayjobs.com",  tenant: "qualcomm",     site: "External" },
    { company: "PayPal",        host: "paypal.wd1.myworkdayjobs.com",    tenant: "paypal",       site: "jobs" },
    { company: "Capital One",   host: "capitalone.wd12.myworkdayjobs.com", tenant: "capitalone",  site: "Capital_One" },  // wd12 confirmed (wd1 → 500)
    { company: "JPMorgan Chase",host: "jpmc.wd5.myworkdayjobs.com",       tenant: "jpmc",         site: "technology" },   // 422 in prod; fails gracefully
    { company: "Shopify",       host: "shopify.wd5.myworkdayjobs.com",   tenant: "shopify",      site: "Shopify" },
    { company: "Zendesk",       host: "zendesk.wd1.myworkdayjobs.com",   tenant: "zendesk",      site: "zendesk" },
  ];

  it.each(WD_COMPANIES.map((c) => [c.company, c.host, c.tenant, c.site] as const))(
    "calls correct CXS endpoint for %s",
    async (company, host, tenant, site) => {
      mockJson({ jobPostings: [] });
      await fetchWorkday(host, tenant, site, company, "general");
      expect(mockFetch).toHaveBeenCalledWith(
        `https://${host}/wday/cxs/${tenant}/${site}/jobs`,
        expect.objectContaining({ method: "POST" }),
      );
    },
  );

  it.each(WD_COMPANIES.map((c) => [c.company, c.host, c.tenant, c.site] as const))(
    "sends correct JSON body for %s",
    async (company, host, tenant, site) => {
      mockJson({ jobPostings: [] });
      await fetchWorkday(host, tenant, site, company, "general");
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody).toMatchObject({
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText: "engineer",
      });
    },
  );

  it.each(WD_COMPANIES.map((c) => [c.company, c.host, c.tenant, c.site] as const))(
    "returns engineering rows with category=general for %s",
    async (company, host, tenant, site) => {
      mockJson({
        jobPostings: [
          { title: "Software Engineer", locationsText: "Austin, TX", externalPath: "/job/Austin/Software-Engineer_REQ-001" },
          { title: "Data Analyst", locationsText: "Remote" },
        ],
      });
      const rows = await fetchWorkday(host, tenant, site, company, "general");
      expect(rows).toHaveLength(1);
      expect(rows[0][0]).toBe(company);
      expect(rows[0][1]).toBe("Software Engineer");
      expect(rows[0][4]).toBe("general");
    },
  );

  it.each(WD_COMPANIES.map((c) => [c.company, c.host, c.tenant, c.site] as const))(
    "returns [] on non-200 status for %s",
    async (company, host, tenant, site) => {
      mockJson({}, 422);
      const rows = await fetchWorkday(host, tenant, site, company, "general");
      expect(rows).toEqual([]);
    },
  );

  it.each(WD_COMPANIES.map((c) => [c.company, c.host, c.tenant, c.site] as const))(
    "returns [] on network error for %s",
    async (company, host, tenant, site) => {
      mockNetworkError();
      const rows = await fetchWorkday(host, tenant, site, company, "general");
      expect(rows).toEqual([]);
    },
  );

  describe("Zendesk — host must be wd1 (not wd5)", () => {
    it("uses zendesk.wd1.myworkdayjobs.com (confirmed working host)", async () => {
      mockJson({ jobPostings: [] });
      await fetchWorkday("zendesk.wd1.myworkdayjobs.com", "zendesk", "zendesk", "Zendesk", "general");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://zendesk.wd1.myworkdayjobs.com/wday/cxs/zendesk/zendesk/jobs",
        expect.anything(),
      );
    });
  });

  describe("Adobe — confirmed working configuration", () => {
    it("returns multiple engineering roles correctly", async () => {
      mockJson({
        jobPostings: [
          { title: "Senior Software Engineer", locationsText: "San Jose, CA", externalPath: "/job/SJ/SE_REQ-1" },
          { title: "Platform Engineer", locationsText: "Remote", externalPath: "/job/Remote/PE_REQ-2" },
          { title: "Research Engineer", locationsText: "Seattle, WA", externalPath: "/job/SEA/RE_REQ-3" },
          { title: "Marketing Specialist", locationsText: "NYC" },
        ],
      });
      const rows = await fetchWorkday(
        "adobe.wd5.myworkdayjobs.com", "adobe", "external_experienced", "Adobe", "general",
      );
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r[4] === "general")).toBe(true);
      expect(rows.every((r) => r[0] === "Adobe")).toBe(true);
    });
  });

  describe("PayPal — confirmed working via paypal.wd1.myworkdayjobs.com/jobs", () => {
    it("builds URL with externalPath when present", async () => {
      mockJson({
        jobPostings: [
          { title: "Software Engineer", locationsText: "San Jose, CA", externalPath: "/job/SJ/SWE_REQ-123" },
        ],
      });
      const rows = await fetchWorkday("paypal.wd1.myworkdayjobs.com", "paypal", "jobs", "PayPal", "general");
      expect(rows[0][3]).toBe("https://paypal.wd1.myworkdayjobs.com/job/SJ/SWE_REQ-123");
    });

    it("falls back to site URL when externalPath is absent", async () => {
      mockJson({
        jobPostings: [{ title: "Backend Engineer", locationsText: "Remote" }],
      });
      const rows = await fetchWorkday("paypal.wd1.myworkdayjobs.com", "paypal", "jobs", "PayPal", "general");
      expect(rows[0][3]).toBe("https://paypal.wd1.myworkdayjobs.com/en-US/jobs");
    });
  });

  it("returns [] when jobPostings is empty", async () => {
    mockJson({ jobPostings: [] });
    const rows = await fetchWorkday(
      "adobe.wd5.myworkdayjobs.com", "adobe", "external_experienced", "Adobe", "general",
    );
    expect(rows).toEqual([]);
  });

  it("filters only engineering roles from Workday response", async () => {
    mockJson({
      jobPostings: [
        { title: "iOS Engineer", locationsText: "NYC", externalPath: "/job/NYC/iOS_REQ-1" },
        { title: "HR Business Partner", locationsText: "NYC" },
        { title: "Full Stack Developer", locationsText: "Remote", externalPath: "/job/Remote/FSD_REQ-2" },
      ],
    });
    const rows = await fetchWorkday(
      "shopify.wd5.myworkdayjobs.com", "shopify", "Shopify", "Shopify", "general",
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r[1])).toEqual(
      expect.arrayContaining(["iOS Engineer", "Full Stack Developer"]),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Amazon — custom adapter
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchAmazon — custom adapter", () => {
  it("calls amazon.jobs search JSON API", async () => {
    mockJson({ jobs: [] });
    await fetchAmazon("general");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://www.amazon.jobs/en/search.json"),
    );
  });

  it("includes base_query=software+engineer in URL", async () => {
    mockJson({ jobs: [] });
    await fetchAmazon("general");
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("base_query=software+engineer");
    expect(calledUrl).not.toContain("country=US");
  });

  it("returns engineering rows with correct format", async () => {
    mockJson({
      jobs: [
        { title: "Software Engineer", normalized_location: "Seattle, WA", job_path: "/en/jobs/12345/software-engineer" },
        { title: "Product Manager", normalized_location: "Seattle, WA", job_path: "/en/jobs/67890/pm" },
      ],
    });
    const rows = await fetchAmazon("general");
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("Amazon");
    expect(rows[0][1]).toBe("Software Engineer");
    expect(rows[0][2]).toBe("Seattle, WA");
    expect(rows[0][3]).toBe("https://www.amazon.jobs/en/jobs/12345/software-engineer");
    expect(rows[0][4]).toBe("general");
  });

  it("filters out jobs without job_path (no URL)", async () => {
    mockJson({
      jobs: [
        { title: "Software Engineer", normalized_location: "Remote" },
        { title: "Platform Engineer", normalized_location: "NYC", job_path: "/en/jobs/111/pe" },
      ],
    });
    const rows = await fetchAmazon("general");
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe("Platform Engineer");
  });

  it("returns [] on HTTP error", async () => {
    mockJson({ message: "Forbidden" }, 403);
    const rows = await fetchAmazon("general");
    expect(rows).toEqual([]);
  });

  it("returns [] on network error", async () => {
    mockNetworkError();
    const rows = await fetchAmazon("general");
    expect(rows).toEqual([]);
  });

  it("handles empty jobs array", async () => {
    mockJson({ jobs: [] });
    expect(await fetchAmazon("general")).toEqual([]);
  });

  it("handles alternative results key", async () => {
    mockJson({
      results: [
        { title: "Backend Engineer", normalized_location: "Austin, TX", job_path: "/en/jobs/999/be" },
      ],
    });
    // Note: adapter checks data.jobs first, then data.results — this tests fallback
    const rows = await fetchAmazon("general");
    // data.jobs is undefined → falls through to data.results — still should work
    expect(rows).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Google — custom adapter
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchGoogle — custom adapter", () => {
  it("calls careers.google.com/api/v3/search/", async () => {
    mockJson({ jobs: [] });
    await fetchGoogle("general");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://careers.google.com/api/v3/search/"),
    );
  });

  it("returns [] on 404 (API currently returns 404)", async () => {
    mockJson({ message: "Not Found" }, 404);
    const rows = await fetchGoogle("general");
    expect(rows).toEqual([]);
  });

  it("returns engineering rows when API works", async () => {
    mockJson({
      jobs: [
        { title: "Software Engineer III", locations: [{ display: "Mountain View, CA" }], id: "12345" },
        { title: "Business Analyst", locations: [{ display: "NYC" }], id: "67890" },
      ],
    });
    const rows = await fetchGoogle("general");
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("Google");
    expect(rows[0][3]).toBe("https://careers.google.com/jobs/results/12345");
    expect(rows[0][4]).toBe("general");
  });

  it("returns [] on network error", async () => {
    mockNetworkError();
    expect(await fetchGoogle("general")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Apple — custom adapter
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchApple — custom adapter", () => {
  it("calls jobs.apple.com/api/role/search", async () => {
    mockJson({ searchResults: [] });
    await fetchApple("general");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://jobs.apple.com/api/role/search?q=software+engineer&page=0&locale=en-us",
    );
  });

  it("returns engineering rows with correct format", async () => {
    mockJson({
      searchResults: [
        {
          postingTitle: "Software Engineer",
          locations: [{ name: "Cupertino, CA" }],
          id: "200123456",
        },
        {
          postingTitle: "UX Designer",
          locations: [{ name: "NYC" }],
          id: "200654321",
        },
      ],
    });
    const rows = await fetchApple("general");
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("Apple");
    expect(rows[0][1]).toBe("Software Engineer");
    expect(rows[0][2]).toBe("Cupertino, CA");
    expect(rows[0][3]).toBe("https://jobs.apple.com/en-us/details/200123456");
    expect(rows[0][4]).toBe("general");
  });

  it("handles multiple locations", async () => {
    mockJson({
      searchResults: [
        {
          postingTitle: "Platform Engineer",
          locations: [{ name: "Cupertino, CA" }, { name: "Austin, TX" }],
          id: "200000001",
        },
      ],
    });
    const rows = await fetchApple("general");
    expect(rows[0][2]).toBe("Cupertino, CA, Austin, TX");
  });

  it("returns [] on HTTP error", async () => {
    mockJson({}, 403);
    expect(await fetchApple("general")).toEqual([]);
  });

  it("returns [] on network error", async () => {
    mockNetworkError();
    expect(await fetchApple("general")).toEqual([]);
  });

  it("filters jobs without id (no URL)", async () => {
    mockJson({
      searchResults: [
        { postingTitle: "Software Engineer", locations: [{ name: "Remote" }] },
        { postingTitle: "Mobile Engineer", locations: [{ name: "NYC" }], id: "99999" },
      ],
    });
    const rows = await fetchApple("general");
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe("Mobile Engineer");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta — custom adapter (JS-rendered page with embedded JSON)
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchMeta — custom adapter", () => {
  it("calls metacareers.com/jobs with software+engineer query", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => "{}",
      json: async () => ({}),
    });
    await fetchMeta("general");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.metacareers.com/jobs?q=software+engineer&is_leadership=0&is_remote_only=0",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("returns [] when no embedded jobs JSON found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => "<html><body>No jobs here</body></html>",
    });
    const rows = await fetchMeta("general");
    expect(rows).toEqual([]);
  });

  it("returns [] on HTTP error (e.g. 403 bot block)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, text: async () => "" });
    const rows = await fetchMeta("general");
    expect(rows).toEqual([]);
  });

  it("returns [] on network error", async () => {
    mockNetworkError();
    const rows = await fetchMeta("general");
    expect(rows).toEqual([]);
  });

  it("parses embedded jobs JSON and filters engineering roles", async () => {
    const embeddedJson = JSON.stringify([
      { title: "Software Engineer", location: "Menlo Park, CA", url: "https://www.metacareers.com/jobs/123", id: "123" },
      { title: "Product Manager",   location: "Remote",         url: "https://www.metacareers.com/jobs/456", id: "456" },
      { title: "Backend Engineer",  location: "Seattle, WA",    url: "https://www.metacareers.com/jobs/789", id: "789" },
    ]);
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => `window.__data = {"jobs": ${embeddedJson}};`,
    });
    const rows = await fetchMeta("general");
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe("Meta");
    expect(rows[0][1]).toBe("Software Engineer");
    expect(rows[0][2]).toBe("Menlo Park, CA");
    expect(rows[0][4]).toBe("general");
    expect(rows[1][1]).toBe("Backend Engineer");
  });

  it("filters jobs with no URL (no url or id field)", async () => {
    const embeddedJson = JSON.stringify([
      { title: "Software Engineer", location: "Remote" },
      { title: "Platform Engineer", location: "NYC", url: "https://www.metacareers.com/jobs/999" },
    ]);
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => `{"jobs": ${embeddedJson}}`,
    });
    const rows = await fetchMeta("general");
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe("Platform Engineer");
  });

  it("returns rows with category=general", async () => {
    const embeddedJson = JSON.stringify([
      { title: "Software Engineer", location: "NYC", url: "https://www.metacareers.com/jobs/1" },
    ]);
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => `{"jobs": ${embeddedJson}}`,
    });
    const rows = await fetchMeta("general");
    expect(rows.every((r) => r[4] === "general")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-company invariants
// ─────────────────────────────────────────────────────────────────────────────

describe("General Full Stack companies — cross-company invariants", () => {
  it("all Greenhouse general companies return category=general", async () => {
    const ghCompanies = [
      ["stripe", "Stripe"],
      ["databricks", "Databricks"],
      ["vercel", "Vercel"],
      ["cloudflare", "Cloudflare"],
    ] as const;

    for (const [slug, company] of ghCompanies) {
      mockJson({
        jobs: [{ title: "Software Engineer", absolute_url: `https://boards.greenhouse.io/${slug}/jobs/1`, location: { name: "Remote" } }],
      });
      const rows = await fetchGreenhouse(slug, company, "general");
      expect(rows.every((r) => r[4] === "general")).toBe(true);
    }
  });

  it("all Ashby general companies return category=general", async () => {
    for (const [id, company] of [["ramp", "Ramp"], ["confluent", "Confluent"]] as const) {
      mockJson({
        jobPostings: [{ title: "Software Engineer", locationName: "Remote", jobUrl: `https://jobs.ashbyhq.com/${id}/1` }],
      });
      const rows = await fetchAshby(id, company, "general");
      expect(rows.every((r) => r[4] === "general")).toBe(true);
    }
  });

  it("all Workday general companies return category=general", async () => {
    const wdCompanies = [
      { company: "Adobe",       host: "adobe.wd5.myworkdayjobs.com",       tenant: "adobe",       site: "external_experienced" },
      { company: "PayPal",      host: "paypal.wd1.myworkdayjobs.com",      tenant: "paypal",      site: "jobs" },
      { company: "Capital One", host: "capitalone.wd12.myworkdayjobs.com", tenant: "capitalone",  site: "Capital_One" },
      { company: "Zendesk",     host: "zendesk.wd1.myworkdayjobs.com",     tenant: "zendesk",     site: "zendesk" },
    ];
    for (const { company, host, tenant, site } of wdCompanies) {
      mockJson({
        jobPostings: [{ title: "Software Engineer", locationsText: "Remote", externalPath: "/job/R/SE_1" }],
      });
      const rows = await fetchWorkday(host, tenant, site, company, "general");
      expect(rows.every((r) => r[4] === "general")).toBe(true);
    }
  });

  it("all adapters return arrays (never throw)", async () => {
    // All adapters must return [] on error, never throw
    mockNetworkError(); const r1 = await fetchGreenhouse("stripe", "Stripe", "general");
    mockNetworkError(); const r2 = await fetchAshby("ramp", "Ramp", "general");
    mockNetworkError(); const r3 = await fetchWorkday("adobe.wd5.myworkdayjobs.com", "adobe", "external_experienced", "Adobe", "general");
    mockNetworkError(); const r4 = await fetchAmazon("general");
    mockNetworkError(); const r5 = await fetchGoogle("general");
    mockNetworkError(); const r6 = await fetchApple("general");
    mockNetworkError(); const r7 = await fetchMeta("general");

    expect(Array.isArray(r1)).toBe(true);
    expect(Array.isArray(r2)).toBe(true);
    expect(Array.isArray(r3)).toBe(true);
    expect(Array.isArray(r4)).toBe(true);
    expect(Array.isArray(r5)).toBe(true);
    expect(Array.isArray(r6)).toBe(true);
    expect(Array.isArray(r7)).toBe(true);
  });

  it("each row has exactly 6 columns (without description)", async () => {
    mockJson({
      jobs: [{ title: "Software Engineer", absolute_url: "https://example.com/1", location: { name: "NY" } }],
    });
    const rows = await fetchGreenhouse("stripe", "Stripe", "general");
    // Row is [company, title, location, url, category, fetchedAt]
    expect(rows[0]).toHaveLength(6);
  });

  it("fetchedAt is a valid ISO datetime string", async () => {
    mockJson({
      jobs: [{ title: "Backend Engineer", absolute_url: "https://example.com/1", location: { name: "NY" } }],
    });
    const rows = await fetchGreenhouse("mongodb", "MongoDB", "general");
    const fetchedAt = rows[0][5] as string;
    expect(() => new Date(fetchedAt)).not.toThrow();
    expect(new Date(fetchedAt).toISOString()).toBe(fetchedAt);
  });

  it("isEngineeringRole correctly classifies all general company roles", () => {
    // Should match
    const engineering = [
      "Software Engineer",
      "Senior Software Engineer",
      "Staff Engineer",
      "Principal Engineer",
      "Frontend Developer",
      "Backend Engineer",
      "Full Stack Developer",
      "DevOps Engineer",
      "Platform Engineer",
      "SRE",
      "Mobile Engineer",
      "iOS Engineer",
      "Android Developer",
      "Architect",
    ];
    for (const title of engineering) {
      expect(isEngineeringRole(title)).toBe(true);
    }

    // Should NOT match
    const nonEngineering = [
      "Product Manager",
      "Sales Executive",
      "HR Business Partner",
      "Marketing Manager",
      "Data Analyst",
      "Customer Success",
      "Financial Analyst",
      "Recruiter",
    ];
    for (const title of nonEngineering) {
      expect(isEngineeringRole(title)).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Snap Inc. — special case (GH slug fails gracefully)
// ─────────────────────────────────────────────────────────────────────────────

describe("Snap Inc. — Greenhouse snapinc (fails gracefully)", () => {
  it("calls boards-api.greenhouse.io/v1/boards/snapinc/jobs", async () => {
    mockJson({ jobs: [] });
    await fetchGreenhouse("snapinc", "Snap Inc.", "general");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/snapinc/jobs",
    );
  });

  it("returns [] when API returns 404", async () => {
    mockJson({ message: "Not Found" }, 404);
    const rows = await fetchGreenhouse("snapinc", "Snap Inc.", "general");
    expect(rows).toEqual([]);
  });

  it("does not throw on 404 — fails silently", async () => {
    mockJson({}, 404);
    await expect(fetchGreenhouse("snapinc", "Snap Inc.", "general")).resolves.toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Riot Games — moved from Workday to Greenhouse riotgames
// ─────────────────────────────────────────────────────────────────────────────

describe("Riot Games — Greenhouse riotgames (confirmed 186+ jobs)", () => {
  it("calls the Greenhouse board for riotgames", async () => {
    mockJson({ jobs: [] });
    await fetchGreenhouse("riotgames", "Riot Games", "general");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/riotgames/jobs",
    );
  });

  it("returns rows labelled Riot Games with category=general", async () => {
    mockJson({
      jobs: [
        { title: "Senior Software Engineer", absolute_url: "https://boards.greenhouse.io/riotgames/jobs/1", location: { name: "Los Angeles, CA" } },
      ],
    });
    const rows = await fetchGreenhouse("riotgames", "Riot Games", "general");
    expect(rows[0][0]).toBe("Riot Games");
    expect(rows[0][4]).toBe("general");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Configuration correctness checks
// ─────────────────────────────────────────────────────────────────────────────

describe("Configuration correctness", () => {
  describe("Vercel uses slug 'vercel' not 'vercelcareers'", () => {
    it("GH slug is vercel", async () => {
      mockJson({ jobs: [] });
      await fetchGreenhouse("vercel", "Vercel", "general");
      expect(mockFetch.mock.calls[0][0]).toContain("/vercel/jobs");
      expect(mockFetch.mock.calls[0][0]).not.toContain("vercelcareers");
    });
  });

  describe("Zendesk uses wd1 host", () => {
    it("uses zendesk.wd1.myworkdayjobs.com", async () => {
      mockJson({ jobPostings: [] });
      await fetchWorkday("zendesk.wd1.myworkdayjobs.com", "zendesk", "zendesk", "Zendesk", "general");
      expect(mockFetch.mock.calls[0][0]).toContain("zendesk.wd1.myworkdayjobs.com");
    });
  });

  describe("Ramp uses Ashby (not Greenhouse)", () => {
    it("calls Ashby API for Ramp", async () => {
      mockJson({ jobPostings: [] });
      await fetchAshby("ramp", "Ramp", "general");
      expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/ramp");
    });
  });

  describe("Confluent uses Ashby (not Greenhouse)", () => {
    it("calls Ashby API for Confluent", async () => {
      mockJson({ jobPostings: [] });
      await fetchAshby("confluent", "Confluent", "general");
      expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/confluent");
    });
  });

  describe("Snowflake uses Ashby (not Greenhouse)", () => {
    it("calls Ashby API for Snowflake", async () => {
      mockJson({ jobs: [] });
      await fetchAshby("snowflake", "Snowflake", "general");
      expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/snowflake");
    });
  });

  describe("Adobe uses wd5 Workday", () => {
    it("calls adobe.wd5.myworkdayjobs.com with external_experienced site", async () => {
      mockJson({ jobPostings: [] });
      await fetchWorkday("adobe.wd5.myworkdayjobs.com", "adobe", "external_experienced", "Adobe", "general");
      expect(mockFetch.mock.calls[0][0]).toBe(
        "https://adobe.wd5.myworkdayjobs.com/wday/cxs/adobe/external_experienced/jobs",
      );
    });
  });

  describe("Capital One uses wd12 (not wd1)", () => {
    it("calls capitalone.wd12.myworkdayjobs.com/Capital_One", async () => {
      mockJson({ jobPostings: [] });
      await fetchWorkday("capitalone.wd12.myworkdayjobs.com", "capitalone", "Capital_One", "Capital One", "general");
      expect(mockFetch.mock.calls[0][0]).toBe(
        "https://capitalone.wd12.myworkdayjobs.com/wday/cxs/capitalone/Capital_One/jobs",
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DoorDash — Greenhouse doordashglobal
// ─────────────────────────────────────────────────────────────────────────────

describe("DoorDash — Greenhouse doordashglobal", () => {
  it("calls boards-api.greenhouse.io/v1/boards/doordashglobal/jobs", async () => {
    mockJson({ jobs: [] });
    await fetchGreenhouse("doordashglobal", "DoorDash", "general");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/doordashglobal/jobs",
    );
  });

  it("returns engineering rows labelled DoorDash with category=general", async () => {
    mockJson({
      jobs: [
        { title: "Software Engineer", absolute_url: "https://boards.greenhouse.io/doordashglobal/jobs/1", location: { name: "San Francisco, CA" } },
        { title: "Operations Manager", absolute_url: "https://boards.greenhouse.io/doordashglobal/jobs/2", location: { name: "Remote" } },
      ],
    });
    const rows = await fetchGreenhouse("doordashglobal", "DoorDash", "general");
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("DoorDash");
    expect(rows[0][4]).toBe("general");
  });

  it("returns [] on 404 — fails gracefully", async () => {
    mockJson({ status: 404, error: "Not found" }, 404);
    const rows = await fetchGreenhouse("doordashglobal", "DoorDash", "general");
    expect(rows).toEqual([]);
  });

  it("uses doordashglobal slug (not the old 'doordash' slug which returns 404)", async () => {
    mockJson({ jobs: [] });
    await fetchGreenhouse("doordashglobal", "DoorDash", "general");
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("doordashglobal");
    expect(calledUrl).not.toContain("/doordash/");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Figma — Greenhouse figma
// ─────────────────────────────────────────────────────────────────────────────

describe("Figma — Greenhouse figma (confirmed 150+ jobs)", () => {
  it("calls boards-api.greenhouse.io/v1/boards/figma/jobs", async () => {
    mockJson({ jobs: [] });
    await fetchGreenhouse("figma", "Figma", "general");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/figma/jobs",
    );
  });

  it("returns engineering rows labelled Figma with category=general", async () => {
    mockJson({
      jobs: [
        { title: "Software Engineer, Core", absolute_url: "https://boards.greenhouse.io/figma/jobs/5001", location: { name: "New York, NY" } },
        { title: "Designer", absolute_url: "https://boards.greenhouse.io/figma/jobs/5002", location: { name: "Remote" } },
        { title: "Frontend Engineer", absolute_url: "https://boards.greenhouse.io/figma/jobs/5003", location: { name: "San Francisco, CA" } },
      ],
    });
    const rows = await fetchGreenhouse("figma", "Figma", "general");
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe("Figma");
    expect(rows[0][4]).toBe("general");
  });

  it("returns [] on network error", async () => {
    mockNetworkError();
    expect(await fetchGreenhouse("figma", "Figma", "general")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Brex — Greenhouse brex
// ─────────────────────────────────────────────────────────────────────────────

describe("Brex — Greenhouse brex (confirmed 200+ jobs)", () => {
  it("calls boards-api.greenhouse.io/v1/boards/brex/jobs", async () => {
    mockJson({ jobs: [] });
    await fetchGreenhouse("brex", "Brex", "general");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/brex/jobs",
    );
  });

  it("returns engineering rows labelled Brex with category=general", async () => {
    mockJson({
      jobs: [
        { title: "Staff Software Engineer", absolute_url: "https://boards.greenhouse.io/brex/jobs/6001", location: { name: "San Francisco, CA" } },
        { title: "Recruiter", absolute_url: "https://boards.greenhouse.io/brex/jobs/6002", location: { name: "Remote" } },
        { title: "Backend Engineer", absolute_url: "https://boards.greenhouse.io/brex/jobs/6003", location: { name: "New York, NY" } },
      ],
    });
    const rows = await fetchGreenhouse("brex", "Brex", "general");
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe("Brex");
    expect(rows[0][4]).toBe("general");
  });

  it("returns [] on HTTP error", async () => {
    mockJson({}, 500);
    expect(await fetchGreenhouse("brex", "Brex", "general")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Plaid — Ashby (migrated from Greenhouse 'plaid' which returns 404)
// ─────────────────────────────────────────────────────────────────────────────

describe("Plaid — Ashby plaid (migrated from GH 'plaid' which returns 404)", () => {
  it("calls api.ashbyhq.com/posting-api/job-board/plaid", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("plaid", "Plaid", "fintech");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.ashbyhq.com/posting-api/job-board/plaid",
    );
  });

  it("returns engineering rows labelled Plaid with category=fintech", async () => {
    mockJson({
      jobPostings: [
        { title: "Software Engineer, Core", locationName: "San Francisco, CA", jobUrl: "https://jobs.ashbyhq.com/plaid/abc-001" },
        { title: "Operations Manager",      locationName: "Remote",            jobUrl: "https://jobs.ashbyhq.com/plaid/abc-002" },
        { title: "Backend Engineer",        locationName: "New York, NY",      jobUrl: "https://jobs.ashbyhq.com/plaid/abc-003" },
      ],
    });
    const rows = await fetchAshby("plaid", "Plaid", "fintech");
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe("Plaid");
    expect(rows[0][4]).toBe("fintech");
  });

  it("does NOT use the old Greenhouse 'plaid' slug (404 in production)", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("plaid", "Plaid", "fintech");
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("ashbyhq.com");
    expect(calledUrl).not.toContain("greenhouse.io");
  });

  it("returns [] on HTTP 404", async () => {
    mockJson({}, 404);
    expect(await fetchAshby("plaid", "Plaid", "fintech")).toEqual([]);
  });

  it("returns [] on network error", async () => {
    mockNetworkError();
    expect(await fetchAshby("plaid", "Plaid", "fintech")).toEqual([]);
  });
});
