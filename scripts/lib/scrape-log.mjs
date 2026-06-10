/**
 * Google Sheets tabs for scrape history and diff tracking (sheets-only, no local files).
 */

export const SCRAPE_LOG_TAB = "Scrape Log";
export const CHANGES_TAB = "Significant Changes";

export const SCRAPE_LOG_HEADERS = [
  "Company",
  "Scraped At",
  "Jobs Found",
  "New Jobs",
  "Removed Jobs",
  "Delta 30m",
  "Delta 2h",
  "Delta 24h",
  "Status",
  "Notes",
];

export const CHANGES_HEADERS = [
  "Detected At",
  "Company",
  "Window",
  "Jobs Found",
  "Delta",
  "New Jobs",
  "Removed Jobs",
  "Summary",
];

const WINDOWS = [
  { key: "30m", ms: 30 * 60 * 1000 },
  { key: "2h", ms: 2 * 60 * 60 * 1000 },
  { key: "24h", ms: 24 * 60 * 60 * 1000 },
];

export async function ensureScrapeTabs(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set((meta.data.sheets ?? []).map((s) => s.properties.title));

  const toCreate = [SCRAPE_LOG_TAB, CHANGES_TAB].filter((t) => !existing.has(t));
  if (toCreate.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `${SCRAPE_LOG_TAB}!A1:J1`, values: [SCRAPE_LOG_HEADERS] },
        { range: `${CHANGES_TAB}!A1:H1`, values: [CHANGES_HEADERS] },
      ],
    },
  });
}

export async function readScrapeLog(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SCRAPE_LOG_TAB}!A2:J`,
  });
  return (res.data.values ?? []).map((row) => ({
    company: row[0] ?? "",
    scrapedAt: row[1] ?? "",
    jobsFound: Number(row[2]) || 0,
    newJobs: Number(row[3]) || 0,
    removedJobs: Number(row[4]) || 0,
    status: row[8] ?? "",
  }));
}

function findCountAt(history, company, targetMs) {
  const companyRows = history
    .filter((r) => r.company === company && r.scrapedAt)
    .map((r) => ({ ...r, t: Date.parse(r.scrapedAt) }))
    .filter((r) => !Number.isNaN(r.t))
    .sort((a, b) => a.t - b.t);

  if (!companyRows.length) return null;

  let best = null;
  let bestDiff = Infinity;
  for (const row of companyRows) {
    const diff = Math.abs(row.t - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = row;
    }
  }
  return best?.jobsFound ?? null;
}

export function computeDeltas(history, company, jobsFound, scrapedAtIso) {
  const now = Date.parse(scrapedAtIso);
  const deltas = {};
  for (const { key, ms } of WINDOWS) {
    const pastCount = findCountAt(history, company, now - ms);
    deltas[key] = pastCount == null ? "" : jobsFound - pastCount;
  }
  return {
    delta30m: deltas["30m"],
    delta2h: deltas["2h"],
    delta24h: deltas["24h"],
  };
}

export function isSignificantChange({ newJobs, removedJobs, delta30m, delta2h, delta24h }) {
  const nums = [delta30m, delta2h, delta24h].filter((v) => v !== "" && v != null).map(Number);
  if (newJobs >= 3 || removedJobs >= 3) return true;
  return nums.some((n) => Math.abs(n) >= 5);
}

export async function appendScrapeLog(sheets, spreadsheetId, entry) {
  const row = [
    entry.company,
    entry.scrapedAt,
    entry.jobsFound,
    entry.newJobs,
    entry.removedJobs,
    entry.delta30m ?? "",
    entry.delta2h ?? "",
    entry.delta24h ?? "",
    entry.status,
    entry.notes ?? "",
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SCRAPE_LOG_TAB}!A:J`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export async function appendSignificantChange(sheets, spreadsheetId, entry) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${CHANGES_TAB}!A:H`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        entry.detectedAt,
        entry.company,
        entry.window,
        entry.jobsFound,
        entry.delta,
        entry.newJobs,
        entry.removedJobs,
        entry.summary,
      ]],
    },
  });
}

export async function recordScrapeResult(sheets, spreadsheetId, {
  company,
  scrapedAt,
  jobsFound,
  newJobs,
  removedJobs,
  status,
  notes,
}) {
  await ensureScrapeTabs(sheets, spreadsheetId);
  const history = await readScrapeLog(sheets, spreadsheetId);
  const { delta30m, delta2h, delta24h } = computeDeltas(history, company, jobsFound, scrapedAt);

  await appendScrapeLog(sheets, spreadsheetId, {
    company,
    scrapedAt,
    jobsFound,
    newJobs,
    removedJobs,
    delta30m,
    delta2h,
    delta24h,
    status,
    notes,
  });

  const significant = isSignificantChange({ newJobs, removedJobs, delta30m, delta2h, delta24h });
  if (significant) {
    const windows = [
      { window: "30m", delta: delta30m },
      { window: "2h", delta: delta2h },
      { window: "24h", delta: delta24h },
    ].filter((w) => w.delta !== "" && w.delta != null);

    for (const { window, delta } of windows) {
      if (Math.abs(Number(delta)) >= 5 || newJobs >= 3) {
        await appendSignificantChange(sheets, spreadsheetId, {
          detectedAt: scrapedAt,
          company,
          window,
          jobsFound,
          delta,
          newJobs,
          removedJobs,
          summary: `${company}: ${newJobs} new, ${removedJobs} removed, Δ${window}=${delta}`,
        });
      }
    }
  }

  return { delta30m, delta2h, delta24h, significant };
}
