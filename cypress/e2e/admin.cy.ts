/**
 * cypress/e2e/admin.cy.ts
 *
 * Admin dashboard tests (requires authentication).
 *
 * Flow:
 *   1. cy.adminLogin() – visits /login & submits credentials from env vars.
 *   2. Navigate to the "Edit Resume" tab.
 *   3. Intercept PUT /api/resume to capture the outgoing payload.
 *   4. Edit the summary textarea.
 *   5. Wait for the auto-save (debounced) PUT request.
 *   6. Assert the payload contains the new text.
 *   7. Assert the "✓ Saved" indicator appears.
 */

describe("Admin dashboard", () => {
  beforeEach(() => {
    cy.adminLogin();
    cy.visit("/admin");
  });

  it("renders the admin page after login", () => {
    cy.url().should("include", "/admin");
    cy.contains(/edit/i).should("be.visible");
  });

  it("intercepts PUT /api/resume and verifies the summary payload", () => {
    const newSummary = `Cypress test summary ${Date.now()}`;

    // Stub PUT /api/resume and capture the request body.
    cy.intercept("PUT", "/api/resume", (req) => {
      req.reply({ statusCode: 200, body: { success: true } });
    }).as("putResume");

    // Open the Edit Resume tab (aria or text match)
    cy.contains(/edit resume/i).click();

    // Find the summary textarea (registered as personalInfo.summary)
    cy.get('textarea[name="personalInfo.summary"]')
      .scrollIntoView()
      .clear()
      .type(newSummary);

    // Wait for the debounced auto-save PUT request
    cy.wait("@putResume", { timeout: 15_000 })
      .its("request.body")
      .should((body: { personalInfo?: { summary?: string } }) => {
        expect(body?.personalInfo?.summary).to.contain(newSummary);
      });

    // The save status indicator must become visible
    cy.contains("✓ Saved").should("be.visible");
  });
});
