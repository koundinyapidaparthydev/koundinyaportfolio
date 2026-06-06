/**
 * @jest-environment node
 */
import {
  mapConcurrent,
  createMutex,
  createThrottle,
  delay,
} from "../../scripts/lib/concurrency.mjs";

describe("mapConcurrent", () => {
  it("runs all items and preserves order", async () => {
    const out = await mapConcurrent([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it("respects concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    await mapConcurrent(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await delay(20);
      active -= 1;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });
});

describe("createMutex", () => {
  it("serializes overlapping writes", async () => {
    const mutex = createMutex();
    const log: number[] = [];
    await Promise.all([
      mutex.run(async () => {
        log.push(1);
        await delay(30);
        log.push(2);
      }),
      mutex.run(async () => {
        log.push(3);
      }),
    ]);
    expect(log).toEqual([1, 2, 3]);
  });
});

describe("createThrottle", () => {
  it("spaces job starts by interval", async () => {
    const throttle = createThrottle(40);
    const t0 = Date.now();
    await throttle();
    await throttle();
    await throttle();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(70);
  });
});
