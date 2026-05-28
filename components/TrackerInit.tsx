"use client";

/**
 * TrackerInit — invisible client component that fires a single tracking ping
 * to /api/track when a visitor first lands on any page.
 *
 * Uses a module-level flag (not just a ref) to guarantee the ping is sent at
 * most once per browser session, even if the component mounts multiple times
 * during React strict-mode double-invocations in development.
 */

import { useEffect } from "react";

// Module-level guard — survives React's strict-mode double mount in dev
let hasPinged = false;

export function TrackerInit() {
  useEffect(() => {
    if (hasPinged) return;
    hasPinged = true;

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: window.location.pathname,
        referrer: document.referrer || "direct",
        language: navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      // keepalive ensures the request completes even if the user navigates away
      keepalive: true,
    }).catch(() => {
      // Silently discard — tracking errors must never impact the visitor
    });
  }, []);

  // Renders nothing — purely a side-effect component
  return null;
}
