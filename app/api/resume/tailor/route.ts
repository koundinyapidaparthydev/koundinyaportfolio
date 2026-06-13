import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { getResume } from "@/lib/resumeStore";
import { ResumePdfDocument, CoverLetterPdfDocument } from "@/lib/resumePdf";
import { requireAdminSession } from "@/lib/auth";
import { tailorResumeWithQualityGate } from "@/lib/resumeTailor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }

  let body: { title: string; company: string; description: string; type?: "resume" | "cover" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, company, description, type = "resume" } = body;
  if (!title || !company || !description) {
    return NextResponse.json({ error: "title, company and description are required" }, { status: 400 });
  }

  const baseResume = await getResume();

  let tailoredResume;
  let coverLetter;
  let quality;

  try {
    const result = await tailorResumeWithQualityGate(baseResume, {
      title,
      company,
      description,
    }, { apiKey });
    tailoredResume = result.tailoredResume;
    coverLetter = result.coverLetter;
    quality = result.quality;

    if (!quality.passed) {
      console.warn(
        `[tailor] Quality warnings for ${company} (score ${quality.score}) — returning PDF anyway`
      );
    }
  } catch (err) {
    console.error("[tailor] Gemini error:", err);
    return NextResponse.json({ error: "AI generation failed. Try again." }, { status: 502 });
  }

  try {
    if (type === "cover") {
      const coverEl = React.createElement(CoverLetterPdfDocument, {
        name: tailoredResume.personalInfo.name,
        title: tailoredResume.personalInfo.title ?? "",
        email: tailoredResume.personalInfo.email,
        phone: tailoredResume.personalInfo.phone,
        companyName: company,
        jobTitle: title,
        coverLetter,
      }) as React.ReactElement<DocumentProps>;
      const buffer = await renderToBuffer(coverEl);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${company.replace(/\s+/g, "_")}_Cover_Letter.pdf"`,
          "X-Resume-Quality-Score": String(quality.score),
        },
      });
    }

    const resumeEl = React.createElement(ResumePdfDocument, {
      resume: tailoredResume,
    }) as React.ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(resumeEl);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${company.replace(/\s+/g, "_")}_Resume.pdf"`,
        "X-Resume-Quality-Score": String(quality.score),
      },
    });
  } catch (err) {
    console.error("[tailor] PDF render error:", err);
    return NextResponse.json({ error: "PDF generation failed." }, { status: 500 });
  }
}
