import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getResume } from "@/lib/resumeStore";
import { ResumePdfDocument, CoverLetterPdfDocument } from "@/lib/resumePdf";
import { requireAdminSession } from "@/lib/auth";
import type { Resume } from "@/types/resume";

export const dynamic = "force-dynamic";
// PDF generation can take a while — give it 60 s on Vercel
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5-20251001";

// ── Claude prompt ─────────────────────────────────────────────────────────────

function buildPrompt(
  resume: Resume,
  jobTitle: string,
  companyName: string,
  jobDescription: string
): string {
  return `You are a senior technical resume writer who has helped hundreds of engineers land roles at top companies. Your writing is human, specific, confident, and never sounds AI-generated or robotic.

TASK
Tailor the candidate's resume for this specific job, then write a cover letter.

JOB
Company: ${companyName}
Title: ${jobTitle}
Description:
${jobDescription.slice(0, 3000)}

RULES — follow every rule strictly
1. Keep all facts truthful — never invent metrics, technologies, or experiences.
2. Rewrite personalInfo.summary (2–3 sentences) to speak directly to ${companyName}'s focus and the role's key needs. Sound like a real engineer, not a template.
3. Reorder skill categories and skills within each category so the most relevant skills appear first.
4. For experience bullet points: keep the core fact intact but lightly rephrase 1–2 bullets per role to echo the job description's language naturally — no keyword stuffing.
5. Leave education and project dates/names unchanged.
6. coverLetter: 3 paragraphs (opening hook, evidence/stories, close with specific enthusiasm for ${companyName}). Conversational and specific — a hiring manager should NOT think "this was written by AI".

OUTPUT: respond with ONLY valid JSON, no markdown, no commentary, no code fences.

JSON SCHEMA:
{
  "personalInfo": { "name": string, "title": string, "email": string, "phone": string, "location": string, "linkedin": string, "github": string, "portfolio": string, "summary": string },
  "education": [ /* unchanged */ ],
  "experience": [ /* same structure, lightly tailored bullets */ ],
  "skills": [ /* reordered */ ],
  "projects": [ /* unchanged */ ],
  "coverLetter": "full cover letter text, paragraphs separated by \\n\\n"
}

CANDIDATE'S BASE RESUME:
${JSON.stringify(resume, null, 0)}`;
}

// ── POST /api/resume/tailor ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Admin-only
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
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

  // Load base resume
  const baseResume = await getResume();

  // ── Call Claude ──────────────────────────────────────────────────────────
  const client = new Anthropic({ apiKey });

  let tailoredResume: Resume;
  let coverLetter: string;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: buildPrompt(baseResume, title, company, description),
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);

    coverLetter = parsed.coverLetter ?? "";
    // Remove coverLetter from the resume object
    const { coverLetter: _cl, ...resumeOnly } = parsed;
    void _cl;
    tailoredResume = { ...baseResume, ...resumeOnly } as Resume;
  } catch (err) {
    console.error("[tailor] Claude error:", err);
    return NextResponse.json({ error: "AI generation failed. Try again." }, { status: 502 });
  }

  // ── Generate PDF ─────────────────────────────────────────────────────────
  try {
    if (type === "cover") {
      const buffer = await renderToBuffer(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        React.createElement(CoverLetterPdfDocument, {
          name: tailoredResume.personalInfo.name,
          title: tailoredResume.personalInfo.title,
          email: tailoredResume.personalInfo.email,
          phone: tailoredResume.personalInfo.phone,
          companyName: company,
          jobTitle: title,
          coverLetter,
        }) as any
      );

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${company.replace(/\s+/g, "_")}_Cover_Letter.pdf"`,
        },
      });
    }

    // Default: tailored resume PDF
    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(ResumePdfDocument, { resume: tailoredResume }) as any
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${company.replace(/\s+/g, "_")}_Resume.pdf"`,
      },
    });
  } catch (err) {
    console.error("[tailor] PDF render error:", err);
    return NextResponse.json({ error: "PDF generation failed." }, { status: 500 });
  }
}
