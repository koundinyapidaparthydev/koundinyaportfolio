/**
 * cypress/e2e/auth.cy.ts
 *
 * Authentication flow tests:
 *   1. Visiting /admin while unauthenticated redirects to /login.
 *   2. Submitting wrong credentials shows an error message.
 *   3. Submitting correct credentials (via env vars) lands on /admin.
 */

describe("Authentication", () => {
  it("redirects unauthenticated users from /admin to /login", () => {
    cy.visit("/admin");
    cy.url().should("include", "/login");
  });

  it("shows an error message for wrong credentials", () => {
    cy.visit("/login");

    cy.get("#email").clear().type("wrong@example.com");
    cy.get("#password").clear().type("wrongpassword", { log: false });
    cy.get('[type="submit"]').click();

    // NextAuth renders a generic error message on bad credentials
    cy.contains(/invalid email or password/i).should("be.visible");
  });

  it("logs in with correct credentials and lands on /admin", () => {
    const email = Cypress.env("ADMIN_EMAIL") as string;
    const password = Cypress.env("ADMIN_PASSWORD") as string;

    cy.visit("/login");

    cy.get("#email").clear().type(email, { log: false });
    cy.get("#password").clear().type(password, { log: false });
    cy.get('[type="submit"]').click();

    // After a successful login the middleware allows access to /admin
    cy.url().should("include", "/admin");
  });
});
