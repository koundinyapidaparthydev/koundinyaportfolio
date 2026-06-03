/**
 * @jest-environment node
 *
 * Tests for scripts/lib/gcs-upload.mjs path helpers.
 */

import {
  slugifyCompany,
  buildApplyRecordingPrefix,
  formatRecordingNotes,
} from "../../scripts/lib/gcs-upload.mjs";

describe("slugifyCompany", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyCompany("Acme Corp.")).toBe("acme-corp");
  });

  it("truncates long names", () => {
    const long = "A".repeat(100);
    expect(slugifyCompany(long).length).toBeLessThanOrEqual(60);
  });

  it("falls back to unknown for empty input", () => {
    expect(slugifyCompany("")).toBe("unknown");
  });
});

describe("buildApplyRecordingPrefix", () => {
  it("builds dated row path with company slug", () => {
    const date = new Date("2026-06-02T12:00:00.000Z");
    expect(buildApplyRecordingPrefix(5, "Stripe Inc", date)).toBe(
      "apply-recordings/2026-06-02/row-5-stripe-inc"
    );
  });
});

describe("formatRecordingNotes", () => {
  it("appends recording URLs to base notes", () => {
    const notes = formatRecordingNotes("submitted", {
      video: "https://storage.example/video.webm",
      trace: "https://storage.example/trace.zip",
    });
    expect(notes).toContain("submitted");
    expect(notes).toContain("video: https://storage.example/video.webm");
    expect(notes).toContain("trace: https://storage.example/trace.zip");
  });
});
