/**
 * .lighthouserc.js — Lighthouse CI configuration.
 *
 * Run with:  npx lhci autorun
 *
 * Targets:
 *   Performance  >= 90
 *   Accessibility >= 95
 *   Best Practices >= 90
 *   SEO >= 90
 */

/** @type {import('@lhci/cli').LighthouseRcConfig} */
module.exports = {
  ci: {
    collect: {
      // Production build served via `next start` on 3000
      url: ["http://localhost:3000/", "http://localhost:3000/login"],
      numberOfRuns: 3,
      startServerCommand: "npm run start",
      startServerReadyPattern: "Ready on",
      startServerReadyTimeout: 30000,
    },
    assert: {
      preset: "lighthouse:recommended",
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],

        // Specific audits
        "uses-text-compression": "warn",
        "uses-optimized-images": "warn",
        "uses-webp-images": "warn",
        "render-blocking-resources": "warn",
        "unused-javascript": "warn",
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "interactive": ["error", { maxNumericValue: 3800 }],
        "first-contentful-paint": ["error", { maxNumericValue: 1800 }],

        // Relax a few checks that vary in CI environments
        "uses-long-cache-ttl": "off",
        "canonical": "warn",
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
