"use client";

import { useEffect } from "react";

/**
 * Maps scroll progress (0→1) to an aurora hue:
 *   0   → 245 (indigo)
 *   0.5 → 265 (violet)
 *   1   → 190 (cyan-ish)
 */
function progressToHue(t: number): number {
  if (t < 0.5) {
    return 245 + t * 2 * 20; // indigo → violet
  }
  return 265 - (t - 0.5) * 2 * 75; // violet → cyan
}

/**
 * Attaches a throttled scroll listener that writes --aurora-hue to :root.
 * All sections consume it via CSS: hsl(calc(var(--aurora-hue) + N) …)
 */
export function useAuroraScroll() {
  useEffect(() => {
    let rafId: number;

    const update = () => {
      const el = document.documentElement;
      const scrollY = el.scrollTop || window.scrollY;
      const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
      const progress = Math.min(1, scrollY / maxScroll);
      el.style.setProperty("--aurora-hue", String(Math.round(progressToHue(progress))));
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update(); // set initial value

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);
}
