"use client";

import { useAuroraScroll } from "@/hooks/useAuroraScroll";

/**
 * Invisible client component that wires up the scroll-reactive aurora hue.
 * Drop once in the root layout — renders nothing to the DOM.
 */
export function AuroraScrollInit() {
  useAuroraScroll();
  return null;
}
