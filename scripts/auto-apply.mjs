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
 *   RECORD_APPLY=true            – save video/trace/screenshots under artifacts/ per row
 */

import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";

loadEnvLocal();

import { chromium } from "playwright";
import { google } from "googleapis";
import { tmpdir } from "os";
import { join } from "path";
import path from "path";
import { fileURLToPath } from "url";
import { unlink, mkdir } from "fs/promises";
import { pipeline } from "stream/promises";
import { createWriteStream as createWS } from "fs";
import { resolveApplicant } from "./lib/applicant-profile.mjs";

try {
  validatePipelineEnv("apply");
} catch (err) {
  console.error(`❌  ${err.message}`);
  process.exit(1);
}

const GOOGLE_SHEET_ID             = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const DRY_RUN                     = process.env.DRY_RUN === "true";
const APPLY_LIMIT                 = parseInt(process.env.APPLY_LIMIT ?? "200", 10);
const RECORD_APPLY                = process.env.RECORD_APPLY === "true";

const ARTIFACT_DIRS = {
  videos: "artifacts/apply-videos",
  traces: "artifacts/traces",
  screenshots: "artifacts/screenshots",
};

// Applicant personal info (Profile 3 via PersonalService or APPLICANT_* env)
const APPLICANT = resolveApplicant();

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

async function ensureArtifactDirs() {
  await Promise.all(Object.values(ARTIFACT_DIRS).map((d) => mkdir(d, { recursive: true })));
}

function buildSubmitResult(confirmed) {
  if (confirmed) return { success: true, notes: "submitted" };
  return { success: false, notes: "submitted-unconfirmed" };
}

function makeRecordingHelpers(rowIndex) {
  return {
    rowIndex,
    async screenshot(page, label) {
      const safeLabel = String(label).replace(/[^a-z0-9_-]/gi, "-");
      const filePath = join(ARTIFACT_DIRS.screenshots, `row-${rowIndex}-${safeLabel}.png`);
      await page.screenshot({ path: filePath, fullPage: false }).catch(() => {});
    },
  };
}

