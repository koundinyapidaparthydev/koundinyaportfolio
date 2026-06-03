#!/usr/bin/env node
/**
 * auto-apply.mjs
 *
 * Reads jobs from the Google Sheet where:
 *   - Apply Status = "pending"
 *   - Resume URL is set
 *
 * Then auto-applies using the appropriate method per platform:
 *   - Greenhouse     (boards.greenhouse.io / greenhouse.io): Playwright form fill
 *   - Lever          (jobs.lever.co):                        Direct POST to apply endpoint
 *   - Workday        (myworkdayjobs.com):                    Playwright form fill
 *   - iCIMS          (disneycareers.com / icims.com):        Playwright form fill
 *   - Ashby          (jobs.ashbyhq.com):                     Playwright form fill
 *   - SmartRecruiters(smartrecruiters.com):                  Playwright form fill
 *   - BreezyHR       (breezy.hr):                            Playwright form fill
 *   - Workable       (workable.com):                         Playwright form fill
 *   - Recruitee      (recruitee.com):                        Playwright form fill
 *   - Generic:                                               Opens URL (manual fallback)
 *
 * After applying, updates the sheet:
 *   - Apply Status → "applied" or "failed"
 *   - Applied At   → ISO timestamp
 *   - Notes        → application ID / error
 *
 * Required env vars:
 *   GOOGLE_SHEET_ID              – target sheet
 *   GOOGLE_SERVICE_ACCOUNT_JSON  – service account with Sheets editor access
 *   APPLICANT_EMAIL              – your email for all applications
 *   APPLICANT_FIRST_NAME         – first name
 *   APPLICANT_LAST_NAME          – last name
 *   APPLICANT_PHONE              – phone number (e.g. 551-229-8660)
 *   APPLICANT_LINKEDIN           – LinkedIn URL
 *   APPLICANT_PORTFOLIO          – portfolio URL
 *
 * Optional:
 *   DRY_RUN=true                 – log what would be done but don't actually submit
 *   APPLY_LIMIT=10               – max applications per run (default: 10)
 */

import { chromium } from "playwright";
import { google } from "googleapis";
import { existsSync, readFileSync, createWriteStream } from "fs";
import { tmpdir } from "os";

// Auto-load .env.local when running locally (not set in GitHub Actions).
// Hand-rolled parser preserves JSON values with embedded double-quotes.
if (existsSync(".env.local")) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val   = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith("'") && val.endsWith("'")) ||
        (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    if (!key) continue;
    const cur = process.env[key];
    if (!cur) {
      process.env[key] = val;
    } else if (val.startsWith('{')) {
      try { JSON.parse(cur); } catch { process.env[key] = val; }
    }
  }
}
import { join } from "path";
import { unlink } from "fs/promises";
import { pipeline } from "stream/promises";
import { createWriteStream as createWS } from "fs";

const GOOGLE_SHEET_ID             = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const DRY_RUN                     = process.env.DRY_RUN === "true";
const APPLY_LIMIT                 = parseInt(process.env.APPLY_LIMIT ?? "200", 10);

// Applicant personal info (for form filling)
const APPLICANT = {
  email:      process.env.APPLICANT_EMAIL      ?? "koundinyapidaparthy@gmail.com",
  firstName:  process.env.APPLICANT_FIRST_NAME ?? "Koundinya",
  lastName:   process.env.APPLICANT_LAST_NAME  ?? "Pidaparthy",
  phone:      process.env.APPLICANT_PHONE      ?? "551-229-8660",
  linkedin:   process.env.APPLICANT_LINKEDIN   ?? "https://linkedin.com/in/koundinyap",
  portfolio:  process.env.APPLICANT_PORTFOLIO  ?? "https://koundinyapidaparthy.com",
  location:   "New York, NY",
  workAuth:   "yes",    // authorized to work in US
  sponsorship:"no",     // do not need visa sponsorship
};

const SHEET_NAME = "Jobs";

const COL = {
  COMPANY:       0,
  TITLE:         1,
  LOCATION:      2,
  URL:           3,
  CATEGORY:      4,
  FETCHED_AT:    5,
  DESCRIPTION:   6,
  RESUME_URL:    7,
  COVER_LETTER:  8,
  ATS_SCORE:     9,
  APPLY_STATUS: 10,
  APPLIED_AT:   11,
  NOTES:        12,
};

