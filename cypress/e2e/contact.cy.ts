/**
 * cypress/e2e/contact.cy.ts
 *
 * Tests for the contact form on the homepage.
 * Uses cy.intercept to mock the POST /api/contact endpoint so the
 * test is fully deterministic and never sends real e-mails.
 */

describe("Contact form", () => {
  beforeEach(() => {
    // Stub the API so the form always "succeeds" immediately.
    cy.intercept("POST", "/api/contact", {
      statusCode: 200,
      body: { success: true },
    }).as("contactPost");

    cy.visit("/");
    cy.get("#contact").scrollIntoView();
  });

  it("fills and submits the contact form, then shows a success message", () => {
    cy.get("#contact-name").clear().type("Test User");
    cy.get("#contact-email").clear().type("test@example.com");
    cy.get("#contact-message").clear().type("Hello from Cypress!");

    // Submit — target the button inside the contact form section
    cy.get("#contact").find('[type="submit"]').click();

    // Wait for the mocked API call
    cy.wait("@contactPost");

    // Success toast / message is shown
    cy.contains("Message sent").should("be.visible");
  });

  it("does not call the API when required fields are empty", () => {
    // Clear any pre-filled values and try to submit empty
    cy.get("#contact-name").clear();
    cy.get("#contact-email").clear();
    cy.get("#contact-message").clear();

    cy.get("#contact").find('[type="submit"]').click();

    // The stub should NOT have been called because HTML5 validation blocks submission
    cy.get("@contactPost.all").should("have.length", 0);
  });
});