async function submitAndConfirm(page, job, submitFn, confirmPattern) {
  const { recording, company } = job;
  if (recording) await recording.screenshot(page, "before-submit");
  await submitFn();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  if (recording) await recording.screenshot(page, "after-submit");
  const body = await page.content();
  const confirmed = confirmPattern.test(body);
  if (!confirmed) {
    console.warn(`  ⚠  Submit uncertain for ${company}`);
  }
  return buildSubmitResult(confirmed);
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

async function applyGreenhouse(pw, job) {
  const { jobUrl, resumePath, coverLetter, company, title, recording } = job;

  const page = await pw.newPage();
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

    return await submitAndConfirm(
      page,
      job,
      () => page.locator('button[type="submit"], input[type="submit"]').last().click(),
      /thank you|application submitted|we.ll be in touch|confirmation/i,
    );
  } catch (err) {
    if (recording) await recording.screenshot(page, "error");
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

async function applyWorkday(pw, job) {
  const { jobUrl, resumePath, coverLetter, company, title, recording } = job;
  const page = await pw.newPage();
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

    return await submitAndConfirm(
      page,
      job,
      () => submitBtn.click(),
      /thank you|submitted|confirmation/i,
    );
  } catch (err) {
    if (recording) await recording.screenshot(page, "error");
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ashby apply — Playwright (standard web form, similar structure to Greenhouse)
// ─────────────────────────────────────────────────────────────────────────────

async function applyAshby(pw, job) {
  const { jobUrl, resumePath, coverLetter, company, title, recording } = job;
  const page = await pw.newPage();
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

    return await submitAndConfirm(
      page,
      job,
      () => page.locator('button[type="submit"]').last().click(),
      /thank you|submitted|confirmation/i,
    );
  } catch (err) {
    if (recording) await recording.screenshot(page, "error");
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SmartRecruiters apply — Playwright
// ─────────────────────────────────────────────────────────────────────────────

async function applySmartRecruiters(pw, job) {
  const { jobUrl, resumePath, coverLetter, company, title, recording } = job;
  const page = await pw.newPage();
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

    return await submitAndConfirm(
      page,
      job,
      () => page.locator('button[type="submit"]').last().click(),
      /thank you|submitted|confirmation|application received/i,
    );
  } catch (err) {
    if (recording) await recording.screenshot(page, "error");
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BreezyHR apply — Playwright
// ─────────────────────────────────────────────────────────────────────────────

async function applyBreezy(pw, job) {
  const { jobUrl, resumePath, coverLetter, company, title, recording } = job;
  const page = await pw.newPage();
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

    return await submitAndConfirm(
      page,
      job,
      () => page.locator('button[type="submit"]').last().click(),
      /thank you|submitted|application received/i,
    );
  } catch (err) {
    if (recording) await recording.screenshot(page, "error");
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Workable apply — Playwright
// ─────────────────────────────────────────────────────────────────────────────

async function applyWorkable(pw, job) {
  const { jobUrl, resumePath, coverLetter, company, title, recording } = job;
  const page = await pw.newPage();
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

    return await submitAndConfirm(
      page,
      job,
      () => page.locator('button[type="submit"]').last().click(),
      /thank you|application submitted|confirmation/i,
    );
  } catch (err) {
    if (recording) await recording.screenshot(page, "error");
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Recruitee apply — Playwright
// ─────────────────────────────────────────────────────────────────────────────

async function applyRecruitee(pw, job) {
  const { jobUrl, resumePath, coverLetter, company, title, recording } = job;
  const page = await pw.newPage();
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

    return await submitAndConfirm(
      page,
      job,
      () => page.locator('button[type="submit"]').last().click(),
      /thank you|submitted|application received/i,
    );
  } catch (err) {
    if (recording) await recording.screenshot(page, "error");
    return { success: false, notes: err.message?.slice(0, 200) ?? "unknown error" };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hiring Cafe apply — resolves the actual external ATS URL then delegates
// ─────────────────────────────────────────────────────────────────────────────

async function applyHiringCafe(pw, job) {
  const { jobUrl, resumePath, resumeUrl, coverLetter, company, title, recording } = job;
  const page = await pw.newPage();

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
      const parentContext = page.context();
      const [newTab] = await Promise.all([
        parentContext.waitForEvent("page", { timeout: 10_000 }).catch(() => null),
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
    const outerJob  = { jobUrl: externalUrl, resumePath, resumeUrl, coverLetter, company, title, recording };
    const pwPlatforms = ["greenhouse", "icims", "workday", "ashby", "smartrecruiters", "breezy", "workable", "recruitee"];

    if (pwPlatforms.includes(platform)) {
      if (platform === "greenhouse" || platform === "icims") return await applyGreenhouse(pw, outerJob);
      if (platform === "workday")        return await applyWorkday(pw, outerJob);
      if (platform === "ashby")          return await applyAshby(pw, outerJob);
      if (platform === "smartrecruiters") return await applySmartRecruiters(pw, outerJob);
      if (platform === "breezy")         return await applyBreezy(pw, outerJob);
      if (platform === "workable")       return await applyWorkable(pw, outerJob);
      if (platform === "recruitee")      return await applyRecruitee(pw, outerJob);
    }

    if (platform === "lever") {
      return await applyLever({ jobUrl: externalUrl, resumeUrl, coverLetter, company, title });
    }

    return { success: false, notes: `manual-required: ${platform} at ${externalUrl.slice(0, 80)}` };

  } catch (err) {
    if (recording) await recording.screenshot(page, "error");
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
    // React/Workday controls often ignore fill() without synthetic events (AplifyAI pattern)
    await el.evaluate((node, val) => {
      if (!node || val == null) return;
      node.value = val;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    }, value).catch(() => {});
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
// Apply recording (Playwright video + trace + screenshots → artifacts/)
// ─────────────────────────────────────────────────────────────────────────────

async function runPlaywrightApply(pwTarget, applyFn) {
  return applyFn(pwTarget, null);
}

async function runRecordedPlaywrightApply(browser, rowIndex, applyFn) {
  await ensureArtifactDirs();
  const tracePath = join(ARTIFACT_DIRS.traces, `row-${rowIndex}-trace.zip`);
  const recording = makeRecordingHelpers(rowIndex);

  const context = await browser.newContext({
    recordVideo: { dir: ARTIFACT_DIRS.videos, size: { width: 1280, height: 720 } },
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  let result;
  try {
    result = await applyFn(context, recording);
  } finally {
    await context.tracing.stop({ path: tracePath }).catch(() => {});
    await context.close();
  }

  console.log(`  🎬 Recordings saved under artifacts/ (row ${rowIndex})`);
  return result;
}

async function invokePlaywrightApply(browser, rowIndex, applyFn) {
  if (!RECORD_APPLY) {
    return runPlaywrightApply(browser, applyFn);
  }
  return runRecordedPlaywrightApply(browser, rowIndex, applyFn);
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply a single sheet row (used by process-job-batch.mjs for same-row chaining)
// ─────────────────────────────────────────────────────────────────────────────

export async function applyToRow(browser, sheets, rowIndex, values, { tmpFiles = [] } = {}) {
  const company     = values[COL.COMPANY]      ?? "";
  const title       = values[COL.TITLE]        ?? "";
  const jobUrl      = values[COL.URL]          ?? "";
  const resumeUrl   = values[COL.RESUME_URL]   ?? "";
  const coverLetter = values[COL.COVER_LETTER] ?? "";
  const atsScore    = values[COL.ATS_SCORE]    ?? "";

  if (!resumeUrl) {
    return { success: false, notes: "no resume URL", applied: null };
  }

  const platform = detectPlatform(jobUrl);
  console.log(`  📝 [${platform.toUpperCase()}] ${company} — ${title} (row ${rowIndex})`);

  let result = { success: false, notes: "unsupported platform" };
  const playwrightPlatforms = [
    "greenhouse", "icims", "workday", "ashby", "smartrecruiters",
    "breezy", "workable", "recruitee", "hiring-cafe",
  ];

  if (playwrightPlatforms.includes(platform)) {
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
      return { ...result, applied: null };
    }

    const job = { jobUrl, resumePath, resumeUrl, coverLetter, company, title };

    const runApply = async (pw, recording) => {
      const jobWithRecording = { ...job, recording };
      if (platform === "greenhouse" || platform === "icims") return applyGreenhouse(pw, jobWithRecording);
      if (platform === "workday") return applyWorkday(pw, jobWithRecording);
      if (platform === "ashby") return applyAshby(pw, jobWithRecording);
      if (platform === "smartrecruiters") return applySmartRecruiters(pw, jobWithRecording);
      if (platform === "breezy") return applyBreezy(pw, jobWithRecording);
      if (platform === "workable") return applyWorkable(pw, jobWithRecording);
      if (platform === "recruitee") return applyRecruitee(pw, jobWithRecording);
      if (platform === "hiring-cafe") return applyHiringCafe(pw, jobWithRecording);
      return { success: false, notes: "unsupported platform" };
    };

    result = await invokePlaywrightApply(browser, rowIndex, runApply);
  } else if (platform === "lever") {
    result = await applyLever({ jobUrl, resumeUrl, coverLetter, company, title });
  } else {
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
    return {
      success: true,
      notes: result.notes,
      applied: { company, title, atsScore, resumeUrl },
    };
  }

  if (result.notes === "submitted-unconfirmed") {
    console.log(`  ⚠  Needs review: ${company} — ${title} | ${result.notes}`);
    await updateApplyStatus(sheets, rowIndex, {
      status: "needs-review",
      appliedAt: now,
      notes: result.notes,
    });
    return { success: false, notes: result.notes, applied: null };
  }

  console.log(`  ❌ Failed: ${company} — ${title} | ${result.notes}`);
  const newStatus = result.notes?.startsWith("manual-required") ? "manual-required" : "failed";
  await updateApplyStatus(sheets, rowIndex, {
    status: newStatus,
    appliedAt: now,
    notes: result.notes,
  });
  return { success: false, notes: result.notes, applied: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🚀  Auto-Apply — starting${DRY_RUN ? " (DRY RUN)" : ""}\n`);
  console.log(`  Applicant: ${APPLICANT.email} (source: ${APPLICANT.profileSource ?? "env"})\n`);

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
      const outcome = await applyToRow(browser, sheets, rowIndex, values, { tmpFiles });
      if (outcome.applied) applied.push(outcome.applied);
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

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
