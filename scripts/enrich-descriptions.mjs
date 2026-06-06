#!/usr/bin/env node
/**
 * enrich-descriptions.mjs
 *
 * Backfills column G (Description) for rows that have a URL (column D)
 * but are missing a description or have one shorter than MIN_DESC_LENGTH.
 *
 * Usage:
 *   node scripts/enrich-descriptions.mjs
 *   ENRICH_LIMIT=100 node scripts/enrich-descriptions.mjs
 *   ENRICH_CONCURRENCY=3 ENRICH_LIMIT=500 node scripts/enrich-descriptions.mjs
 *   DRY_RUN=true node scripts/enrich-descriptions.mjs
 *
 * Env vars (loaded from .env.local):
 *   GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON  — required
 *   ENRICH_LIMIT        — max rows to process (default 200)
 *   ENRICH_CONCURRENCY  — parallel Playwright contexts (default 3)
 *   ENRICH_RATE_MS      — min gap between job starts (default 2000)
 *   MIN_DESC_LENGTH     — minimum chars to consider valid (default 30)
 *   DRY_RUN             — if "true", print targets but don't write
 *   SKIP_COMPANIES      — comma-separated company slugs to skip
 */

import { chromium } from "playwright";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";
import { getSheetRows, updateSheetCell } from "./lib/sheet.mjs";
import { mapConcurrent, createThrottle, createMutex } from "./lib/concurrency.mjs";

loadEnvLocal();

try {
  validatePipelineEnv("scrape");
} catch (err) {
  console.error(`❌  ${err.message}`);
  process.exit(1);
}

const ENRICH_LIMIT = parseInt(process.env.ENRICH_LIMIT || "200", 10);
const ENRICH_CONCURRENCY = parseInt(process.env.ENRICH_CONCURRENCY || "3", 10);
const ENRICH_RATE_MS = parseInt(process.env.ENRICH_RATE_MS || "2000", 10);
const MIN_DESC_LENGTH = parseInt(process.env.MIN_DESC_LENGTH || "30", 10);
const DRY_RUN = process.env.DRY_RUN === "true";

const SKIP_COMPANIES = new Set(
  (process.env.SKIP_COMPANIES || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

// Sheet columns A–M (0-based)
const COL = {
  COMPANY: 0,
  TITLE: 1,
  LOCATION: 2,
  URL: 3,
  CATEGORY: 4,
  FETCHED_AT: 5,
  DESCRIPTION: 6,
  RESUME_URL: 7,
};

/**
 * @param {import("playwright").Page} page
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function extractDescription(page, url) {
  const platformSelectors = [
    { match: "greenhouse.io", sel: "#content .job__description, .job-post-content" },
    { match: "ashbyhq.com", sel: '[data-testid="job-description"], .ashby-job-posting-description' },
    { match: "lever.co", sel: ".section-wrapper.page-full-width .section, .posting-description" },
    { match: "myworkdayjobs.com", sel: '[data-automation-id="jobPostingDescription"]' },
    { match: "smartrecruiters.com", sel: ".job-description, [itemprop=\"description\"]" },
    { match: "icims.com", sel: "#job-description, .iCIMS_JobContent" },
    { match: "breezy.hr", sel: ".description" },
    { match: "apply.workable.com", sel: '.styles__description, [data-ui="job-description"]' },
    { match: "recruitee.com", sel: ".job-description, .offer__description" },
  ];

  const matchedPlatform = platformSelectors.find((p) => url.includes(p.match));

  if (matchedPlatform) {
    try {
      await page.waitForSelector(matchedPlatform.sel, { timeout: 8_000 });
      const text = await page.$eval(matchedPlatform.sel, (el) => el.innerText.trim());
      if (text && text.length >= 30) return text;
    } catch {
      // fall through to heuristic
    }
  }

  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 });
    const text = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll("div, section, article"));
      let best = "";
      for (const el of candidates) {
        const t = (el.innerText || "").trim();
        if (t.length > best.length && t.length < 20_000) best = t;
      }
      return best;
    });
    if (text && text.length >= 30) return text.slice(0, 5000);
  } catch {
    // no description
  }

  return null;
}

/** @param {string[]} row */
function needsEnrichment(row) {
  const url = (row[COL.URL] || "").trim();
  const description = (row[COL.DESCRIPTION] || "").trim();
  const company = (row[COL.COMPANY] || "").trim().toLowerCase();

  if (!url) return false;
  if (description.length >= MIN_DESC_LENGTH) return false;
  if (SKIP_COMPANIES.has(company)) return false;
  return true;
}

async function main() {
  console.log("\n🔍 enrich-descriptions.mjs");
  console.log(`   MIN_DESC_LENGTH    = ${MIN_DESC_LENGTH}`);
  console.log(`   ENRICH_LIMIT       = ${ENRICH_LIMIT}`);
  console.log(`   ENRICH_CONCURRENCY = ${ENRICH_CONCURRENCY}`);
  console.log(`   ENRICH_RATE_MS     = ${ENRICH_RATE_MS}`);
  console.log(`   DRY_RUN            = ${DRY_RUN}\n`);

  console.log("📄 Fetching sheet rows…");
  const allRows = await getSheetRows("Jobs");

  const toEnrich = allRows
    .map((row, i) => ({ row, rowIndex: i + 2 }))
    .filter(({ row }) => needsEnrichment(row))
    .slice(0, ENRICH_LIMIT);

  console.log(`   Total rows in sheet : ${allRows.length}`);
  console.log(`   Rows needing enrich : ${toEnrich.length}\n`);

  if (toEnrich.length === 0) {
    console.log("✅ Nothing to enrich. Exiting.");
    return;
  }

  if (DRY_RUN) {
    console.log("🟡 DRY_RUN=true — showing what would be enriched:\n");
    for (const { row, rowIndex } of toEnrich) {
      const company = row[COL.COMPANY] || "";
      const title = row[COL.TITLE] || "";
      console.log(`   Row ${rowIndex}: ${company} — ${title} — ${(row[COL.URL] || "").slice(0, 80)}`);
    }
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const throttle = createThrottle(ENRICH_RATE_MS);
  const sheetMutex = createMutex();
  const stats = { success: 0, failed: 0, skipped: 0 };

  await mapConcurrent(toEnrich, ENRICH_CONCURRENCY, async ({ row, rowIndex }) => {
    const url = (row[COL.URL] || "").trim();
    const company = (row[COL.COMPANY] || "").trim();

    await throttle();

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    try {
      console.log(`   ⏳ Row ${rowIndex}: ${company} → ${url.slice(0, 80)}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });

      const description = await extractDescription(page, url);

      if (description && description.length >= MIN_DESC_LENGTH) {
        const value = description.slice(0, 5000);
        await sheetMutex.run(() => updateSheetCell("Jobs", rowIndex, "G", value));
        console.log(`   ✅ Row ${rowIndex}: wrote ${description.length} chars`);
        stats.success++;
      } else {
        console.log(`   ⚠️  Row ${rowIndex}: no usable description found`);
        stats.skipped++;
      }
    } catch (err) {
      console.error(`   ❌ Row ${rowIndex}: ${err.message}`);
      stats.failed++;
    } finally {
      await context.close();
    }
  });

  await browser.close();

  console.log("\n──────────────────────────────────");
  console.log("📊 Enrichment complete");
  console.log(`   ✅ Enriched : ${stats.success}`);
  console.log(`   ⚠️  No data  : ${stats.skipped}`);
  console.log(`   ❌ Failed   : ${stats.failed}`);
  console.log("──────────────────────────────────\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
