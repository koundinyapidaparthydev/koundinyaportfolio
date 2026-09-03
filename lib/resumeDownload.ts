/** Canonical filename for resume PDF downloads (header + HTML download attribute). */
export const RESUME_DOWNLOAD_FILENAME = "Koundinya_Pidaparthy_resume.pdf";

export const RESUME_PDF_API_PATH =
  process.env.GITHUB_PAGES === "1"
    ? "/koundinyaportfolio/resume.pdf"
    : "/api/resume/pdf";
