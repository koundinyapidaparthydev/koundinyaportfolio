/**
 * cypress/e2e/pdf.cy.ts
 *
 * Tests that the "Resume" nav link triggers a request to /api/resume/pdf.
 *
 * There is no separate /resume page — the Resume link in the Navbar points
 * directly to /api/resume/pdf (PDF download endpoint).  We intercept the
 * request instead of following the navigation so the test stays in the app.
 */

describe("Resume PDF download", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("clicking the Resume nav link requests /api/resume/pdf", () => {
    // Intercept the PDF endpoint before the link is clicked.
    cy.intercept("GET", "/api/resume/pdf").as("pdfRequest");

    // Click the Resume link in the navbar.
    cy.contains("a", /resume/i).click();

    // The browser should have attempted to fetch the PDF.
    cy.wait("@pdfRequest");
  });

  it("Resume nav link has the correct href attribute", () => {
    cy.contains("a", /resume/i)
      .should("have.attr", "href")
      .and("include", "/api/resume/pdf");
  });
});
