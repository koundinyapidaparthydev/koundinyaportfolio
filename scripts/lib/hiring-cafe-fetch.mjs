/**
 * HTTP fetch helpers for Hiring Cafe — search pages 1–5 and full job descriptions.
 * Uses HC Next.js SSR / _next/data endpoints (no Playwright required).
 */

import {
  HC_MAX_PAGES,
  buildHiringCafePageUrl,
  buildHiringCafeSearchState,
  extractFullDescriptionFromJobPayload,
  extractHcItemsFromPayload,
  getHcShortJobId,
  parseHcItemToRow,
} from "./hiring-cafe.mjs";

const HC_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

const DEFAULT_BUILD_ID = "FVf1IR-TcysIb8PGlkRwI";
const DESCRIPTION_FETCH_CONCURRENCY = Number(process.env.HC_DESCRIPTION_CONCURRENCY) || 5;
const DESCRIPTION_FETCH_LIMIT = Number(process.env.HC_DESCRIPTION_FETCH_LIMIT) || 200;

let cachedBuildId = "";
let buildIdFetchedAt = 0;
const BUILD_ID_TTL_MS = 60 * 60_000;

function parseNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export async function fetchHcBuildId(force = false) {
  if (!force && cachedBuildId && Date.now() - buildIdFetchedAt < BUILD_ID_TTL_MS) {
    return cachedBuildId;
  }
  const res = await fetch("https://hiring.cafe/", {
    headers: HC_FETCH_HEADERS,
    signal: AbortSignal.timeout(20_000),
  });
  const html = await res.text();
  const fromHtml = html.match(/"buildId":"([^"]+)"/)?.[1];
  cachedBuildId = fromHtml || DEFAULT_BUILD_ID;
  buildIdFetchedAt = Date.now();
  return cachedBuildId;
}

/**
 * Fetch one search results page (pageIndex 0 = page 1).
 * @returns {Promise<{ hits: object[]; pageIndex: number; source: string }>}
 */
export async function fetchHcSearchPage(pageIndex = 0) {
  const buildId = await fetchHcBuildId();
  const searchState = encodeURIComponent(JSON.stringify(buildHiringCafeSearchState()));
  const pageParam = pageIndex > 0 ? `&page=${pageIndex}` : "";
  const dataUrl =
    `https://hiring.cafe/_next/data/${buildId}/index.json?searchState=${searchState}${pageParam}`;

  const dataRes = await fetch(dataUrl, {
    headers: { ...HC_FETCH_HEADERS, "x-nextjs-data": "1" },
    signal: AbortSignal.timeout(30_000),
  });

  if (dataRes.ok) {
    const data = await dataRes.json();
    const hits = extractHcItemsFromPayload(data?.pageProps ?? data);
    if (hits.length > 0) {
      return { hits, pageIndex, source: "next-data" };
    }
  }

  const htmlRes = await fetch(buildHiringCafePageUrl(pageIndex), {
    headers: HC_FETCH_HEADERS,
    signal: AbortSignal.timeout(30_000),
  });
  const html = await htmlRes.text();
  const nextData = parseNextData(html);
  const hits = extractHcItemsFromPayload(nextData?.props?.pageProps ?? nextData);
  return { hits, pageIndex, source: "html" };
}

/** Fetch full job detail JSON for a HC short id (requisition_id). */
export async function fetchHcJobDetail(shortId, buildId = null) {
  if (!shortId) return null;
  const bid = buildId || (await fetchHcBuildId());
  const url = `https://hiring.cafe/_next/data/${bid}/job/${shortId}.json`;
  const res = await fetch(url, {
    headers: { ...HC_FETCH_HEADERS, "x-nextjs-data": "1" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.pageProps?.job ?? null;
}

async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

/**
 * Replace short card summaries with full Job Description tab text where possible.
 * @param {Map<string, string[]>} itemMap url → scrape row
 */
export async function enrichHcDescriptions(itemMap, { limit = DESCRIPTION_FETCH_LIMIT } = {}) {
  const entries = [...itemMap.entries()].filter(([, row]) => (row[7] ?? "").length < 400);
  const batch = entries.slice(0, limit);
  if (batch.length === 0) return 0;

  const buildId = await fetchHcBuildId();
  let enriched = 0;

  await mapConcurrent(batch, DESCRIPTION_FETCH_CONCURRENCY, async ([, row]) => {
    const shortId = row[8];
    if (!shortId) return;
    const job = await fetchHcJobDetail(shortId, buildId);
    const full = extractFullDescriptionFromJobPayload(job);
    if (full.length >= 120 && full.length > (row[7] ?? "").length) {
      row[7] = full;
      enriched++;
    }
  });

  return enriched;
}

/**
 * Scrape HC pages 1–5 via HTTP. Returns raw scrape rows + stats.
 * Row shape: [company, title, location, url, category, fetchedAt, postedAt, description, shortId]
 */
export async function scrapeHiringCafeViaFetch(isEngineeringRole, isUsHcJob) {
  const fetchedAt = new Date().toISOString();
  const itemMap = new Map();
  const stats = {
    pagesFetched: 0,
    fetched: 0,
    afterEngineeringFilter: 0,
    afterUsFilter: 0,
    skippedNonUs: 0,
    descriptionsEnriched: 0,
  };

  for (let pageIndex = 0; pageIndex < HC_MAX_PAGES; pageIndex++) {
    let result;
    try {
      result = await fetchHcSearchPage(pageIndex);
    } catch (err) {
      console.warn(`  ⚠  HC page ${pageIndex + 1} fetch failed: ${err.message}`);
      continue;
    }

    stats.pagesFetched++;
    stats.fetched += result.hits.length;
    console.log(
      `  📄  HC page ${pageIndex + 1}/${HC_MAX_PAGES}: ${result.hits.length} hits (${result.source})`
    );

    for (const item of result.hits) {
      const row = parseHcItemToRow(item, fetchedAt);
      if (!row || !isEngineeringRole(row[1])) continue;
      stats.afterEngineeringFilter++;
      if (!isUsHcJob(row[2])) {
        stats.skippedNonUs++;
        continue;
      }
      stats.afterUsFilter++;

      const shortId = getHcShortJobId(item);
      const key = row[3];
      if (!key) continue;

      const withMeta = [...row, shortId];
      const existing = itemMap.get(key);
      if (!existing) {
        itemMap.set(key, withMeta);
      } else {
        if (!existing[6] && withMeta[6]) existing[6] = withMeta[6];
        if (!existing[2] && withMeta[2]) existing[2] = withMeta[2];
        if ((withMeta[7] ?? "").length > (existing[7] ?? "").length) existing[7] = withMeta[7];
        if (!existing[8] && shortId) existing[8] = shortId;
      }
    }
  }

  stats.descriptionsEnriched = await enrichHcDescriptions(itemMap);

  const rows = [...itemMap.values()].map((row) => row.slice(0, 8));
  return { rows, stats };
}
