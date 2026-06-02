/**
 * POST /api/internal/generate-and-store
 *
 * Internal server-to-server endpoint — NOT for browser clients.
 * Authenticated via the x-internal-key header (INTERNAL_API_KEY env var).
 *
 * Body: { company: string, title: string, description: string, jobUrl: string }
 *
 * Steps:
 *  1. Tailors the base resume to the job using Claude
 *  2. Renders a PDF with @react-pdf/renderer
 *  3. Uploads the PDF to Google Cloud Storage
 *  4. Returns { resumeUrl, coverLetterText, atsScore }
 *
 * Required env vars (in addition to ANTHROPIC_API_KEY):
 *   INTERNAL_API_KEY          — shared secret for this endpoint
 *   GCS_SERVICE_ACCOUNT_JSON  — jobseek-459701 service account JSON
 *   GCS_BUCKET_NAME           — target GCS bucket
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { getResume } from "@/lib/resumeStore";
import { ResumePdfDocument } from "@/lib/resumePdf";
import { calculateAtsScore } from "@/lib/atsScoring";
import { uploadToGCS } from "@/lib/gcsUpload";
import type { Resume } from "@/types/resume";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5-20251001";

function buildPrompt(resume: Resume, jobTitle: string, companyName: string, jobDescription: string): string {
  return `You are a senior technical resume writer. Tailor this resume for the job, then write a 3-paragraph cover letter.

JOB
Company: ${companyName}
Title: ${jobTitle}
Description:
${jobDescription.slice(0, 3000)}

RULES
1. Keep all facts truthful — never invent metrics or experiences.
2. Rewrite personalInfo.summary (2–3 sentences) to speak directly to this role.
3. Reorder skill categories so most relevant appear first.
4. Lightly rephrase 1–2 bullets per role to echo the job description naturally.
5. coverLetter: 3 paragraphs. Opening hook, evidence/stories, close with enthusiasm for ${companyName}. Must NOT sound AI-generated.

OUTPUT: ONLY valid JSON, no markdown, no code fences.

{
  "personalInfo": { "name": string, "title": string, "email": string, "phone": string, "location": string, "linkedin": string, "github": string, "portfolio": string, "summary": string },
  "education": [ /* unchanged */ ],
  "experience": [ /* same structure, lightly tailored */ ],
  "skills": [ /* reordered */ ],
  "projects": [ /* unchanged */ ],
  "coverLetter": "full cover letter text, paragraphs separated by \\n\\n"
}

CANDIDATE RESUME:
${JSON.stringify(resume, null, 0)}`;
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) {
    return NextResponse.json({ error: "INTERNAL_API_KEY not configured" }, { status: 503 });
  }
  const providedKey = req.headers.get("x-internal-key");
  if (!providedKey || providedKey !== internalKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 503 });

  // ── Call Claude ───────────────────────────────────────────────────────────
  const baseResume = await getResume();
  const client = new Anthropic({ apiKey });

  let tailoredResume: Resume;
  let coverLetterText: string;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: "user", content: buildPrompt(baseResume, title, company, description) }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    // Strip markdown fences if present
    let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    // Claude sometimes appends explanation text after the closing brace.
    // Extract the outermost JSON object robustly.
    const firstBrace = cleaned.indexOf("{");
    if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
    let depth = 0, end = -1;
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === "{") depth++;
      else if (cleaned[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) cleaned = cleaned.slice(0, end + 1);
    const parsed = JSON.parse(cleaned);

    coverLetterText = parsed.coverLetter ?? "";
    const { coverLetter: _cl, ...resumeOnly } = parsed;
    void _cl;
    tailoredResume = { ...baseResume, ...resumeOnly } as Resume;
  } catch (err) {
    console.error("[generate-and-store] Claude error:", err);
    return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
  }

  // ── Compute ATS score ─────────────────────────────────────────────────────
  const atsResult = calculateAtsScore(description, tailoredResume);

  // ── Render resume PDF ─────────────────────────────────────────────────────
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

  // ── Upload to GCS ─────────────────────────────────────────────────────────
  let resumeUrl: string;
  try {
    const safeCompany = company.replace(/[^a-zA-Z0-9]/g, "_");
    const safeTitle   = title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
    const ts = new Date().toISOString().slice(0, 10);
    const fileName = `resumes/${ts}/${safeCompany}_${safeTitle}.pdf`;
    resumeUrl = await uploadToGCS(pdfBuffer, fileName, "application/pdf");
  } catch (err) {
    console.error("[generate-and-store] GCS upload error:", err);
    // Fall back to base64 data URL so the pipeline can continue
    resumeUrl = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
  }

  return NextResponse.json({
    resumeUrl,
    coverLetterText,
    atsScore: atsResult.score,
    matched: atsResult.matched,
    missing: atsResult.missing,
  });
}
