/**
 * Sheet sync for the Hiring Cafe pipeline — refresh discovered times, dedupe, filter new rows.
 */

import { getJobDedupKey } from "./hiring-cafe.mjs";

/** Matches GHA cron and local loop interval. */
export const HC_PIPELINE_INTERVAL_MS = 10 * 60 * 1000;

function padRow14(row) {
  const out = [...(row ?? [])];
  while (out.length < 14) out.push("");
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
    const padded = padRow14(row);
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
  for (const row of scrapedRows) {
    const key = getJobDedupKey(row);
    if (key) scrapedByKey.set(key, discoveredAt);
  }
  if (scrapedByKey.size === 0) return 0;

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!D2:D`,
  });
  const urlRows = resp.data.values ?? [];
  if (urlRows.length === 0) return 0;

  const updateData = [];
  for (let i = 0; i < urlRows.length; i++) {
    const url = urlRows[i]?.[0] ?? "";
    if (!url) continue;
    const key = getJobDedupKey([null, null, null, url]);
    if (!key || !scrapedByKey.has(key)) continue;
    updateData.push({
      range: `${sheetName}!F${i + 2}`,
      values: [[discoveredAt]],
    });
  }

  if (updateData.length === 0) return 0;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data: updateData },
  });
  console.log(`🔄  Refreshed discovered-at for ${updateData.length} existing job(s)`);
  return updateData.length;
}

/**
 * Remove duplicate rows on Jobs tab (by HC dedup key, then company+title). Keeps newest fetchedAt.
 * @returns {number} duplicates removed
 */
export async function compactJobsSheet(sheets, spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:N`,
  });
  const rows = res.data.values ?? [];
  if (rows.length === 0) return 0;

  const withMeta = rows.map((row, idx) => {
    const padded = padRow14(row);
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
    range: `${sheetName}!A2:N`,
  });
  if (keep.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A2:N`,
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
