/**
 * cypress/e2e/pdf.cy.ts
 *
 * Rigorous tests for the resume PDF endpoint and related UI.
 *
 * Test groups:
 *  1. Resume nav link UI  — href attribute, click triggers correct URL
 *  2. /api/resume/pdf HTTP contract — status code, Content-Type,
 *     Content-Disposition filename, Cache-Control, response body validity
 *  3. Error / not-found handling — 404 shape when PDF is absent
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Resume nav link UI
// ─────────────────────────────────────────────────────────────────────────────

describe("Resume nav link UI", () => {
  beforeEach(() => cy.visit("/"));

  it("Resume nav link has the correct /api/resume/pdf href", () => {
    cy.contains("a", /resume/i)
      .should("have.attr", "href")
      .and("include", "/api/resume/pdf");
  });

  it("clicking the Resume nav link triggers a request to /api/resume/pdf", () => {
    cy.intercept("GET", "/api/resume/pdf").as("pdfRequest");
    cy.contains("a", /resume/i).click();
    cy.wait("@pdfRequest");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. /api/resume/pdf HTTP contract (via cy.request — actually opens the response)
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/resume/pdf — HTTP contract", () => {
  /**
   * The dev server may or may not have a resume.pdf in /public.
   * We handle both cases: 200 (PDF present) and 404 (PDF absent).
   * Either way, the response must conform to a strict contract.
   */

  it("responds with either 200 or 404 — never a 5xx error", () => {
    cy.request({ url: "/api/resume/pdf", failOnStatusCode: false }).then((res) => {
      expect([200, 404]).to.include(res.status);
    });
  });

  it("200 response: Content-Type is application/pdf", () => {
    cy.request({ url: "/api/resume/pdf", failOnStatusCode: false, encoding: "binary" }).then((res) => {
      if (res.status === 200) {
        expect(res.headers["content-type"]).to.include("application/pdf");
      } else {
        // PDF not present in this environment — skip assertion
        expect(res.status).to.eq(404);
      }
    });
  });

  it("200 response: Content-Disposition is attachment with correct filename", () => {
    cy.request({ url: "/api/resume/pdf", failOnStatusCode: false, encoding: "binary" }).then((res) => {
      if (res.status === 200) {
        const cd: string = (res.headers["content-disposition"] as string) ?? "";
        expect(cd).to.include("attachment");
        expect(cd).to.include("Koundinya_Pidaparthy_resume.pdf");
        const match = cd.match(/filename="([^"]+)"/);
        expect(match).to.not.be.null;
        expect(match![1]).to.not.include(" ");
      } else {
        expect(res.status).to.eq(404);
      }
    });
  });

  it("200 response: Cache-Control is present with public max-age (dynamic PDF)", () => {
    cy.request({ url: "/api/resume/pdf", failOnStatusCode: false, encoding: "binary" }).then((res) => {
      if (res.status === 200) {
        const cc: string = (res.headers["cache-control"] as string) ?? "";
        expect(cc).to.include("public");
        const maxAgeMatch = cc.match(/max-age=(\d+)/);
        expect(maxAgeMatch).to.not.be.null;
        expect(Number(maxAgeMatch![1])).to.be.at.least(60);
      } else {
        expect(res.status).to.eq(404);
      }
    });
  });

  it("200 response: body begins with %PDF- magic bytes (valid PDF)", () => {
    cy.request({ url: "/api/resume/pdf", failOnStatusCode: false, encoding: "binary" }).then((res) => {
      if (res.status === 200) {
        // Body is binary — first 5 chars should be the PDF magic number
        const bodyStr: string = res.body as string;
        expect(bodyStr.slice(0, 5)).to.eq("%PDF-");
      } else {
        expect(res.status).to.eq(404);
      }
    });
  });

  it("200 response: body size is greater than 1 KB (not an empty/corrupt file)", () => {
    cy.request({ url: "/api/resume/pdf", failOnStatusCode: false, encoding: "binary" }).then((res) => {
      if (res.status === 200) {
        // A real PDF must be larger than 1 KB
        expect((res.body as string).length).to.be.greaterThan(1024);
      } else {
        expect(res.status).to.eq(404);
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. /api/resume/pdf — 404 error contract (when PDF file is absent)
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/resume/pdf — 404 error contract", () => {
  it("404 response: Content-Type is application/json (not binary)", () => {
    cy.request({ url: "/api/resume/pdf", failOnStatusCode: false }).then((res) => {
      if (res.status === 404) {
        expect(res.headers["content-type"]).to.include("application/json");
      } else {
        // PDF is present — 200 is fine
        expect(res.status).to.eq(200);
      }
    });
  });

  it("404 response: body has an 'error' field that is a non-empty string", () => {
    cy.request({ url: "/api/resume/pdf", failOnStatusCode: false }).then((res) => {
      if (res.status === 404) {
        expect(res.body).to.have.property("error");
        expect(typeof res.body.error).to.eq("string");
        expect((res.body.error as string).length).to.be.greaterThan(0);
      } else {
        expect(res.status).to.eq(200);
      }
    });
  });

  it("404 response: error body does not expose internal file paths", () => {
    cy.request({ url: "/api/resume/pdf", failOnStatusCode: false }).then((res) => {
      if (res.status === 404) {
        const errorMsg: string = (res.body as { error: string }).error;
        // Should never leak server filesystem paths
        expect(errorMsg).to.not.match(/\/Users\//);
        expect(errorMsg).to.not.match(/C:\\/);
        expect(errorMsg).to.not.include("process.cwd");
      } else {
        expect(res.status).to.eq(200);
      }
    });
  });

  it("404 response: no Content-Disposition header (it's an error, not a download)", () => {
    cy.request({ url: "/api/resume/pdf", failOnStatusCode: false }).then((res) => {
      if (res.status === 404) {
        // Content-Disposition should not be present on a JSON error response
        expect(res.headers["content-disposition"]).to.be.undefined;
      } else {
        expect(res.status).to.eq(200);
      }
    });
  });
});

