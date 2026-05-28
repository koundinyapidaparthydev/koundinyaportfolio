/**
 * cypress/e2e/homepage.cy.ts
 *
 * Smoke tests for the public-facing homepage (/).
 * Checks hero section, typewriter, navigation, project cards, and contact form.
 */

describe("Homepage", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("renders the hero heading containing the owner name", () => {
    // The hero section contains a heading with the owner's name.
    cy.get("#hero").should("exist");
    cy.get("#hero").contains(/koundinya/i).should("be.visible");
  });

  it("renders the typewriter animated element", () => {
    // The typewriter component uses aria-live="polite" for accessibility.
    cy.get('[aria-live="polite"]').should("exist");
  });

  it("shows all primary nav links", () => {
    // About/Skills/Projects are <button> scroll links; Resume is an <a>
    cy.get("nav").contains(/about/i).should("be.visible");
    cy.get("nav").contains(/skills/i).should("be.visible");
    cy.get("nav").contains(/projects/i).should("be.visible");
    cy.get("nav").contains(/resume/i).should("be.visible");
  });

  it("scrolls to the projects section and shows at least 3 project cards", () => {
    cy.get("#projects").scrollIntoView();
    cy.get("#projects").should("be.visible");
    // Each project card renders its title inside an <h3>
    cy.get("#projects h3").should("have.length.gte", 3);
  });

  it("renders the contact form fields", () => {
    cy.get("#contact").scrollIntoView();
    cy.get("#contact-name").should("exist");
    cy.get("#contact-email").should("exist");
    cy.get("#contact-message").should("exist");
  });
});
