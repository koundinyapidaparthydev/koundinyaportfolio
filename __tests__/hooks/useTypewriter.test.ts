/**
 * __tests__/hooks/useTypewriter.test.ts
 *
 * Tests for hooks/useTypewriter.ts
 * Uses Jest fake timers to control the animation loop precisely.
 */

import { renderHook, act } from "@testing-library/react";
import { useTypewriter } from "@/hooks/useTypewriter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Advance fake timers and flush React state updates together. */
async function tick(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useTypewriter", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("starts with an empty string", () => {
    const { result } = renderHook(() =>
      useTypewriter(["Hello"], { typeSpeed: 50, deleteSpeed: 25, pauseAfterType: 100, pauseAfterDelete: 50 })
    );
    expect(result.current).toBe("");
  });

  it("returns empty string when phrases array is empty", () => {
    const { result } = renderHook(() => useTypewriter([]));
    expect(result.current).toBe("");

    // Advancing time should not change anything
    act(() => { jest.advanceTimersByTime(5000); });
    expect(result.current).toBe("");
  });

  it("types characters one by one", async () => {
    const { result } = renderHook(() =>
      useTypewriter(["Hi"], { typeSpeed: 100, deleteSpeed: 50, pauseAfterType: 500, pauseAfterDelete: 50 })
    );

    // Initial pause (pauseAfterDelete = 50 ms) before first tick
    await tick(50);
    // After one tick: "H"
    expect(result.current).toBe("H");

    // After second tick: "Hi"
    await tick(100);
    expect(result.current).toBe("Hi");
  });

  it("pauses after fully typing a phrase", async () => {
    const { result } = renderHook(() =>
      useTypewriter(["AB"], { typeSpeed: 100, deleteSpeed: 50, pauseAfterType: 500, pauseAfterDelete: 50 })
    );

    // Wait for both characters to type: 50 (initial pause) + 100 + 100 = 250 ms
    await tick(250);
    expect(result.current).toBe("AB");

    // During the pause period the text should not change
    await tick(200);
    expect(result.current).toBe("AB");
  });

  it("deletes characters after the pause", async () => {
    const { result } = renderHook(() =>
      useTypewriter(["AB"], { typeSpeed: 100, deleteSpeed: 50, pauseAfterType: 200, pauseAfterDelete: 50 })
    );

    // "A" appears at 50ms (pauseAfterDelete), "AB" at 150ms (50+100)
    // pauseAfterType=200ms pause, so first deletion fires at 150+200=350ms
    await tick(150);  // advance to 150ms — "AB" fully typed
    expect(result.current).toBe("AB");

    // First deletion fires at 350ms (150ms type + 200ms pause)
    await tick(200);  // now at 350ms
    expect(result.current).toBe("A");

    // Second deletion fires at 400ms (350ms + 50ms deleteSpeed)
    await tick(50);   // now at 400ms
    expect(result.current).toBe("");
  });

  it("cycles to the next phrase after deletion", async () => {
    const { result } = renderHook(() =>
      useTypewriter(["AB", "CD"], {
        typeSpeed: 100,
        deleteSpeed: 50,
        pauseAfterType: 200,
        pauseAfterDelete: 50,
      })
    );

    // "AB" typed: 0→50ms ("A"), 50→150ms ("B"). Full at 150ms.
    // pause after type 200ms → deletion starts at 350ms
    // delete "B" at 350ms → "A"; delete "A" at 400ms → ""
    // pause after delete 50ms → "C" typed at 450ms
    await tick(450);
    expect(result.current).toBe("C");
  });

  it("cycles back to first phrase after all phrases", async () => {
    const { result } = renderHook(() =>
      useTypewriter(["A", "B"], {
        typeSpeed: 100,
        deleteSpeed: 50,
        pauseAfterType: 100,
        pauseAfterDelete: 50,
      })
    );

    // Single-char phrases, each typed at the first tick (pauseAfterDelete=50ms)
    // "A" at 50ms → deleted at 50+100=150ms → "B" at 150+50=200ms
    // "B" deleted at 200+100=300ms → "A" again at 300+50=350ms
    await tick(350);
    expect(result.current).toBe("A");
  });

  it("respects custom typeSpeed", async () => {
    const { result } = renderHook(() =>
      useTypewriter(["X"], { typeSpeed: 200, deleteSpeed: 100, pauseAfterType: 500, pauseAfterDelete: 50 })
    );

    // First char is typed when the initial pauseAfterDelete (50ms) fires.
    // Before 50ms: still empty
    await tick(49);
    expect(result.current).toBe("");

    // At 50ms the first tick fires and "X" is typed
    await tick(1);   // now at 50ms
    expect(result.current).toBe("X");
  });

  it("respects custom deleteSpeed", async () => {
    // Use a 2-char phrase so deleteSpeed is exercised between chars
    const { result } = renderHook(() =>
      useTypewriter(["XY"], { typeSpeed: 50, deleteSpeed: 300, pauseAfterType: 100, pauseAfterDelete: 50 })
    );

    // "X" at 50ms, "XY" at 100ms (50+50)
    // Pause 100ms → first deletion tick at 200ms: text="X"
    // deleteSpeed=300ms before second deletion → fires at 500ms: text=""
    await tick(200);  // advance to 200ms — first deletion fires
    expect(result.current).toBe("X");

    // Still "X" at 499ms (second deletion not yet fired, fires at 500ms)
    await tick(299);  // now at 499ms
    expect(result.current).toBe("X");

    // Second deletion fires at 500ms
    await tick(1);    // now at 500ms
    expect(result.current).toBe("");
  });

  it("handles a single character phrase", async () => {
    const { result } = renderHook(() =>
      useTypewriter(["Z"], { typeSpeed: 50, deleteSpeed: 50, pauseAfterType: 100, pauseAfterDelete: 50 })
    );
    // Pause (50) + type (50) = 100
    await tick(100);
    expect(result.current).toBe("Z");
  });

  it("works with a long phrase", async () => {
    const phrase = "Hello World";
    const { result } = renderHook(() =>
      useTypewriter([phrase], {
        typeSpeed: 50,
        deleteSpeed: 20,
        pauseAfterType: 500,
        pauseAfterDelete: 50,
      })
    );

    // 50 ms initial + 11 chars × 50 ms = 50 + 550 = 600 ms
    await tick(600);
    expect(result.current).toBe("Hello World");
  });
});
