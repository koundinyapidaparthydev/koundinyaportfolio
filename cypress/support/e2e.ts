/**
 * cypress/support/e2e.ts
 *
 * This file is automatically loaded by Cypress before every E2E spec.
 * It imports our custom commands so they are available in all tests.
 */

import "./commands";

// Stub the visitor tracker on every test so Cypress runs never pollute data/visitors.json
beforeEach(() => {
  cy.intercept("POST", "/api/track", { statusCode: 200, body: { ok: true } });
});
