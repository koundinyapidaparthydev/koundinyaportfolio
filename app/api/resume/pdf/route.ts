import React from "react";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { getResume } from "@/lib/resumeStore";
import { ResumePdfDocument } from "@/lib/resumePdf";
import { RESUME_DOWNLOAD_FILENAME } from "@/lib/resumeDownload";

/**
 * GET /api/resume/pdf
 * Generates PDF from data/resume.json using the same layout as the admin preview.
 */
export async function GET() {
  try {
    const resume = await getResume();
    const el = React.createElement(ResumePdfDocument, {
      resume,
    }) as React.ReactElement<DocumentProps>;
    const buffer = Buffer.from(await renderToBuffer(el));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${RESUME_DOWNLOAD_FILENAME}"`,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("[GET /api/resume/pdf]", err);
    return NextResponse.json(
      { error: "Resume PDF not available. Please check back soon." },
      { status: 404 }
    );
  }
}
