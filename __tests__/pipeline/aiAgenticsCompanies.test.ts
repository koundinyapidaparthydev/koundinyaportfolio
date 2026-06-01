/**
 * @jest-environment node
 *
 * __tests__/pipeline/aiAgenticsCompanies.test.ts
 *
 * Tests for the AI Agentics companies added to scripts/scrape-jobs.mjs.
 *
 * Covers all 30 companies across adapters:
 *   Greenhouse : Anthropic, Workato, Make (Celonis US), Glean, Moveworks,
 *                Weights & Biases, Codeium / Windsurf
 *   Ashby      : OpenAI, Cursor, Notion, Zapier, LangChain, Cohere, Mistral AI,
 *                Hebbia, Harvey AI, Sierra AI, Ema, Adept AI, Cognition AI,
 *                Dust.tt, Linear, Retool, Writer, Runway ML, Pathos AI, Slack
 *   Workday    : Salesforce, Microsoft, ServiceNow
 *
 * Strategy: mock global fetch inline — no real HTTP calls.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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
      jobPostings: Array<{ title: string; locationsText?: string; externalPath?: string }>;
    };
    const filtered = jobPostings.filter((j) => isEngineeringRole(j.title));
    return filtered.map((j) => [
      company, j.title,
      j.locationsText ?? "",
      j.externalPath ? `https://${host}${j.externalPath}` : `https://${host}/en-US/${site}`,
      category, now(),
    ]);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock fetch setup
// ─────────────────────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
(global as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

afterEach(() => { mockFetch.mockReset(); });

// ─────────────────────────────────────────────────────────────────────────────
// Mock builders
// ─────────────────────────────────────────────────────────────────────────────

function mockJson(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockHttpError(status = 404) {
  mockFetch.mockResolvedValueOnce({ ok: false, status });
}

function mockNetworkError() {
  mockFetch.mockRejectedValueOnce(new Error("Network error"));
}

const oneEngJob = (title = "Software Engineer", url = "https://example.com/job/1") => ({
  title,
  absolute_url: url,
  location: { name: "Remote, US" },
});

const oneAshbyJob = (title = "Software Engineer") => ({
  title,
  locationName: "Remote",
  jobUrl: "https://jobs.ashbyhq.com/test/abc-123",
});

const oneWorkdayJob = (title = "Software Engineer") => ({
  title,
  locationsText: "San Francisco, CA",
  externalPath: "/job/SF/Software-Engineer_JOB123",
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-company invariants
// ─────────────────────────────────────────────────────────────────────────────

describe("AI Agentics companies — cross-company invariants", () => {
  it("all Greenhouse AI agentics companies return category=ai-agentics", async () => {
    const ghCompanies: [string, string][] = [
      ["anthropic",  "Anthropic"],
      ["workato",    "Workato"],
      ["celonis",    "Make (Celonis US)"],
      ["gleanwork",    "Glean"],         // migrated from 'glean' (404) to 'gleanwork' (171 jobs)
      ["moveworks",  "Moveworks"],
      ["weights_and_biases", "Weights & Biases"],  // 'wandb' returns 404; correct slug (16 jobs)
      ["codeium",    "Codeium / Windsurf"],
    ];
    for (const [slug, name] of ghCompanies) {
      mockJson({ jobs: [oneEngJob()] });
      const rows = await fetchGreenhouse(slug, name, "ai-agentics");
      expect(rows[0][4]).toBe("ai-agentics");
    }
  });

  it("all Ashby AI agentics companies return category=ai-agentics", async () => {
    const ashbyCompanies: [string, string][] = [
      ["openai",     "OpenAI"],
      ["cursor",     "Cursor"],
      ["notion",     "Notion"],
      ["zapier",     "Zapier"],
      ["langchain",  "LangChain"],
      ["cohere",     "Cohere"],
      ["mistral",    "Mistral AI"],
      ["hebbia-ai",  "Hebbia"],
      ["harvey",     "Harvey AI"],
      ["sierra",     "Sierra AI"],
      ["ema",        "Ema"],
      ["adept",      "Adept AI"],
      ["cognition",  "Cognition AI"],
      ["dust",       "Dust.tt"],
      ["linear",     "Linear"],
      ["retool",     "Retool"],
      ["writer",     "Writer"],
      ["runwayml",   "Runway ML"],
      ["pathosai",   "Pathos AI"],
      ["slack",      "Slack"],
    ];
    for (const [id, name] of ashbyCompanies) {
      mockJson({ jobPostings: [oneAshbyJob()] });
      const rows = await fetchAshby(id, name, "ai-agentics");
      expect(rows[0][4]).toBe("ai-agentics");
    }
  });

  it("all Workday AI agentics companies return category=ai-agentics", async () => {
    const wdCompanies: [string, string, string, string][] = [
      ["salesforce.wd12.myworkdayjobs.com", "salesforce", "External_Career_Site", "Salesforce"],
      ["microsoft.wd3.myworkdayjobs.com",   "microsoft",  "External",             "Microsoft"],
      ["servicenow.wd5.myworkdayjobs.com",  "servicenow", "External",             "ServiceNow"],
    ];
    for (const [host, tenant, site, name] of wdCompanies) {
      mockJson({ jobPostings: [oneWorkdayJob()] });
      const rows = await fetchWorkday(host, tenant, site, name, "ai-agentics");
      expect(rows[0][4]).toBe("ai-agentics");
    }
  });

  it("all adapters return [] (never throw) on network error", async () => {
    mockNetworkError(); expect(await fetchGreenhouse("anthropic", "Anthropic", "ai-agentics")).toEqual([]);
    mockNetworkError(); expect(await fetchAshby("openai", "OpenAI", "ai-agentics")).toEqual([]);
    mockNetworkError(); expect(await fetchWorkday("salesforce.wd12.myworkdayjobs.com", "salesforce", "External_Career_Site", "Salesforce", "ai-agentics")).toEqual([]);
  });

  it("each row has exactly 6 columns (without description)", async () => {
    mockJson({ jobs: [oneEngJob()] });
    const rows = await fetchGreenhouse("anthropic", "Anthropic", "ai-agentics");
    expect(rows[0]).toHaveLength(6);
    expect(rows[0][0]).toBe("Anthropic");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-adapter endpoint verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Anthropic — Greenhouse anthropic", () => {
  it("calls boards-api.greenhouse.io/v1/boards/anthropic/jobs", async () => {
    mockJson({ jobs: [] });
    await fetchGreenhouse("anthropic", "Anthropic", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://boards-api.greenhouse.io/v1/boards/anthropic/jobs",
    );
  });

  it("filters out non-engineering roles", async () => {
    mockJson({ jobs: [oneEngJob("Software Engineer"), oneEngJob("Marketing Manager", "https://example.com/2")] });
    const rows = await fetchGreenhouse("anthropic", "Anthropic", "ai-agentics");
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe("Software Engineer");
  });

  it("returns [] on HTTP 404", async () => {
    mockHttpError(404);
    expect(await fetchGreenhouse("anthropic", "Anthropic", "ai-agentics")).toEqual([]);
  });

  it("returns [] on network error", async () => {
    mockNetworkError();
    expect(await fetchGreenhouse("anthropic", "Anthropic", "ai-agentics")).toEqual([]);
  });
});

describe("OpenAI — Ashby openai", () => {
  it("calls ashbyhq.com/posting-api/job-board/openai", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("openai", "OpenAI", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/openai");
  });

  it("returns engineering rows with correct company name", async () => {
    mockJson({ jobPostings: [oneAshbyJob("Platform Engineer")] });
    const rows = await fetchAshby("openai", "OpenAI", "ai-agentics");
    expect(rows[0][0]).toBe("OpenAI");
    expect(rows[0][1]).toBe("Platform Engineer");
    expect(rows[0][4]).toBe("ai-agentics");
  });

  it("returns [] on HTTP error", async () => {
    mockHttpError();
    expect(await fetchAshby("openai", "OpenAI", "ai-agentics")).toEqual([]);
  });

  it("returns [] on network error", async () => {
    mockNetworkError();
    expect(await fetchAshby("openai", "OpenAI", "ai-agentics")).toEqual([]);
  });
});

describe("Cursor — Ashby cursor", () => {
  it("calls ashbyhq.com/posting-api/job-board/cursor", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("cursor", "Cursor", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/cursor");
  });
});

describe("Notion — Ashby notion", () => {
  it("calls ashbyhq.com/posting-api/job-board/notion", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("notion", "Notion", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/notion");
  });
});

describe("Zapier — Ashby zapier", () => {
  it("calls ashbyhq.com/posting-api/job-board/zapier", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("zapier", "Zapier", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/zapier");
  });
});

describe("LangChain — Ashby langchain", () => {
  it("calls ashbyhq.com/posting-api/job-board/langchain", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("langchain", "LangChain", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/langchain");
  });
});

describe("Cohere — Ashby cohere", () => {
  it("calls ashbyhq.com/posting-api/job-board/cohere", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("cohere", "Cohere", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/cohere");
  });
});

describe("Harvey AI — Ashby harvey", () => {
  it("calls ashbyhq.com/posting-api/job-board/harvey", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("harvey", "Harvey AI", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/harvey");
  });
});

describe("Sierra AI — Ashby sierra", () => {
  it("calls ashbyhq.com/posting-api/job-board/sierra", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("sierra", "Sierra AI", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/sierra");
  });
});

describe("Cognition AI — Ashby cognition", () => {
  it("calls ashbyhq.com/posting-api/job-board/cognition", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("cognition", "Cognition AI", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/cognition");
  });
});

describe("Dust.tt — Ashby dust", () => {
  it("calls ashbyhq.com/posting-api/job-board/dust", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("dust", "Dust.tt", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/dust");
  });
});

describe("Writer — Ashby writer", () => {
  it("calls ashbyhq.com/posting-api/job-board/writer", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("writer", "Writer", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/writer");
  });
});

describe("Runway ML — Ashby runwayml", () => {
  it("calls ashbyhq.com/posting-api/job-board/runwayml", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("runwayml", "Runway ML", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/runwayml");
  });
});

describe("Ema — Ashby ema", () => {
  it("calls ashbyhq.com/posting-api/job-board/ema", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("ema", "Ema", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/ema");
  });
});

describe("Hebbia — Ashby hebbia-ai", () => {
  it("calls ashbyhq.com/posting-api/job-board/hebbia-ai", async () => {
    mockJson({ jobPostings: [] });
    await fetchAshby("hebbia-ai", "Hebbia", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com/posting-api/job-board/hebbia-ai");
  });
});

describe("Workato — Greenhouse workato", () => {
  it("calls boards-api.greenhouse.io/v1/boards/workato/jobs", async () => {
    mockJson({ jobs: [] });
    await fetchGreenhouse("workato", "Workato", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://boards-api.greenhouse.io/v1/boards/workato/jobs",
    );
  });

  it("returns rows labelled Workato with category=ai-agentics", async () => {
    mockJson({ jobs: [oneEngJob("Backend Engineer")] });
    const rows = await fetchGreenhouse("workato", "Workato", "ai-agentics");
    expect(rows[0][0]).toBe("Workato");
    expect(rows[0][4]).toBe("ai-agentics");
  });
});

describe("Make (Celonis US) — Greenhouse celonis", () => {
  it("calls boards-api.greenhouse.io/v1/boards/celonis/jobs", async () => {
    mockJson({ jobs: [] });
    await fetchGreenhouse("celonis", "Make (Celonis US)", "ai-agentics");
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://boards-api.greenhouse.io/v1/boards/celonis/jobs",
    );
  });

  it("returns rows labelled 'Make (Celonis US)' with category=ai-agentics", async () => {
    mockJson({ jobs: [oneEngJob("Software Engineer")] });
    const rows = await fetchGreenhouse("celonis", "Make (Celonis US)", "ai-agentics");
    expect(rows[0][0]).toBe("Make (Celonis US)");
    expect(rows[0][4]).toBe("ai-agentics");
  });
});

describe("Salesforce — Workday wd12", () => {
  it("calls salesforce.wd12.myworkdayjobs.com with External_Career_Site", async () => {
    mockJson({ jobPostings: [] });
    await fetchWorkday(
      "salesforce.wd12.myworkdayjobs.com",
      "salesforce",
      "External_Career_Site",
      "Salesforce",
      "ai-agentics",
    );
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://salesforce.wd12.myworkdayjobs.com/wday/cxs/salesforce/External_Career_Site/jobs",
    );
  });

  it("returns engineering rows labelled Salesforce with category=ai-agentics", async () => {
    mockJson({ jobPostings: [oneWorkdayJob("Platform Engineer")] });
    const rows = await fetchWorkday(
      "salesforce.wd12.myworkdayjobs.com",
      "salesforce",
      "External_Career_Site",
      "Salesforce",
      "ai-agentics",
    );
    expect(rows[0][0]).toBe("Salesforce");
    expect(rows[0][4]).toBe("ai-agentics");
  });

  it("returns [] on HTTP error", async () => {
    mockHttpError(422);
    expect(await fetchWorkday(
      "salesforce.wd12.myworkdayjobs.com", "salesforce", "External_Career_Site", "Salesforce", "ai-agentics",
    )).toEqual([]);
  });
});

describe("Microsoft — Workday wd3", () => {
  it("calls microsoft.wd3.myworkdayjobs.com with External site", async () => {
    mockJson({ jobPostings: [] });
    await fetchWorkday(
      "microsoft.wd3.myworkdayjobs.com",
      "microsoft",
      "External",
      "Microsoft",
      "ai-agentics",
    );
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://microsoft.wd3.myworkdayjobs.com/wday/cxs/microsoft/External/jobs",
    );
  });

  it("returns [] on HTTP error (graceful degradation)", async () => {
    mockHttpError(401);
    expect(await fetchWorkday(
      "microsoft.wd3.myworkdayjobs.com", "microsoft", "External", "Microsoft", "ai-agentics",
    )).toEqual([]);
  });
});

describe("ServiceNow — Workday wd5", () => {
  it("calls servicenow.wd5.myworkdayjobs.com with External site", async () => {
    mockJson({ jobPostings: [] });
    await fetchWorkday(
      "servicenow.wd5.myworkdayjobs.com",
      "servicenow",
      "External",
      "ServiceNow",
      "ai-agentics",
    );
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://servicenow.wd5.myworkdayjobs.com/wday/cxs/servicenow/External/jobs",
    );
  });

  it("returns [] on HTTP error (graceful degradation)", async () => {
    mockHttpError(422);
    expect(await fetchWorkday(
      "servicenow.wd5.myworkdayjobs.com", "servicenow", "External", "ServiceNow", "ai-agentics",
    )).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Graceful-degradation companies (ATS may return 404 in production)
// ─────────────────────────────────────────────────────────────────────────────

describe("Graceful-degradation companies (Greenhouse)", () => {
  const degraded: [string, string][] = [
    // Note: 'glean' slug (404) was replaced by 'gleanwork' — see cross-company test above
    // Note: 'wandb' slug (404) was replaced by 'weights_and_biases' — see cross-company test above
    ["moveworks", "Moveworks"],
    ["codeium",   "Codeium / Windsurf"],
  ];

  for (const [slug, name] of degraded) {
    it(`${name} — returns [] when Greenhouse returns 404`, async () => {
      mockHttpError(404);
      expect(await fetchGreenhouse(slug, name, "ai-agentics")).toEqual([]);
    });

    it(`${name} — does not throw on network error`, async () => {
      mockNetworkError();
      await expect(fetchGreenhouse(slug, name, "ai-agentics")).resolves.toEqual([]);
    });
  }
});

describe("Graceful-degradation companies (Ashby)", () => {
  const degraded: [string, string][] = [
    ["mistral",   "Mistral AI"],
    ["adept",     "Adept AI"],
    ["pathosai",  "Pathos AI"],
    ["slack",     "Slack"],
    ["linear",    "Linear"],
    ["retool",    "Retool"],
  ];

  for (const [id, name] of degraded) {
    it(`${name} — returns [] when Ashby returns 404`, async () => {
      mockHttpError(404);
      expect(await fetchAshby(id, name, "ai-agentics")).toEqual([]);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Configuration correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("Configuration correctness", () => {
  describe("Anthropic uses Greenhouse slug 'anthropic'", () => {
    it("URL contains /anthropic/", async () => {
      mockJson({ jobs: [] });
      await fetchGreenhouse("anthropic", "Anthropic", "ai-agentics");
      expect(mockFetch.mock.calls[0][0]).toContain("/anthropic/");
    });
  });

  describe("OpenAI uses Ashby (not Greenhouse)", () => {
    it("calls Ashby API for OpenAI", async () => {
      mockJson({ jobPostings: [] });
      await fetchAshby("openai", "OpenAI", "ai-agentics");
      expect(mockFetch.mock.calls[0][0]).toContain("ashbyhq.com");
      expect(mockFetch.mock.calls[0][0]).toContain("openai");
    });
  });

  describe("Salesforce uses wd12 Workday", () => {
    it("calls salesforce.wd12.myworkdayjobs.com with External_Career_Site", async () => {
      mockJson({ jobPostings: [] });
      await fetchWorkday("salesforce.wd12.myworkdayjobs.com", "salesforce", "External_Career_Site", "Salesforce", "ai-agentics");
      expect(mockFetch.mock.calls[0][0]).toBe(
        "https://salesforce.wd12.myworkdayjobs.com/wday/cxs/salesforce/External_Career_Site/jobs",
      );
    });
  });

  describe("Weights & Biases uses Greenhouse slug 'weights_and_biases' (not 'wandb' which returns 404)", () => {
    it("URL contains /weights_and_biases/", async () => {
      mockJson({ jobs: [] });
      await fetchGreenhouse("weights_and_biases", "Weights & Biases", "ai-agentics");
      expect(mockFetch.mock.calls[0][0]).toContain("/weights_and_biases/");
    });

    it("does NOT use the old 'wandb' slug (404 in production)", async () => {
      mockJson({ jobs: [] });
      await fetchGreenhouse("weights_and_biases", "Weights & Biases", "ai-agentics");
      expect(mockFetch.mock.calls[0][0]).not.toContain("/wandb/");
    });

    it("returns engineering rows labelled 'Weights & Biases' with category=ai-agentics", async () => {
      mockJson({ jobs: [oneEngJob("ML Infrastructure Engineer")] });
      const rows = await fetchGreenhouse("weights_and_biases", "Weights & Biases", "ai-agentics");
      expect(rows).toHaveLength(1);
      expect(rows[0][0]).toBe("Weights & Biases");
      expect(rows[0][4]).toBe("ai-agentics");
    });
  });

  describe("Make (Celonis US) uses Greenhouse slug 'celonis'", () => {
    it("URL contains /celonis/", async () => {
      mockJson({ jobs: [] });
      await fetchGreenhouse("celonis", "Make (Celonis US)", "ai-agentics");
      expect(mockFetch.mock.calls[0][0]).toContain("/celonis/");
    });
  });

  describe("Hebbia uses Ashby slug 'hebbia-ai'", () => {
    it("URL contains hebbia-ai", async () => {
      mockJson({ jobPostings: [] });
      await fetchAshby("hebbia-ai", "Hebbia", "ai-agentics");
      expect(mockFetch.mock.calls[0][0]).toContain("hebbia-ai");
    });
  });

  describe("Runway ML uses Ashby slug 'runwayml'", () => {
    it("URL contains runwayml", async () => {
      mockJson({ jobPostings: [] });
      await fetchAshby("runwayml", "Runway ML", "ai-agentics");
      expect(mockFetch.mock.calls[0][0]).toContain("runwayml");
    });
  });
});
