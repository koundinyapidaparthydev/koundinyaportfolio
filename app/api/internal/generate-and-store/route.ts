/**
 * POST /api/internal/generate-and-store
 *
 * Internal server-to-server endpoint — NOT for browser clients.
 * Authenticated via the x-internal-key header (INTERNAL_API_KEY env var).
 */

import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { getResume } from "@/lib/resumeStore";
import { ResumePdfDocument } from "@/lib/resumePdf";
import { uploadToGCS } from "@/lib/gcsUpload";
import { tailorResumeWithQualityGate } from "@/lib/resumeTailor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) {
    return NextResponse.json({ error: "INTERNAL_API_KEY not configured" }, { status: 503 });
  }
  const providedKey = req.headers.get("x-internal-key");
  if (!providedKey || providedKey !== internalKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { company: string; title: string; description: string; jobUrl: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { company, title, description } = body;
  if (!company || !title || !description) {
    return NextResponse.json({ error: "company, title, description required" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 503 });

  const baseResume = await getResume();

  let tailoredResume;
  let coverLetterText;
  let quality;
  let preAtsScore;
  let postAtsScore;

  try {
    const result = await tailorResumeWithQualityGate(
      baseResume,
      { title, company, description },
      { apiKey }
    );
    tailoredResume = result.tailoredResume;
    coverLetterText = result.coverLetter;
    quality = result.quality;
    preAtsScore = result.preAtsScore;
    postAtsScore = result.postAtsScore;

    if (!quality.passed) {
      console.warn(
        `[generate-and-store] Quality warnings for ${company} (score ${quality.score}) — storing anyway`
      );
    }
  } catch (err) {
    console.error("[generate-and-store] Gemini error:", err);
    return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
  }

  let pdfBuffer: Buffer;
  try {
    const el = React.createElement(ResumePdfDocument, {
      resume: tailoredResume,
    }) as React.ReactElement<DocumentProps>;
    pdfBuffer = Buffer.from(await renderToBuffer(el));
  } catch (err) {
    console.error("[generate-and-store] PDF render error:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }

  let resumeUrl: string;
  try {
    const safeCompany = company.replace(/[^a-zA-Z0-9]/g, "_");
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
    const ts = new Date().toISOString().slice(0, 10);
    const fileName = `resumes/${ts}/${safeCompany}_${safeTitle}.pdf`;
    resumeUrl = await uploadToGCS(pdfBuffer, fileName, "application/pdf");
  } catch (err) {
    console.error("[generate-and-store] GCS upload error:", err);
    resumeUrl = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
  }

  return NextResponse.json({
    resumeUrl,
    coverLetterText,
    atsScore: postAtsScore,
    preAtsScore,
    qualityScore: quality.score,
  });
}
