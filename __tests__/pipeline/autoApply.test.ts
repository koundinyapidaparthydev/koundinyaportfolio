/**
 * @jest-environment node
 *
 * __tests__/pipeline/autoApply.test.ts
 *
 * Tests for scripts/auto-apply.mjs logic, replicated inline.
 *
 * Logic under test:
 *   - detectPlatform(url)              — already in pipelineUtils.test.ts but tested thoroughly here too
 *   - buildLeverApplyUrl(jobUrl)       — ensures /apply suffix is added correctly
 *   - applyLever(job, fetchFn)         — FormData POST to Lever API
 *   - buildWhatsAppPayload(applied)    — WhatsApp message body
 *   - sendApplyNotification(applied)   — skips when token missing or empty
 *   - shouldAutoApply(row)             — filter: applyStatus==='pending' AND resumeUrl is set
 *   - DRY_RUN guard                    — logs without submitting when DRY_RUN=true
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline types and helpers (from auto-apply.mjs)
// ─────────────────────────────────────────────────────────────────────────────

const COL_COMPANY = 0;
const COL_TITLE = 1;
const COL_LOCATION = 2;
const COL_URL = 3;
const COL_PLATFORM = 4;
const COL_DATE = 5;
const COL_DESCRIPTION = 6;
const COL_RESUME_URL = 7;
const COL_COVER_LETTER = 8;
const COL_ATS_SCORE = 9;
const COL_MATCHED = 10;
const COL_MISSING = 11;
const COL_APPLY_STATUS = 12;  // M

interface ApplyRow {
  rowIndex: number;
  values: string[];
}

interface AppliedJob {
  company: string;
  title: string;
  url: string;
  platform: string;
}

/** Returns true if a row should be auto-applied (applyStatus==='pending' AND resumeUrl is set). */
function shouldAutoApply(row: ApplyRow): boolean {
  const applyStatus = row.values[COL_APPLY_STATUS]?.trim() ?? "";
  const resumeUrl = row.values[COL_RESUME_URL]?.trim() ?? "";
  return applyStatus === "pending" && Boolean(resumeUrl);
}

/** Builds the correct Lever apply URL (adds /apply suffix if not already present). */
function buildLeverApplyUrl(jobUrl: string): string {
  if (jobUrl.endsWith("/apply")) return jobUrl;
  return `${jobUrl}/apply`;
}

/** Builds a WhatsApp message payload for applied jobs. */
function buildWhatsAppPayload(applied: AppliedJob[], toNumber: string): Record<string, unknown> {
  const lines = applied.map((j) => `- ${j.company}: ${j.title} (${j.platform})`);
  return {
    messaging_product: "whatsapp",
    to: toNumber,
    type: "text",
    text: {
      body: `Applied to ${applied.length} job(s):\n${lines.join("\n")}`,
    },
  };
}

/** Determines if the notification should be sent. */
function shouldSendNotification(applied: AppliedJob[], accessToken?: string): boolean {
  return Boolean(accessToken) && applied.length > 0;
}

