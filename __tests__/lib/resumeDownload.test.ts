import {
  RESUME_DOWNLOAD_FILENAME,
  RESUME_PDF_API_PATH,
} from "@/lib/resumeDownload";

describe("resume download constants", () => {
  it("uses a descriptive PDF filename without spaces", () => {
    expect(RESUME_DOWNLOAD_FILENAME).toBe("Koundinya_Pidaparthy_resume.pdf");
    expect(RESUME_DOWNLOAD_FILENAME).not.toContain(" ");
  });

  it("points resume links at the PDF API route", () => {
    expect(RESUME_PDF_API_PATH).toBe("/api/resume/pdf");
  });
});
