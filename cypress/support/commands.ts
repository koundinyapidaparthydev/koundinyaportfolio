/**
 * cypress/support/commands.ts
 *
 * Custom Cypress commands registered via cy.X() syntax.
 * Imported automatically by cypress/support/e2e.ts.
 */

// Make this file a TypeScript module so `declare global` is valid.
export {};

// ─── Type augmentation ────────────────────────────────────────────────────────
// Teaches TypeScript about our custom commands.

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Log in as admin via the /login form.
       *
       * Uses CYPRESS_ADMIN_EMAIL / CYPRESS_ADMIN_PASSWORD env vars (or the
       * defaults baked into cypress.config.ts) so credentials stay out of
       * source code.
       *
       * @example cy.adminLogin()
       */
      adminLogin(): Chainable<void>;

      /**
       * Assert that a toast message containing the given text is visible.
       * Waits up to the default command timeout.
       *
       * @example cy.assertToast('Message sent')
       */
      assertToast(text: string): Chainable<void>;
    }
  }
}

// ─── cy.adminLogin() ──────────────────────────────────────────────────────────

Cypress.Commands.add("adminLogin", () => {
  const email = Cypress.env("ADMIN_EMAIL") as string;
  const password = Cypress.env("ADMIN_PASSWORD") as string;

  cy.visit("/login");

  // Fill the login form
  cy.get("#email").clear().type(email, { log: false });
  cy.get("#password").clear().type(password, { log: false });

  // Submit using the form's submit button
  cy.get('[type="submit"]').click();

  // Wait until we've left the login page
  cy.url().should("not.include", "/login");
});

// ─── cy.assertToast() ─────────────────────────────────────────────────────────

Cypress.Commands.add("assertToast", (text: string) => {
  // The Contact component renders its toast inside an AnimatePresence wrapper.
  // We look for any visible element that contains the expected text.
  cy.contains(text).should("be.visible");
});