if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.error("❌  Missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON");
  process.exit(1);
}

try {
  const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!creds?.client_email || !creds?.private_key) {
    throw new Error("missing client_email or private_key");
  }
} catch (err) {
  console.error(
    "❌  GOOGLE_SERVICE_ACCOUNT_JSON is invalid:",
    err instanceof Error ? err.message : String(err)
  );
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheets helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getSheets() {
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function getAllRows(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A2:M`,
  });
  return (res.data.values ?? []).map((values, i) => ({ rowIndex: i + 2, values }));
}

async function updateApplyStatus(sheets, rowIndex, { status, appliedAt, notes }) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!K${rowIndex}:M${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[status, appliedAt ?? "", notes ?? ""]],
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF download helper — downloads the GCS signed URL to a local tmp file
// ─────────────────────────────────────────────────────────────────────────────

async function downloadPdf(url) {
  const tmpPath = join(tmpdir(), `resume_${Date.now()}.pdf`);
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`PDF download failed: HTTP ${res.status}`);
  const body = res.body;
  const ws = createWS(tmpPath);
  await pipeline(body, ws);
  return tmpPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform detection
// ─────────────────────────────────────────────────────────────────────────────

function detectPlatform(url) {
  if (!url) return "unknown";
  if (url.includes("greenhouse.io"))        return "greenhouse";
  if (url.includes("lever.co"))             return "lever";
  if (url.includes("myworkdayjobs.com"))    return "workday";
  if (url.includes("disneycareers.com"))    return "icims";
  if (url.includes("icims.com"))            return "icims";
  if (url.includes("ashbyhq.com"))          return "ashby";
  if (url.includes("smartrecruiters.com"))  return "smartrecruiters";
  if (url.includes("breezy.hr"))            return "breezy";
  if (url.includes("workable.com"))         return "workable";
  if (url.includes("recruitee.com"))        return "recruitee";
  if (url.includes("hiring.cafe"))          return "hiring-cafe";
  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// Greenhouse apply — Playwright
// ─────────────────────────────────────────────────────────────────────────────

async function applyGreenhouse(browser, job) {
  const { jobUrl, resumePath, coverLetter, company, title } = job;

  const page = await browser.newPage();
  try {
    // Navigate to the job application page
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Guard: if the form is already visible on the landing page, bypass the "Apply" click
    const formInput = page.locator('input[name="first_name"], input[id*="first_name"]').first();
    const hasForm = await formInput.count() > 0 && await formInput.isVisible();
    if (!hasForm) {
      // Find and click the Apply button (if on the job details page)
      const applyBtn = page.locator('a[href*="apply"], button:has-text("Apply")').first();
      if (await applyBtn.count() > 0) {
        await applyBtn.click();
        await page.waitForLoadState("domcontentloaded").catch(() => {});
      }
    }

    // Wait for the form to appear
    await page.waitForSelector('input[name="first_name"], input[id*="first_name"]', { timeout: 15_000 });

    // ── Fill standard Greenhouse fields ──
    await fillIfExists(page, 'input[name="first_name"], input[id*="first_name"]', APPLICANT.firstName);
    await fillIfExists(page, 'input[name="last_name"], input[id*="last_name"]',   APPLICANT.lastName);
    await fillIfExists(page, 'input[name="email"], input[type="email"]',           APPLICANT.email);
    await fillIfExists(page, 'input[name="phone"]',                                APPLICANT.phone);

    // Resume file upload
    const resumeInput = page.locator('input[type="file"][name*="resume"], input[type="file"][id*="resume"]').first();
    if (await resumeInput.count() > 0) {
      await resumeInput.setInputFiles(resumePath);
    }

    // Cover letter (text area or file)
    await fillIfExists(page, 'textarea[name*="cover_letter"], textarea[id*="cover_letter"]', coverLetter);

    // LinkedIn URL
    await fillIfExists(page, 'input[name*="linkedin"], input[id*="linkedin"]', APPLICANT.linkedin);

    // Portfolio / website
    await fillIfExists(page, 'input[name*="website"], input[name*="portfolio"], input[id*="website"]', APPLICANT.portfolio);

    // ── Answer common yes/no screening questions ──
    await answerCommonQuestions(page);

    if (DRY_RUN) {
      console.log(`  🧪 DRY_RUN: would submit Greenhouse for ${company} — ${title}`);
      return { success: true, notes: "dry-run" };
    }

    // Submit
    await page.locator('button[type="submit"], input[type="submit"]').last().click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Check for success indicators
    const body = await page.content();
    const success = /thank you|application submitted|we.ll be in touch|confirmation/i.test(body);

    if (!success) {
      // Capture screenshot for debugging
      const screenshotPath = join(tmpdir(), `gh_apply_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.warn(`  ⚠  Greenhouse submit uncertain for ${company}; screenshot: ${screenshotPath}`);
    }

    return { success: true, notes: success ? "submitted" : "submitted-unconfirmed" };
  } catch (err) {
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lever apply — direct POST (more reliable than Playwright for Lever)
// ─────────────────────────────────────────────────────────────────────────────

async function applyLever(job) {
  const { jobUrl, resumeUrl, coverLetter, company, title } = job;

  // Lever apply URL: https://jobs.lever.co/{company}/{posting_id}/apply
  const applyUrl = jobUrl.endsWith("/apply") ? jobUrl : `${jobUrl}/apply`;

  // Fetch resume binary to upload
  const resumeRes = await fetch(resumeUrl, { signal: AbortSignal.timeout(30_000) });
  if (!resumeRes.ok) throw new Error(`Resume download failed: HTTP ${resumeRes.status}`);
  const resumeBlob = await resumeRes.blob();

  const form = new FormData();
  form.append("name",     `${APPLICANT.firstName} ${APPLICANT.lastName}`);
  form.append("email",    APPLICANT.email);
  form.append("phone",    APPLICANT.phone);
  form.append("org",      "");
  form.append("comments", coverLetter ?? "");
  form.append("resume",   resumeBlob, "Koundinya_Pidaparthy_Resume.pdf");
  form.append("linkedin", APPLICANT.linkedin);
  form.append("portfolio", APPLICANT.portfolio);

  if (DRY_RUN) {
    console.log(`  🧪 DRY_RUN: would POST Lever apply for ${company} — ${title}`);
    return { success: true, notes: "dry-run" };
  }

  const res = await fetch(applyUrl, {
    method: "POST",
    body: form,
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Referer": jobUrl,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (res.ok || res.status === 302) {
    return { success: true, notes: "submitted" };
  }

  const text = await res.text().catch(() => "");
  return { success: false, notes: `HTTP ${res.status}: ${text.slice(0, 150)}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Workday apply — Playwright (complex SPA)
// ─────────────────────────────────────────────────────────────────────────────

async function applyWorkday(browser, job) {
  const { jobUrl, resumePath, coverLetter, company, title } = job;
  const page = await browser.newPage();
  try {
    await page.goto(jobUrl, { waitUntil: "networkidle", timeout: 40_000 });

    // Workday "Apply" button
    const applyBtn = page.locator('[data-automation-id="applyNowButton"], button:has-text("Apply")').first();
    if (await applyBtn.count() === 0) {
      return { success: false, notes: "Apply button not found on Workday page" };
    }
    await applyBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 30_000 });

    // ── Workday uses a multi-step form ──
    // Step 1: My Information
    await fillIfExists(page, '[data-automation-id="legalNameSection_firstName"], input[aria-label*="First Name"]', APPLICANT.firstName);
    await fillIfExists(page, '[data-automation-id="legalNameSection_lastName"],  input[aria-label*="Last Name"]',  APPLICANT.lastName);
    await fillIfExists(page, 'input[data-automation-id*="email"],                input[type="email"]',             APPLICANT.email);
    await fillIfExists(page, 'input[data-automation-id*="phone"],                input[aria-label*="Phone"]',       APPLICANT.phone);

    // Resume upload
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(resumePath);
      await page.waitForTimeout(2000);
    }

    // Navigate through steps
    for (let step = 0; step < 6; step++) {
      const nextBtn = page.locator('[data-automation-id="bottom-navigation-next-btn"], button:has-text("Next")').first();
      if (await nextBtn.count() === 0) break;
      await nextBtn.click();
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1000);

      // Answer work auth questions
      await answerCommonQuestions(page);
    }

    // Submit
    const submitBtn = page.locator('[data-automation-id="bottom-navigation-finish-btn"], button:has-text("Submit")').first();
    if (await submitBtn.count() === 0) {
      return { success: false, notes: "Submit button not found in Workday flow" };
    }

    if (DRY_RUN) {
      console.log(`  🧪 DRY_RUN: would submit Workday for ${company} — ${title}`);
      return { success: true, notes: "dry-run" };
    }

    await submitBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const body = await page.content();
    const success = /thank you|submitted|confirmation/i.test(body);
    return { success: true, notes: success ? "submitted" : "submitted-unconfirmed" };
  } catch (err) {
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ashby apply — Playwright (standard web form, similar structure to Greenhouse)
// ─────────────────────────────────────────────────────────────────────────────

async function applyAshby(browser, job) {
  const { jobUrl, resumePath, coverLetter, company, title } = job;
  const page = await browser.newPage();
  try {
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Guard: if the form is already visible, bypass the "Apply" click
    const formInput = page.locator('input[name="firstName"], input[placeholder*="First"]').first();
    const hasForm = await formInput.count() > 0 && await formInput.isVisible();
    if (!hasForm) {
      const applyBtn = page.locator('a[href*="apply"], button:has-text("Apply")').first();
      if (await applyBtn.count() > 0) {
        await applyBtn.click();
        await page.waitForLoadState("domcontentloaded").catch(() => {});
      }
    }

    await page.waitForSelector('input[name="firstName"], input[placeholder*="First"]', { timeout: 15_000 });

    await fillIfExists(page, 'input[name="firstName"], input[placeholder*="First"]', APPLICANT.firstName);
    await fillIfExists(page, 'input[name="lastName"],  input[placeholder*="Last"]',  APPLICANT.lastName);
    await fillIfExists(page, 'input[name="email"],     input[type="email"]',          APPLICANT.email);
    await fillIfExists(page, 'input[name="phone"],     input[type="tel"]',            APPLICANT.phone);
    await fillIfExists(page, 'input[name*="linkedin"], input[placeholder*="LinkedIn"]', APPLICANT.linkedin);

    const resumeInput = page.locator('input[type="file"]').first();
    if (await resumeInput.count() > 0) await resumeInput.setInputFiles(resumePath);

    await fillIfExists(page, 'textarea[name*="cover"], textarea[placeholder*="cover"]', coverLetter);
    await answerCommonQuestions(page);

    if (DRY_RUN) {
      console.log(`  🧪 DRY_RUN: would submit Ashby for ${company} — ${title}`);
      return { success: true, notes: "dry-run" };
    }

    await page.locator('button[type="submit"]').last().click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const body = await page.content();
    const success = /thank you|submitted|confirmation/i.test(body);
    return { success: true, notes: success ? "submitted" : "submitted-unconfirmed" };
  } catch (err) {
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SmartRecruiters apply — Playwright
// ─────────────────────────────────────────────────────────────────────────────

async function applySmartRecruiters(browser, job) {
  const { jobUrl, resumePath, coverLetter, company, title } = job;
  const page = await browser.newPage();
  try {
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Guard: if the form is already visible, bypass the "Apply" click
    const formInput = page.locator('input[name="firstName"], input[id*="firstName"]').first();
    const hasForm = await formInput.count() > 0 && await formInput.isVisible();
    if (!hasForm) {
      const applyBtn = page.locator('button:has-text("Apply"), a:has-text("Apply Now")').first();
      if (await applyBtn.count() > 0) {
        await applyBtn.click();
        await page.waitForLoadState("domcontentloaded").catch(() => {});
      }
    }

    await page.waitForSelector('input[name="firstName"], input[id*="firstName"]', { timeout: 15_000 });

    await fillIfExists(page, 'input[name="firstName"]', APPLICANT.firstName);
    await fillIfExists(page, 'input[name="lastName"]',  APPLICANT.lastName);
    await fillIfExists(page, 'input[name="email"]',     APPLICANT.email);
    await fillIfExists(page, 'input[name="phone"]',     APPLICANT.phone);

    const resumeInput = page.locator('input[type="file"]').first();
    if (await resumeInput.count() > 0) await resumeInput.setInputFiles(resumePath);

    await fillIfExists(page, 'textarea[name*="message"], textarea[name*="cover"]', coverLetter);
    await answerCommonQuestions(page);

    if (DRY_RUN) {
      console.log(`  🧪 DRY_RUN: would submit SmartRecruiters for ${company} — ${title}`);
      return { success: true, notes: "dry-run" };
    }

    await page.locator('button[type="submit"]').last().click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const body = await page.content();
    const success = /thank you|submitted|confirmation|application received/i.test(body);
    return { success: true, notes: success ? "submitted" : "submitted-unconfirmed" };
  } catch (err) {
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BreezyHR apply — Playwright
// ─────────────────────────────────────────────────────────────────────────────

async function applyBreezy(browser, job) {
  const { jobUrl, resumePath, coverLetter, company, title } = job;
  const page = await browser.newPage();
  try {
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Guard: if the form is already visible, bypass the "Apply" click
    const formInput = page.locator('input[name="name"], input[id*="name"]').first();
    const hasForm = await formInput.count() > 0 && await formInput.isVisible();
    if (!hasForm) {
      const applyBtn = page.locator('a:has-text("Apply"), button:has-text("Apply")').first();
      if (await applyBtn.count() > 0) {
        await applyBtn.click();
        await page.waitForLoadState("domcontentloaded").catch(() => {});
      }
    }

    await page.waitForSelector('input[name="name"], input[id*="name"]', { timeout: 15_000 });

    await fillIfExists(page, 'input[name="name"]',  `${APPLICANT.firstName} ${APPLICANT.lastName}`);
    await fillIfExists(page, 'input[name="email"]', APPLICANT.email);
    await fillIfExists(page, 'input[name="phone"]', APPLICANT.phone);

    const resumeInput = page.locator('input[type="file"]').first();
    if (await resumeInput.count() > 0) await resumeInput.setInputFiles(resumePath);

    await fillIfExists(page, 'textarea[name*="cover"], textarea[placeholder*="cover"]', coverLetter);

    if (DRY_RUN) {
      console.log(`  🧪 DRY_RUN: would submit BreezyHR for ${company} — ${title}`);
      return { success: true, notes: "dry-run" };
    }

    await page.locator('button[type="submit"]').last().click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const body = await page.content();
    const success = /thank you|submitted|application received/i.test(body);
    return { success: true, notes: success ? "submitted" : "submitted-unconfirmed" };
  } catch (err) {
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Workable apply — Playwright
// ─────────────────────────────────────────────────────────────────────────────

async function applyWorkable(browser, job) {
  const { jobUrl, resumePath, coverLetter, company, title } = job;
  const page = await browser.newPage();
  try {
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Guard: if the form is already visible, bypass the "Apply" click
    const formInput = page.locator('input[name="firstname"], input[id*="firstname"]').first();
    const hasForm = await formInput.count() > 0 && await formInput.isVisible();
    if (!hasForm) {
      const applyBtn = page.locator('a:has-text("Apply"), button:has-text("Apply Now")').first();
      if (await applyBtn.count() > 0) {
        await applyBtn.click();
        await page.waitForLoadState("domcontentloaded").catch(() => {});
      }
    }

    await page.waitForSelector('input[name="firstname"], input[id*="firstname"]', { timeout: 15_000 });

    await fillIfExists(page, 'input[name="firstname"]', APPLICANT.firstName);
    await fillIfExists(page, 'input[name="lastname"]',  APPLICANT.lastName);
    await fillIfExists(page, 'input[name="email"]',     APPLICANT.email);
    await fillIfExists(page, 'input[name="phone"]',     APPLICANT.phone);

    const resumeInput = page.locator('input[type="file"]').first();
    if (await resumeInput.count() > 0) await resumeInput.setInputFiles(resumePath);

    await fillIfExists(page, 'textarea[name*="summary"], textarea[placeholder*="brief"]', coverLetter);

    if (DRY_RUN) {
      console.log(`  🧪 DRY_RUN: would submit Workable for ${company} — ${title}`);
      return { success: true, notes: "dry-run" };
    }

    await page.locator('button[type="submit"]').last().click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const body = await page.content();
    const success = /thank you|application submitted|confirmation/i.test(body);
    return { success: true, notes: success ? "submitted" : "submitted-unconfirmed" };
  } catch (err) {
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Recruitee apply — Playwright
// ─────────────────────────────────────────────────────────────────────────────

async function applyRecruitee(browser, job) {
  const { jobUrl, resumePath, coverLetter, company, title } = job;
  const page = await browser.newPage();
  try {
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Guard: if the form is already visible, bypass the "Apply" click
    const formInput = page.locator('input[name="first_name"], input[id*="first_name"]').first();
    const hasForm = await formInput.count() > 0 && await formInput.isVisible();
    if (!hasForm) {
      const applyBtn = page.locator('a:has-text("Apply"), button:has-text("Apply")').first();
      if (await applyBtn.count() > 0) {
        await applyBtn.click();
        await page.waitForLoadState("domcontentloaded").catch(() => {});
      }
    }

    await page.waitForSelector('input[name="first_name"], input[id*="first_name"]', { timeout: 15_000 });

    await fillIfExists(page, 'input[name="first_name"]', APPLICANT.firstName);
    await fillIfExists(page, 'input[name="last_name"]',  APPLICANT.lastName);
    await fillIfExists(page, 'input[name="email"]',      APPLICANT.email);
    await fillIfExists(page, 'input[name="phone"]',      APPLICANT.phone);

    const resumeInput = page.locator('input[type="file"]').first();
    if (await resumeInput.count() > 0) await resumeInput.setInputFiles(resumePath);

    await fillIfExists(page, 'textarea[name*="cover"], textarea[name*="message"]', coverLetter);

    if (DRY_RUN) {
      console.log(`  🧪 DRY_RUN: would submit Recruitee for ${company} — ${title}`);
      return { success: true, notes: "dry-run" };
    }

    await page.locator('button[type="submit"]').last().click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const body = await page.content();
    const success = /thank you|submitted|application received/i.test(body);
    return { success: true, notes: success ? "submitted" : "submitted-unconfirmed" };
  } catch (err) {
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hiring Cafe apply — resolves the actual external ATS URL then delegates
// ─────────────────────────────────────────────────────────────────────────────

async function applyHiringCafe(browser, job) {
  const { jobUrl, resumePath, resumeUrl, coverLetter, company, title } = job;
  const page = await browser.newPage();

  try {
    // Navigate to the hiring.cafe job detail page
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Locate the primary Apply button / link
    const applySelector = [
      'a:has-text("Apply Now")',
      'a:has-text("Easy Apply")',
      'a:has-text("Apply")',
      'button:has-text("Apply Now")',
      'button:has-text("Apply")',
    ].join(", ");

    const applyEl = page.locator(applySelector).first();
    if (await applyEl.count() === 0) {
      return { success: false, notes: "No Apply button on hiring.cafe job page" };
    }

    // Try to get the href directly (avoids opening a new tab)
    let externalUrl = await applyEl.getAttribute("href").catch(() => null);
    if (externalUrl && !externalUrl.startsWith("http")) {
      externalUrl = new URL(externalUrl, "https://hiring.cafe").href;
    }

    // If the link goes back to hiring.cafe (e.g. a redirect wrapper), click and follow
    if (!externalUrl || externalUrl.includes("hiring.cafe")) {
      const context = browser.contexts()[0] ?? page.context();
      const [newTab] = await Promise.all([
        context.waitForEvent("page", { timeout: 10_000 }).catch(() => null),
        applyEl.click(),
      ]);

      if (newTab) {
        await newTab.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => {});
        externalUrl = newTab.url();
        await newTab.close().catch(() => {});
      } else {
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
        externalUrl = page.url();
      }
    }

    if (!externalUrl || externalUrl.includes("hiring.cafe")) {
      return { success: false, notes: "manual-required: could not resolve external apply URL" };
    }

    console.log(`    ↳ Resolved to: ${externalUrl.slice(0, 100)}`);

    // Detect platform and delegate to the right apply function
    const platform  = detectPlatform(externalUrl);
    const outerJob  = { jobUrl: externalUrl, resumePath, resumeUrl, coverLetter, company, title };
    const pwPlatforms = ["greenhouse", "icims", "workday", "ashby", "smartrecruiters", "breezy", "workable", "recruitee"];

    if (pwPlatforms.includes(platform)) {
      if (platform === "greenhouse" || platform === "icims") return await applyGreenhouse(browser, outerJob);
      if (platform === "workday")        return await applyWorkday(browser, outerJob);
      if (platform === "ashby")          return await applyAshby(browser, outerJob);
      if (platform === "smartrecruiters") return await applySmartRecruiters(browser, outerJob);
      if (platform === "breezy")         return await applyBreezy(browser, outerJob);
      if (platform === "workable")       return await applyWorkable(browser, outerJob);
      if (platform === "recruitee")      return await applyRecruitee(browser, outerJob);
    }

    if (platform === "lever") {
      return await applyLever({ jobUrl: externalUrl, resumeUrl, coverLetter, company, title });
    }

    return { success: false, notes: `manual-required: ${platform} at ${externalUrl.slice(0, 80)}` };

  } catch (err) {
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close().catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: fill a field if the selector exists on the page
// ─────────────────────────────────────────────────────────────────────────────

async function fillIfExists(page, selector, value) {
  if (!value) return;
  const el = page.locator(selector).first();
  if (await el.count() > 0) {
    await el.fill(value);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Answer common yes/no screening questions
// ─────────────────────────────────────────────────────────────────────────────

async function answerCommonQuestions(page) {
  // "Are you authorized to work in the US?" → Yes
  const authQuestions = page.locator('select, input[type="radio"]').filter({
    hasText: /authorized|work in the us/i,
  });

  // Try selects first
  const selects = page.locator("select").all();
  for (const select of await selects) {
    const label = await select.evaluate((el) => {
      const id = el.getAttribute("id") || el.getAttribute("name") || "";
      const labelEl = document.querySelector(`label[for="${id}"]`);
      return labelEl?.textContent ?? "";
    }).catch(() => "");

    if (/authorized|work.*us|eligible/i.test(label)) {
      await select.selectOption({ label: /yes/i });
    }
    if (/sponsorship|visa|require.*sponsor/i.test(label)) {
      await select.selectOption({ label: /no/i });
    }
  }

  // Try radio buttons
  const radioYes = page.locator('input[type="radio"][value*="yes" i], input[type="radio"][value*="1"]');
  const radioNo  = page.locator('input[type="radio"][value*="no" i],  input[type="radio"][value*="0"]');

  // For work authorization — click "yes" radio if near authorization label
  const authSection = page.locator('fieldset, div').filter({ hasText: /authorized.*work|work.*authorized/i }).first();
  if (await authSection.count() > 0) {
    const yesInSection = authSection.locator('input[type="radio"][value*="yes" i]').first();
    if (await yesInSection.count() > 0) await yesInSection.check();
  }

  // For sponsorship — click "no"
  const sponsorSection = page.locator('fieldset, div').filter({ hasText: /sponsorship|visa/i }).first();
  if (await sponsorSection.count() > 0) {
    const noInSection = sponsorSection.locator('input[type="radio"][value*="no" i]').first();
    if (await noInSection.count() > 0) await noInSection.check();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp notification
// ─────────────────────────────────────────────────────────────────────────────

async function sendApplyNotification(applied) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN;
  const recipient     = process.env.WHATSAPP_RECIPIENT ?? "+15512298660";

  if (!phoneNumberId || !accessToken || applied.length === 0) return;

  const lines = [`✅ *Auto-Applied to ${applied.length} job${applied.length > 1 ? "s" : ""}*\n`];
  for (const { company, title, atsScore, resumeUrl } of applied) {
    lines.push(`• *${company}* — ${title} (ATS: ${atsScore})`);
    if (resumeUrl && !resumeUrl.startsWith("data:")) {
      lines.push(`  Resume: ${resumeUrl.slice(0, 80)}...`);
    }
  }

  const body = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "text",
    text: { body: lines.join("\n") },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (res.ok) {
      console.log("\n📱 WhatsApp notification sent");
    } else {
      console.warn(`\n⚠  WhatsApp notification failed: HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn("\n⚠  WhatsApp notification error:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🚀  Auto-Apply — starting${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const sheets = await getSheets();
  const allRows = await getAllRows(sheets);

  // Find jobs ready to apply: status = "pending", has resumeUrl
  const toApply = allRows.filter((r) => {
    const status    = r.values[COL.APPLY_STATUS] ?? "";
    const resumeUrl = r.values[COL.RESUME_URL]   ?? "";
    return status === "pending" && resumeUrl.length > 0;
  }).slice(0, APPLY_LIMIT);

  console.log(`Found ${toApply.length} jobs to apply (limit: ${APPLY_LIMIT})\n`);
  if (toApply.length === 0) {
    console.log("✅  Nothing to apply to — done");
    return;
  }

  // Launch Playwright browser once for all Playwright-based applies
  const browser = await chromium.launch({ headless: true });

  const applied = [];
  const tmpFiles = [];

  try {
    for (const { rowIndex, values } of toApply) {
      const company     = values[COL.COMPANY]      ?? "";
      const title       = values[COL.TITLE]        ?? "";
      const jobUrl      = values[COL.URL]          ?? "";
      const resumeUrl   = values[COL.RESUME_URL]   ?? "";
      const coverLetter = values[COL.COVER_LETTER] ?? "";
      const atsScore    = values[COL.ATS_SCORE]    ?? "";

      const platform = detectPlatform(jobUrl);
      console.log(`  📝 [${platform.toUpperCase()}] ${company} — ${title}`);

      let result = { success: false, notes: "unsupported platform" };

      // Platforms that need a local PDF file for upload
      const playwrightPlatforms = ["greenhouse", "icims", "workday", "ashby", "smartrecruiters", "breezy", "workable", "recruitee", "hiring-cafe"];

      if (playwrightPlatforms.includes(platform)) {
        // Need to download PDF locally for file upload
        let resumePath = null;
        try {
          resumePath = await downloadPdf(resumeUrl);
          tmpFiles.push(resumePath);
        } catch (err) {
          console.error(`  ❌ Could not download resume PDF: ${err.message}`);
          result = { success: false, notes: `PDF download failed: ${err.message}` };
          await updateApplyStatus(sheets, rowIndex, {
            status: "failed",
            appliedAt: new Date().toISOString(),
            notes: result.notes,
          });
          continue;
        }

        const job = { jobUrl, resumePath, resumeUrl, coverLetter, company, title };

        if (platform === "greenhouse" || platform === "icims") {
          result = await applyGreenhouse(browser, job);
        } else if (platform === "workday") {
          result = await applyWorkday(browser, job);
        } else if (platform === "ashby") {
          result = await applyAshby(browser, job);
        } else if (platform === "smartrecruiters") {
          result = await applySmartRecruiters(browser, job);
        } else if (platform === "breezy") {
          result = await applyBreezy(browser, job);
        } else if (platform === "workable") {
          result = await applyWorkable(browser, job);
        } else if (platform === "recruitee") {
          result = await applyRecruitee(browser, job);
        } else if (platform === "hiring-cafe") {
          result = await applyHiringCafe(browser, job);
        }
      } else if (platform === "lever") {
        const job = { jobUrl, resumeUrl, coverLetter, company, title };
        result = await applyLever(job);
      } else {
        // Unknown platform — skip and mark as manual
        result = { success: false, notes: "manual-required: unsupported platform" };
      }

      const now = new Date().toISOString();

      if (result.success) {
        console.log(`  ✅ Applied: ${company} — ${title} | ${result.notes}`);
        await updateApplyStatus(sheets, rowIndex, {
          status: DRY_RUN ? "pending" : "applied",
          appliedAt: now,
          notes: result.notes,
        });
        applied.push({ company, title, atsScore, resumeUrl });
      } else {
        console.log(`  ❌ Failed: ${company} — ${title} | ${result.notes}`);
        // Don't mark as failed if it's a manual-required — keep as pending
        const newStatus = result.notes?.startsWith("manual-required") ? "manual-required" : "failed";
        await updateApplyStatus(sheets, rowIndex, {
          status: newStatus,
          appliedAt: now,
          notes: result.notes,
        });
      }

      // Small delay between applications
      await new Promise((r) => setTimeout(r, 3000));
    }
  } finally {
    await browser.close();

    // Clean up tmp files
    for (const p of tmpFiles) {
      await unlink(p).catch(() => {});
    }
  }

  console.log(`\n📊  Summary`);
  console.log(`  ✅ Applied:          ${applied.length}`);
  console.log(`  ❌ Failed/skipped:   ${toApply.length - applied.length}`);

  await sendApplyNotification(applied);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