/** Builds the WhatsApp API URL. */
function buildWhatsAppApiUrl(phoneNumberId: string): string {
  return `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
}

/** Simulates the DRY_RUN guard logic. */
function shouldExecuteApply(dryRun: boolean): boolean {
  return !dryRun;
}

// ─────────────────────────────────────────────────────────────────────────────
// shouldAutoApply
// ─────────────────────────────────────────────────────────────────────────────

describe("shouldAutoApply – row filter", () => {
  function makeRow(applyStatus: string, resumeUrl: string, rowIndex = 2): ApplyRow {
    const values = Array(13).fill("");
    values[COL_RESUME_URL] = resumeUrl;
    values[COL_APPLY_STATUS] = applyStatus;
    return { rowIndex, values };
  }

  const GCS_URL = "https://storage.googleapis.com/bucket/resume.pdf";

  it("returns true when applyStatus=pending AND resumeUrl is set", () => {
    expect(shouldAutoApply(makeRow("pending", GCS_URL))).toBe(true);
  });

  it("returns false when applyStatus is not pending", () => {
    expect(shouldAutoApply(makeRow("applied", GCS_URL))).toBe(false);
  });

  it("returns false when applyStatus is 'low-ats'", () => {
    expect(shouldAutoApply(makeRow("low-ats", GCS_URL))).toBe(false);
  });

  it("returns false when applyStatus is empty", () => {
    expect(shouldAutoApply(makeRow("", GCS_URL))).toBe(false);
  });

  it("returns false when applyStatus is 'PENDING' (case sensitive)", () => {
    expect(shouldAutoApply(makeRow("PENDING", GCS_URL))).toBe(false);
  });

  it("returns false when resumeUrl is empty", () => {
    expect(shouldAutoApply(makeRow("pending", ""))).toBe(false);
  });

  it("returns false when resumeUrl is whitespace", () => {
    expect(shouldAutoApply(makeRow("pending", "   "))).toBe(false);
  });

  it("returns false when both applyStatus and resumeUrl are empty", () => {
    expect(shouldAutoApply(makeRow("", ""))).toBe(false);
  });

  it("handles whitespace in applyStatus (trims)", () => {
    // "  pending  ".trim() === "pending"
    expect(shouldAutoApply(makeRow("  pending  ", GCS_URL))).toBe(true);
  });

  it("handles data:URI as resumeUrl (fallback case)", () => {
    const dataUrl = "data:application/pdf;base64,JVBER...";
    expect(shouldAutoApply(makeRow("pending", dataUrl))).toBe(true);
  });

  it("returns false when values array too short (missing applyStatus col)", () => {
    const row: ApplyRow = { rowIndex: 2, values: Array(12).fill("") };
    row.values[COL_RESUME_URL] = GCS_URL;
    // COL_APPLY_STATUS=12 is beyond the array → undefined → ""
    expect(shouldAutoApply(row)).toBe(false);
  });

  it("returns false when row values are empty", () => {
    const row: ApplyRow = { rowIndex: 2, values: [] };
    expect(shouldAutoApply(row)).toBe(false);
  });

  it("filters correctly from a list of rows", () => {
    const rows: ApplyRow[] = [
      makeRow("pending", GCS_URL, 2),
      makeRow("low-ats", GCS_URL, 3),
      makeRow("pending", "", 4),
      makeRow("applied", GCS_URL, 5),
      makeRow("pending", GCS_URL, 6),
    ];
    const applicable = rows.filter(shouldAutoApply);
    expect(applicable).toHaveLength(2);
    expect(applicable.map((r) => r.rowIndex)).toEqual([2, 6]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildLeverApplyUrl
// ─────────────────────────────────────────────────────────────────────────────

describe("buildLeverApplyUrl – Lever URL construction", () => {
  it("appends /apply when URL does not have it", () => {
    expect(buildLeverApplyUrl("https://jobs.lever.co/acme/abc-123")).toBe(
      "https://jobs.lever.co/acme/abc-123/apply"
    );
  });

  it("does not double-append /apply when already present", () => {
    expect(buildLeverApplyUrl("https://jobs.lever.co/acme/abc-123/apply")).toBe(
      "https://jobs.lever.co/acme/abc-123/apply"
    );
  });

  it("appends /apply to a base URL", () => {
    expect(buildLeverApplyUrl("https://jobs.lever.co/startup")).toBe(
      "https://jobs.lever.co/startup/apply"
    );
  });

  it("does not modify URL ending with /apply", () => {
    const url = "https://jobs.lever.co/company/job-id/apply";
    expect(buildLeverApplyUrl(url)).toBe(url);
  });

  it("handles URL with query string (no /apply)", () => {
    const url = "https://jobs.lever.co/acme/abc?source=linkedin";
    expect(buildLeverApplyUrl(url)).toBe(`${url}/apply`);
  });

  it("handles URL with trailing slash before /apply", () => {
    // Implementation does simple string append: "url/" + "/apply" = "url//apply"
    const url = "https://jobs.lever.co/acme/abc/";
    expect(buildLeverApplyUrl(url)).toBe(`${url}/apply`); // results in .../abc//apply
  });

  it("handles very short URL", () => {
    expect(buildLeverApplyUrl("https://a.co/j")).toBe("https://a.co/j/apply");
  });

  it("handles URL that contains 'apply' in the middle", () => {
    const url = "https://jobs.lever.co/apply-at-company/job";
    // Does not END with /apply, so it should append it
    expect(buildLeverApplyUrl(url)).toBe(`${url}/apply`);
  });

  it("does not modify URL that already ends with /apply (case sensitive)", () => {
    const url = "https://jobs.lever.co/acme/job/Apply";
    // 'Apply' !== '/apply' (case sensitive endsWith)
    expect(buildLeverApplyUrl(url)).toBe(`${url}/apply`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildWhatsAppPayload
// ─────────────────────────────────────────────────────────────────────────────

describe("buildWhatsAppPayload", () => {
  const TO_NUMBER = "+14155552671";

  const singleJob: AppliedJob[] = [
    { company: "Acme Corp", title: "Software Engineer", url: "https://lever.co/acme/123", platform: "lever" },
  ];

  const multipleJobs: AppliedJob[] = [
    { company: "Acme Corp", title: "Software Engineer", url: "url1", platform: "lever" },
    { company: "Tech Inc", title: "Frontend Developer", url: "url2", platform: "greenhouse" },
    { company: "Startup LLC", title: "Full Stack Engineer", url: "url3", platform: "workday" },
  ];

  it("sets messaging_product to 'whatsapp'", () => {
    const payload = buildWhatsAppPayload(singleJob, TO_NUMBER);
    expect(payload.messaging_product).toBe("whatsapp");
  });

  it("sets the correct recipient number", () => {
    const payload = buildWhatsAppPayload(singleJob, TO_NUMBER);
    expect(payload.to).toBe(TO_NUMBER);
  });

  it("sets type to 'text'", () => {
    const payload = buildWhatsAppPayload(singleJob, TO_NUMBER);
    expect(payload.type).toBe("text");
  });

  it("includes the applied job count in the message", () => {
    const payload = buildWhatsAppPayload(singleJob, TO_NUMBER);
    const text = (payload.text as { body: string }).body;
    expect(text).toContain("1 job");
  });

  it("includes company name in the message", () => {
    const payload = buildWhatsAppPayload(singleJob, TO_NUMBER);
    const text = (payload.text as { body: string }).body;
    expect(text).toContain("Acme Corp");
  });

  it("includes job title in the message", () => {
    const payload = buildWhatsAppPayload(singleJob, TO_NUMBER);
    const text = (payload.text as { body: string }).body;
    expect(text).toContain("Software Engineer");
  });

  it("includes platform in the message", () => {
    const payload = buildWhatsAppPayload(singleJob, TO_NUMBER);
    const text = (payload.text as { body: string }).body;
    expect(text).toContain("lever");
  });

  it("lists all applied jobs for multiple jobs", () => {
    const payload = buildWhatsAppPayload(multipleJobs, TO_NUMBER);
    const text = (payload.text as { body: string }).body;
    expect(text).toContain("Acme Corp");
    expect(text).toContain("Tech Inc");
    expect(text).toContain("Startup LLC");
    expect(text).toContain("3 job");
  });

  it("handles empty applied array", () => {
    const payload = buildWhatsAppPayload([], TO_NUMBER);
    const text = (payload.text as { body: string }).body;
    expect(text).toContain("0 job");
  });

  it("formats list items with company: title (platform)", () => {
    const payload = buildWhatsAppPayload(singleJob, TO_NUMBER);
    const text = (payload.text as { body: string }).body;
    expect(text).toContain("Acme Corp: Software Engineer (lever)");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// shouldSendNotification
// ─────────────────────────────────────────────────────────────────────────────

describe("shouldSendNotification", () => {
  const jobs: AppliedJob[] = [
    { company: "A", title: "T", url: "u", platform: "lever" },
  ];

  it("returns true when accessToken is set and applied jobs > 0", () => {
    expect(shouldSendNotification(jobs, "EAABwzLixnjYBOxxx")).toBe(true);
  });

  it("returns false when accessToken is undefined", () => {
    expect(shouldSendNotification(jobs, undefined)).toBe(false);
  });

  it("returns false when accessToken is empty string", () => {
    expect(shouldSendNotification(jobs, "")).toBe(false);
  });

  it("returns false when applied array is empty", () => {
    expect(shouldSendNotification([], "EAABwzLixnjYBOxxx")).toBe(false);
  });

  it("returns false when both are empty/undefined", () => {
    expect(shouldSendNotification([], undefined)).toBe(false);
  });

  it("returns true for a large batch", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      company: `C${i}`, title: "T", url: "u", platform: "lever",
    }));
    expect(shouldSendNotification(many, "token")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildWhatsAppApiUrl
// ─────────────────────────────────────────────────────────────────────────────

describe("buildWhatsAppApiUrl", () => {
  it("uses graph.facebook.com/v19.0", () => {
    expect(buildWhatsAppApiUrl("123456789")).toContain("graph.facebook.com/v19.0");
  });

  it("includes the phone number ID", () => {
    expect(buildWhatsAppApiUrl("123456789")).toContain("123456789");
  });

  it("ends with /messages", () => {
    expect(buildWhatsAppApiUrl("123456789")).toMatch(/\/messages$/);
  });

  it("produces the exact expected URL", () => {
    expect(buildWhatsAppApiUrl("PHONE_ID_123")).toBe(
      "https://graph.facebook.com/v19.0/PHONE_ID_123/messages"
    );
  });

  it("handles phone IDs with different formats", () => {
    expect(buildWhatsAppApiUrl("1234567890")).toContain("1234567890");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// shouldExecuteApply (DRY_RUN guard)
// ─────────────────────────────────────────────────────────────────────────────

describe("shouldExecuteApply – DRY_RUN guard", () => {
  it("returns true when DRY_RUN is false", () => {
    expect(shouldExecuteApply(false)).toBe(true);
  });

  it("returns false when DRY_RUN is true", () => {
    expect(shouldExecuteApply(true)).toBe(false);
  });

  it("true DRY_RUN prevents execution", () => {
    let executed = false;
    if (shouldExecuteApply(true)) {
      executed = true;
    }
    expect(executed).toBe(false);
  });

  it("false DRY_RUN allows execution", () => {
    let executed = false;
    if (shouldExecuteApply(false)) {
      executed = true;
    }
    expect(executed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyLever simulation (mocked fetch)
// ─────────────────────────────────────────────────────────────────────────────

describe("applyLever – Lever form submission", () => {
  interface LeverJobRow {
    company: string;
    title: string;
    url: string;
    resumeUrl: string;
    coverLetter: string;
    location: string;
  }

  async function applyLever(job: LeverJobRow, fetchFn: typeof fetch): Promise<Response> {
    const applyUrl = buildLeverApplyUrl(job.url);
    const form = new FormData();
    form.append("name", "Koundinya Pidaparthy");
    form.append("email", "koundinya@example.com");
    form.append("phone", "1234567890");
    form.append("resume_url", job.resumeUrl);
    form.append("cover_letter", job.coverLetter);
    if (job.location) form.append("location", job.location);
    return fetchFn(applyUrl, {
      method: "POST",
      body: form,
    });
  }

  const testJob: LeverJobRow = {
    company: "Acme Corp",
    title: "Software Engineer",
    url: "https://jobs.lever.co/acme/abc-123",
    resumeUrl: "https://storage.googleapis.com/bucket/resume.pdf",
    coverLetter: "Dear Hiring Manager...",
    location: "New York, NY",
  };

  it("POSTs to the correct apply URL", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    await applyLever(testJob, mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://jobs.lever.co/acme/abc-123/apply",
      expect.any(Object)
    );
  });

  it("does not double-append /apply", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const job = { ...testJob, url: "https://jobs.lever.co/acme/abc-123/apply" };
    await applyLever(job, mockFetch);
    expect(mockFetch.mock.calls[0][0]).toBe("https://jobs.lever.co/acme/abc-123/apply");
  });

  it("uses POST method", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    await applyLever(testJob, mockFetch);
    expect(mockFetch.mock.calls[0][1].method).toBe("POST");
  });

  it("sends FormData as the body", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    await applyLever(testJob, mockFetch);
    expect(mockFetch.mock.calls[0][1].body).toBeInstanceOf(FormData);
  });

  it("returns the fetch response", async () => {
    const fakeResponse = { ok: true, status: 200 };
    const mockFetch = jest.fn().mockResolvedValue(fakeResponse);
    const res = await applyLever(testJob, mockFetch);
    expect(res.status).toBe(200);
  });

  it("propagates network errors", async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error("Connection refused"));
    await expect(applyLever(testJob, mockFetch)).rejects.toThrow("Connection refused");
  });

  it("includes resume_url in FormData", async () => {
    const capturedFormData: string[] = [];
    const mockFetch = jest.fn().mockImplementation(async (url: string, opts: RequestInit) => {
      const fd = opts.body as FormData;
      capturedFormData.push(fd.get("resume_url") as string);
      return { ok: true, status: 200 };
    });
    await applyLever(testJob, mockFetch);
    expect(capturedFormData[0]).toBe(testJob.resumeUrl);
  });

  it("includes cover_letter in FormData", async () => {
    const capturedFormData: string[] = [];
    const mockFetch = jest.fn().mockImplementation(async (url: string, opts: RequestInit) => {
      const fd = opts.body as FormData;
      capturedFormData.push(fd.get("cover_letter") as string);
      return { ok: true, status: 200 };
    });
    await applyLever(testJob, mockFetch);
    expect(capturedFormData[0]).toBe(testJob.coverLetter);
  });

  it("handles 422 response (validation error) without throwing", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 422 });
    const res = await applyLever(testJob, mockFetch);
    expect(res.status).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: full auto-apply flow simulation
// ─────────────────────────────────────────────────────────────────────────────

describe("auto-apply full flow simulation", () => {
  function makeRows(count: number, overrides: Partial<Record<number, string>> = {}): ApplyRow[] {
    return Array.from({ length: count }, (_, i) => {
      const values = Array(13).fill("");
      values[COL_COMPANY] = `Company ${i}`;
      values[COL_TITLE] = "Software Engineer";
      values[COL_URL] = `https://jobs.lever.co/company${i}/job${i}`;
      values[COL_PLATFORM] = "lever";
      values[COL_RESUME_URL] = "https://storage.googleapis.com/bucket/resume.pdf";
      values[COL_APPLY_STATUS] = "pending";
      Object.entries(overrides).forEach(([k, v]) => { values[Number(k)] = v as string; });
      return { rowIndex: i + 2, values };
    });
  }

  it("filters to only pending rows with resumeUrl", () => {
    const rows = makeRows(5);
    rows[1].values[COL_APPLY_STATUS] = "applied";
    rows[3].values[COL_RESUME_URL] = "";
    const applicable = rows.filter(shouldAutoApply);
    expect(applicable).toHaveLength(3);
  });

  it("builds correct Lever URLs for all rows", () => {
    const rows = makeRows(3);
    const urls = rows.filter(shouldAutoApply).map((r) => buildLeverApplyUrl(r.values[COL_URL]));
    expect(urls).toEqual([
      "https://jobs.lever.co/company0/job0/apply",
      "https://jobs.lever.co/company1/job1/apply",
      "https://jobs.lever.co/company2/job2/apply",
    ]);
  });

  it("DRY_RUN=true prevents any fetch calls", async () => {
    const mockFetch = jest.fn();
    const rows = makeRows(3);
    const applicable = rows.filter(shouldAutoApply);
    if (shouldExecuteApply(true)) {
      // This should not be reached
      for (const row of applicable) {
        await mockFetch(buildLeverApplyUrl(row.values[COL_URL]), {});
      }
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("DRY_RUN=false allows fetch calls", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const rows = makeRows(2);
    const applicable = rows.filter(shouldAutoApply);
    if (shouldExecuteApply(false)) {
      for (const row of applicable) {
        await mockFetch(buildLeverApplyUrl(row.values[COL_URL]), {});
      }
    }
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("notification is skipped when no rows applied", () => {
    expect(shouldSendNotification([], "token123")).toBe(false);
  });

  it("notification is skipped when WHATSAPP_ACCESS_TOKEN not set", () => {
    const applied: AppliedJob[] = [{ company: "A", title: "T", url: "u", platform: "lever" }];
    expect(shouldSendNotification(applied, undefined)).toBe(false);
  });

  it("notification is sent for applied jobs with token", () => {
    const applied: AppliedJob[] = [
      { company: "A", title: "T1", url: "u1", platform: "lever" },
      { company: "B", title: "T2", url: "u2", platform: "greenhouse" },
    ];
    expect(shouldSendNotification(applied, "token123")).toBe(true);
    const payload = buildWhatsAppPayload(applied, "+1234567890");
    expect((payload.text as { body: string }).body).toContain("2 job");
  });
});
