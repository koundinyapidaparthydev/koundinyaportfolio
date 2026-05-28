import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    // Local dev server; override via CYPRESS_BASE_URL env var for CI
    baseUrl: "http://localhost:3000",

    // Where Cypress looks for test files
    specPattern: "cypress/e2e/**/*.cy.ts",

    // Support file auto-imported before every spec
    supportFile: "cypress/support/e2e.ts",

    // Where screenshots / videos go when run in CI
    screenshotsFolder: "cypress/screenshots",
    videosFolder: "cypress/videos",

    // Keep videos only on failure to save disk space
    video: false,

    // Generous timeouts — useful for SSR pages that do real DB/auth calls
    defaultCommandTimeout: 10_000,
    pageLoadTimeout: 30_000,

    // Viewport wide enough for the lg: breakpoint (sidebar uses lg:flex)
    viewportWidth: 1280,
    viewportHeight: 900,

    // Retry failing tests once in CI to filter out flakiness
    retries: {
      runMode: 1,
      openMode: 0,
    },

    // Env vars available inside tests as Cypress.env('KEY')
    env: {
      // Override these in .env.local or CI secrets
      ADMIN_EMAIL: "admin@koundinyapidaparthy.com",
      ADMIN_PASSWORD: "cypress-test-password",
    },
  },
});
