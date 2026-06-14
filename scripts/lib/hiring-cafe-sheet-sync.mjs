/**
 * Sheet sync for the Hiring Cafe pipeline — refresh discovered times, dedupe, filter new rows.
 */

import { getJobDedupKey, isBetterHcCompanyName, isBetterHcJobUrl } from "./hiring-cafe.mjs";

/** Matches GHA cron and local loop interval. */
export const HC_PIPELINE_INTERVAL_MS = 10 * 60 * 1000;

function padRow21(row) {
  const out = [...(row ?? [])];
  while (out.length < 21) out.push("");
  return out;
}

/** Secondary dedup: same company + title = duplicate role. */
export function getRoleDedupKey(row) {
  const company = (row?.[0] ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const title = (row?.[1] ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!company || !title) return "";
  return `role:${company}|${title}`;
}

/**
 * Load dedup + role keys already on a sheet tab (column D URLs).
 * @returns {{ keys: Set<string>; roleKeys: Set<string> }}
 */
export async function loadSheetDedupSets(sheets, spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:D`,
  });
  const keys = new Set();
  const roleKeys = new Set();
  for (const row of res.data.values ?? []) {
    const padded = padRow21(row);
    const key = getJobDedupKey(padded);
    const role = getRoleDedupKey(padded);
    if (key) keys.add(key);
    if (role) roleKeys.add(role);
  }
  return { keys, roleKeys };
}

/**
 * Bump column F for rows whose dedup key appears in this scrape (last seen / discovered).
 * @returns {number} rows updated
 */
export async function refreshDiscoveredAt(
  sheets,
  spreadsheetId,
  sheetName,
  scrapedRows,
  discoveredAt
) {
  const scrapedByKey = new Map();
  const scrapedByRole = new Map();
  for (const row of scrapedRows) {
    const key = getJobDedupKey(row);
    const role = getRoleDedupKey(row);
    if (key) scrapedByKey.set(key, row);
    if (role) scrapedByRole.set(role, row);
  }
  if (scrapedByKey.size === 0 && scrapedByRole.size === 0) return 0;

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:U`,
  });
  const rows = resp.data.values ?? [];
  if (rows.length === 0) return 0;

  const updateData = [];
  let refreshed = 0;

  for (let i = 0; i < rows.length; i++) {
    const padded = padRow21(rows[i]);
    const key = getJobDedupKey(padded);
    const role = getRoleDedupKey(padded);
    const scraped = (key && scrapedByKey.get(key)) || (role && scrapedByRole.get(role));
    if (!scraped) continue;

    const sheetRow = i + 2;
    updateData.push({
      range: `${sheetName}!F${sheetRow}`,
      values: [[discoveredAt]],
    });
    refreshed++;

    if (isBetterHcCompanyName(scraped[0], padded[0])) {
      updateData.push({
        range: `${sheetName}!A${sheetRow}`,
        values: [[scraped[0]]],
      });
    }
    if (isBetterHcJobUrl(scraped[3], padded[3])) {
      updateData.push({
        range: `${sheetName}!D${sheetRow}`,
        values: [[scraped[3]]],
      });
    }
  }

  if (updateData.length === 0) return 0;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data: updateData },
  });
  console.log(`🔄  Refreshed discovered-at for ${refreshed} existing job(s)`);
  return refreshed;
}

/**
 * Remove duplicate rows on Jobs tab (by HC dedup key, then company+title). Keeps newest fetchedAt.
 * @returns {number} duplicates removed
 */
export async function compactJobsSheet(sheets, spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:U`,
  });
  const rows = res.data.values ?? [];
  if (rows.length === 0) return 0;

  const withMeta = rows.map((row, idx) => {
    const padded = padRow21(row);
    const fetchedMs = Date.parse(padded[5] ?? "") || 0;
    return {
      padded,
      sheetRow: idx + 2,
      fetchedMs,
      key: getJobDedupKey(padded),
      role: getRoleDedupKey(padded),
    };
  });

  withMeta.sort((a, b) => b.fetchedMs - a.fetchedMs);

  const seenKeys = new Set();
  const seenRoles = new Set();
  const keep = [];

  for (const item of withMeta) {
    const dupKey = item.key && seenKeys.has(item.key);
    const dupRole = item.role && seenRoles.has(item.role);
    if (dupKey || dupRole) continue;
    if (item.key) seenKeys.add(item.key);
    if (item.role) seenRoles.add(item.role);
    keep.push(item.padded);
  }

  const removed = rows.length - keep.length;
  if (removed === 0) return 0;

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A2:U`,
  });
  if (keep.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A2:U`,
      valueInputOption: "RAW",
      requestBody: { values: keep },
    });
  }
  console.log(`🧹  Removed ${removed} duplicate row(s) from "${sheetName}"`);
  return removed;
}

/**
 * Rows not yet on sheet (dedup key + role key vs Jobs + Old Jobs).
 */
export function filterNewHcJobs(scrapedRows, knownKeys, knownRoleKeys) {
  const batchKeys = new Set();
  const batchRoles = new Set();
  const out = [];

  for (const row of scrapedRows) {
    const key = getJobDedupKey(row);
    const role = getRoleDedupKey(row);
    if (!key) continue;
    if (knownKeys.has(key) || batchKeys.has(key)) continue;
    if (role && (knownRoleKeys.has(role) || batchRoles.has(role))) continue;
    batchKeys.add(key);
    if (role) batchRoles.add(role);
    out.push(row);
  }
  return out;
}
