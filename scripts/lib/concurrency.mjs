/**
 * Bounded concurrency and async mutex for pipeline scripts.
 */

/** @returns {Promise<void>} */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Serializes async work (e.g. Google Sheets updates, JSON cache writes).
 * @returns {{ run: <T>(fn: () => Promise<T>) => Promise<T> }}
 */
export function createMutex() {
  let chain = Promise.resolve();
  return {
    run(fn) {
      const next = chain.then(fn, fn);
      chain = next.then(
        () => undefined,
        () => undefined
      );
      return next;
    },
  };
}

/**
 * Minimum gap between job starts (shared across workers).
 * @param {number} intervalMs
 */
export function createThrottle(intervalMs) {
  const mutex = createMutex();
  let nextAllowed = 0;
  return () =>
    mutex.run(async () => {
      const now = Date.now();
      const wait = Math.max(0, nextAllowed - now);
      if (wait > 0) await delay(wait);
      nextAllowed = Date.now() + intervalMs;
    });
}

/**
 * Run async tasks with bounded concurrency.
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let qi = 0;
  async function worker() {
    while (qi < items.length) {
      const i = qi++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker)
  );
  return results;
}
