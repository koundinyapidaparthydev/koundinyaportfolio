/**
 * Playwright scraper for hiring.cafe — pages 1–5 + full job descriptions.
 * Prefers HTTP fetch (faster); falls back to Playwright when HC blocks fetch.
 */

import {
  HC_MAX_PAGES,
  buildHiringCafePageUrl,
  dedupeHcRows,
  extractHcItemsFromPayload,
  getHcShortJobId,
  getJobDedupKey,
  isBetterHcCompanyName,
  isBetterHcJobUrl,
  parseHcItemToRow,
  parseRelativePostedTime,
} from "./hiring-cafe.mjs";
import { scrapeHiringCafeViaFetch } from "./hiring-cafe-fetch.mjs";
import { isUsHcJob } from "./job-location-match.mjs";

const SCROLL_PAUSE_MS = 1_500;
const INITIAL_PAGE_WAIT_MS = 6_000;
const HC_PAGE_LOAD_RETRIES = 3;

const HC_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function createHcBrowserContext(browser) {
  const context = await browser.newContext({
    userAgent: HC_USER_AGENT,
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  return context;
}

async function waitForHcResults(page) {
  for (let attempt = 1; attempt <= HC_PAGE_LOAD_RETRIES; attempt++) {
    const title = await page.title();
    const jobLinks = await page
      .locator('a[href*="/job/"]')
      .count()
      .catch(() => 0);

    if (!/security checkpoint/i.test(title) && jobLinks > 0) {
      return true;
    }

    if (attempt < HC_PAGE_LOAD_RETRIES) {
      console.log(`  ⏳  HC page not ready (attempt ${attempt}/${HC_PAGE_LOAD_RETRIES}) — retrying…`);
      await page.waitForTimeout(2_000 * attempt);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(INITIAL_PAGE_WAIT_MS);
    }
  }
  return false;
}

async function scrapeHiringCafeViaPlaywright(isEngineeringRole) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const stats = {
    pagesFetched: 0,
    fetched: 0,
    afterEngineeringFilter: 0,
    afterUsFilter: 0,
    written: 0,
    skippedNonUs: 0,
    descriptionsEnriched: 0,
    mode: "playwright",
  };

  try {
    const context = await createHcBrowserContext(browser);
    const page = await context.newPage();
    const capturedItems = [];

    page.on("response", async (response) => {
      const url = response.url();
      const ctype = response.headers()["content-type"] ?? "";
      if (!ctype.includes("application/json")) return;
      if (!/jobs|search|listings|postings|algolia|ssr/i.test(url)) return;
      try {
        const data = await response.json();
        const arr = extractHcItemsFromPayload(data);
        if (arr.length > 0) capturedItems.push(...arr);
      } catch {
        /* ignore */
      }
    });

    const fetchedAt = new Date().toISOString();
    const itemMap = new Map();

    function ingestRawItems(items) {
      stats.fetched += items.length;
      for (const item of items) {
        const row = parseHcItemToRow(item, fetchedAt);
        if (!row || !isEngineeringRole(row[1])) continue;
        stats.afterEngineeringFilter++;
        if (!isUsHcJob(row[2])) {
          stats.skippedNonUs++;
          continue;
        }
        stats.afterUsFilter++;
        const key = getJobDedupKey(row);
        if (!key) continue;
        const existing = itemMap.get(key);
        if (!existing) itemMap.set(key, row);
        else {
          if (!existing[6] && row[6]) existing[6] = row[6];
          if ((row[7] ?? "").length > (existing[7] ?? "").length) existing[7] = row[7];
          if (isBetterHcCompanyName(row[0], existing[0])) existing[0] = row[0];
          if (isBetterHcJobUrl(row[3], existing[3])) existing[3] = row[3];
        }
      }
    }

    async function collectFromDom() {
      const domRows = await page.evaluate(() => {
        const results = [];
        const jobLinks = Array.from(document.querySelectorAll("a")).filter((a) =>
          /\/job\/[a-z0-9]{8,}/.test(a.getAttribute("href") ?? a.href ?? "")
        );

        for (const link of jobLinks) {
          const jobUrl = link.href.startsWith("http")
            ? link.href
            : `https://hiring.cafe${link.getAttribute("href")}`;

          let card = link.parentElement;
          for (let i = 0; i < 12 && card; i++) {
            const orgLinks = card.querySelectorAll('a[href*="/org/"]');
            const height = card.getBoundingClientRect?.()?.height ?? 0;
            if (orgLinks.length >= 1 && height > 60) break;
            card = card.parentElement;
          }
          if (!card) continue;

          const cardText = (card.innerText ?? card.textContent ?? "").replace(/\s+/g, " ").trim();
          if (cardText.length < 20) continue;

          const orgEl = card.querySelector('a[href*="/org/"]');
          const company = orgEl?.innerText?.trim() ?? "";

          let title = "";
          for (const sel of ["h1", "h2", "h3", "h4", "strong"]) {
            const el = card.querySelector(sel);
            const t = el?.innerText?.trim() ?? "";
            if (t.length > 5 && t.length < 120) {
              title = t;
              break;
            }
          }
          if (!title) {
            title =
              cardText
                .split(/\s{2,}|\n/)
                .map((s) => s.trim())
                .find(
                  (s) =>
                    s.length > 6 &&
                    s.length < 100 &&
                    !/\$|,\s*United|Full Time|Part Time|Remote|Onsite|Hybrid|\bYOE\b/i.test(s)
                ) ?? "";
          }

          const salary =
            (
              cardText.match(
                /\$[\d,]+[kKmM]?\s*[-–—]\s*\$[\d,]+[kKmM]?(?:\s*\/\s*(?:yr|year|hr))?/
              )?.[0] ?? ""
            ).trim();
          const locMatch = cardText.match(
            /([A-Z][a-zA-Z ]+,\s*[A-Z][a-zA-Z ]+,\s*United States|United States|Remote|[A-Z][a-z]+ [A-Z][a-z]+,\s*[A-Z]{2})/
          );
          const location = locMatch?.[0]?.trim() ?? "";
          const workType = (cardText.match(/\b(Remote|Hybrid|Onsite|On-Site)\b/i)?.[0] ?? "").trim();

          if (!title || !jobUrl.includes("/job/")) continue;
          if (results.some((r) => r.url === jobUrl)) continue;

          const fullLoc = [location, workType].filter(Boolean).join(" · ");
          const desc = [salary ? `Salary: ${salary}` : "", cardText.slice(0, 1800)]
            .filter(Boolean)
            .join("\n")
            .slice(0, 2000);

          const relativePosted =
            cardText.match(/\b(?:just now|\d+\s*m|\d+\s*h|\d+\s*d)\b/i)?.[0]?.trim() ?? "";

          results.push({ company, title, location: fullLoc, url: jobUrl, desc, relativePosted });
        }
        return results;
      });

      for (const { company, title, location, url, desc, relativePosted } of domRows) {
        if (!isEngineeringRole(title)) continue;
        const postedAt = relativePosted
          ? parseRelativePostedTime(relativePosted, new Date(fetchedAt))
          : "";

        if (itemMap.has(url)) {
          const existing = itemMap.get(url);
          if (!existing[6] && postedAt) existing[6] = postedAt;
          if (!existing[2] && location) existing[2] = location.slice(0, 150);
          continue;
        }

        if (!isUsHcJob(location)) {
          stats.skippedNonUs++;
          continue;
        }

        stats.afterUsFilter++;
        itemMap.set(url, [
          company,
          title.slice(0, 100),
          location.slice(0, 150),
          url,
          "hiring-cafe",
          fetchedAt,
          postedAt,
          desc,
        ]);
      }
    }

    async function collectAllSources() {
      ingestRawItems(capturedItems);
      const nextData = await page.evaluate(() => {
        try {
          const el = document.getElementById("__NEXT_DATA__");
          return el ? JSON.parse(el.textContent ?? "{}") : null;
        } catch {
          return null;
        }
      });
      if (nextData) ingestRawItems(extractHcItemsFromPayload(nextData));
      await collectFromDom();
    }

    for (let pageIndex = 0; pageIndex < HC_MAX_PAGES; pageIndex++) {
      const pageUrl = buildHiringCafePageUrl(pageIndex);
      console.log(`  🔗  HC page ${pageIndex + 1}/${HC_MAX_PAGES}: ${pageUrl.slice(0, 90)}…`);
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(INITIAL_PAGE_WAIT_MS);

      const pageReady = await waitForHcResults(page);
      if (!pageReady) {
        console.log(`  ⚠️  HC page ${pageIndex + 1} blocked or empty`);
        continue;
      }

      stats.pagesFetched++;
      await collectAllSources();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(SCROLL_PAUSE_MS);
    }

    const rows = dedupeHcRows([...itemMap.values()]);
    stats.written = rows.length;
    return { rows, stats };
  } finally {
    await browser.close().catch(() => {});
  }
}

function logHcSummary(stats, mode) {
  console.log(
    `  ✓  Hiring Cafe summary (${mode}): pages=${stats.pagesFetched}/${HC_MAX_PAGES} ` +
      `fetched=${stats.fetched ?? stats.written} eng=${stats.afterEngineeringFilter} ` +
      `us=${stats.afterUsFilter} written=${stats.written ?? stats.afterUsFilter} ` +
      `skippedNonUs=${stats.skippedNonUs}` +
      (stats.descriptionsEnriched ? ` descEnriched=${stats.descriptionsEnriched}` : "")
  );
}

/**
 * Scrape engineering jobs from Hiring Cafe pages 1–5 with full descriptions.
 * @param {(title: string) => boolean} isEngineeringRole
 * @returns {Promise<string[][]>} normalized scrape rows
 */
export async function scrapeAllHiringCafeJobs(isEngineeringRole) {
  try {
    const { rows, stats } = await scrapeHiringCafeViaFetch(isEngineeringRole, isUsHcJob);
    if (stats.afterUsFilter > 0) {
      const deduped = dedupeHcRows(rows);
      stats.written = deduped.length;
      logHcSummary(stats, "fetch");
      return deduped;
    }
    console.log("  ⚠️  HC HTTP fetch returned 0 US jobs — falling back to Playwright");
  } catch (err) {
    console.warn(`  ⚠️  HC HTTP fetch failed (${err.message}) — falling back to Playwright`);
  }

  const { rows, stats } = await scrapeHiringCafeViaPlaywright(isEngineeringRole);
  logHcSummary(stats, "playwright");
  return rows;
}
