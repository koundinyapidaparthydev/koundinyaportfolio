/**
 * Playwright scraper for hiring.cafe — department search with full pagination.
 */

import {
  buildHiringCafeSearchUrl,
  dedupeHcRows,
  extractHcItemsFromPayload,
  parseHcItemToRow,
  parseRelativePostedTime,
} from "./hiring-cafe.mjs";
import { isUsHcJob } from "./job-location-match.mjs";

const MAX_PAGINATION_ROUNDS = 40;
const STABLE_ROUNDS_TO_STOP = 3;
const SCROLL_PAUSE_MS = 1_500;

/**
 * Scrape all engineering jobs from Hiring Cafe (department-based search).
 * Paginates via scroll + "Load more" until no new listings appear.
 *
 * @param {(title: string) => boolean} isEngineeringRole
 * @returns {Promise<string[][]>} normalized scrape rows
 */
export async function scrapeAllHiringCafeJobs(isEngineeringRole) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });

  const stats = {
    fetched: 0,
    afterEngineeringFilter: 0,
    afterUsFilter: 0,
    written: 0,
    skippedNonUs: 0,
  };

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });
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

    const searchUrl = buildHiringCafeSearchUrl();
    console.log(`  🔗  Hiring Cafe: ${searchUrl.slice(0, 80)}…`);

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(4_000);

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
        const key = row[3];
        if (!key) continue;
        const existing = itemMap.get(key);
        if (!existing) {
          itemMap.set(key, row);
        } else if (!existing[6] && row[6]) {
          existing[6] = row[6];
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

          results.push({
            company: company || "Hiring Cafe",
            title,
            location: fullLoc,
            url: jobUrl,
            desc,
            relativePosted,
          });
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
        const row = [
          company,
          title.slice(0, 100),
          location.slice(0, 150),
          url,
          "hiring-cafe",
          fetchedAt,
          postedAt,
          desc,
        ];
        itemMap.set(url, row);
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

    await collectAllSources();

    let stableRounds = 0;
    let paginationExhausted = false;
    for (let round = 0; round < MAX_PAGINATION_ROUNDS && stableRounds < STABLE_ROUNDS_TO_STOP; round++) {
      const before = itemMap.size;

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(SCROLL_PAUSE_MS);

      const loadMore = page
        .locator(
          'button:has-text("Load more"), button:has-text("Show more"), button:has-text("See more")'
        )
        .first();
      if (await loadMore.isVisible({ timeout: 400 }).catch(() => false)) {
        await loadMore.click({ timeout: 3_000 }).catch(() => {});
        await page.waitForTimeout(SCROLL_PAUSE_MS);
      }

      await collectAllSources();

      if (itemMap.size === before) stableRounds++;
      else stableRounds = 0;
    }
    paginationExhausted = stableRounds >= STABLE_ROUNDS_TO_STOP;

    const rows = dedupeHcRows([...itemMap.values()]);
    stats.written = rows.length;
    console.log(
      `  ✓  Hiring Cafe summary: fetched=${stats.fetched} eng=${stats.afterEngineeringFilter} us=${stats.afterUsFilter} written=${stats.written} skippedNonUs=${stats.skippedNonUs} (${paginationExhausted ? "exhausted" : "partial"} pagination)`
    );
    return rows;
  } finally {
    await browser.close().catch(() => {});
  }
}
