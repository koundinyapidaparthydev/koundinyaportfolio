import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const PDF_PATH = path.join(process.cwd(), "public", "resume.pdf");

/**
 * GET /api/resume/pdf
 * Serves the static resume.pdf from the public folder.
 * Returns 404 with a clear message if the file hasn't been uploaded yet.
 */
export async function GET() {
  try {
    const file = await fs.readFile(PDF_PATH);
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Koundinya_Pidaparthy_Resume.pdf"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Resume PDF not available. Please check back soon." },
      { status: 404 }
    );
  }
}
