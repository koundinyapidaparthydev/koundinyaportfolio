/**
 * Google Sheets API rate limiting and 429 retry with exponential backoff.
 * Wrap a sheets client via wrapSheetsClient() so all values.get / batchUpdate
 * calls share one throttle and retry policy.
 */

const MIN_READ_INTERVAL_MS = Number(process.env.SHEETS_READ_INTERVAL_MS) || 350;
const MIN_WRITE_INTERVAL_MS = Number(process.env.SHEETS_WRITE_INTERVAL_MS) || 200;
const MAX_RETRIES = Number(process.env.SHEETS_MAX_RETRIES) || 5;
const MAX_BACKOFF_MS = 60_000;

let lastReadAt = 0;
let lastWriteAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaError(err) {
  const status = err?.code ?? err?.response?.status ?? err?.status;
  const msg = String(err?.message ?? err?.errors?.[0]?.message ?? "");
  return (
    status === 429 ||
    /quota exceeded/i.test(msg) ||
    /rateLimitExceeded/i.test(msg) ||
    /userRateLimitExceeded/i.test(msg)
  );
}

async function throttle(kind) {
  const now = Date.now();
  if (kind === "read") {
    const wait = MIN_READ_INTERVAL_MS - (now - lastReadAt);
    if (wait > 0) await sleep(wait);
    lastReadAt = Date.now();
    return;
  }
  const wait = MIN_WRITE_INTERVAL_MS - (now - lastWriteAt);
  if (wait > 0) await sleep(wait);
  lastWriteAt = Date.now();
}

async function withRetry(label, fn) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (!isQuotaError(err) || attempt >= MAX_RETRIES) throw err;
      const backoff = Math.min(2000 * 2 ** attempt, MAX_BACKOFF_MS);
      attempt += 1;
      console.warn(`⏳  Sheets ${label} quota — retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`);
      await sleep(backoff);
    }
  }
}

/**
 * @param {import("googleapis").sheets_v4.Sheets} sheets
 */
export function wrapSheetsClient(sheets) {
  const values = sheets.spreadsheets.values;
  const origGet = values.get.bind(values);
  const origBatchUpdate = values.batchUpdate.bind(values);
  const origUpdate = values.update.bind(values);
  const origAppend = values.append.bind(values);

  values.get = (params) =>
    withRetry("read", async () => {
      await throttle("read");
      return origGet(params);
    });

  values.batchUpdate = (params) =>
    withRetry("write", async () => {
      await throttle("write");
      return origBatchUpdate(params);
    });

  values.update = (params) =>
    withRetry("write", async () => {
      await throttle("write");
      return origUpdate(params);
    });

  values.append = (params) =>
    withRetry("write", async () => {
      await throttle("write");
      return origAppend(params);
    });

  return sheets;
}
