/**
 * Shared Claude tailoring + quality gate for admin and internal API routes.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Resume } from "@/types/resume";
import { calculateAtsScore } from "@/lib/atsScoring";
import {
  validateTailoredResume,
  formatQualityFeedback,
  type TailorQualityResult,
} from "@/lib/resumeQuality";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

const QUALITY_CHECKLIST = `
QUALITY CHECKLIST — verify before responding:
- Summary is 2–3 sentences, specific to the company/role (not a generic template)
- No headline job title under the candidate's name (personalInfo.title empty)
- Zero buzzwords: leveraged, spearheaded, synergy, cutting-edge, results-driven, passionate about delivering, thrilled to apply
- Edited bullets start with strong past-tense verbs; each bullet under ~2 lines
- Only reorder skills and lightly rephrase bullets — never invent companies, roles, skills, or metrics
- Cover letter: 3 short paragraphs, conversational, mentions one concrete story from the resume`;

function buildTailorPrompt(
  resume: Resume,
  jobTitle: string,
  companyName: string,
  jobDescription: string,
  extraGuidance = ""
): string {
  return `You are a senior technical resume writer who has helped hundreds of engineers land roles at top companies. Your writing is human, specific, confident, and never sounds AI-generated or robotic.

TASK
Tailor the candidate's resume for this specific job, then write a cover letter.

JOB
Company: ${companyName}
Title: ${jobTitle}
Description:
${jobDescription.slice(0, 6000)}

RULES — follow every rule strictly
1. Keep all facts truthful — never invent metrics, technologies, or experiences.
2. Do NOT add a generic headline title under the candidate's name (personalInfo.title must be empty).
3. Rewrite personalInfo.summary (2–3 sentences) to speak directly to ${companyName}'s focus and the role's key needs. Sound like a real engineer writing to a hiring manager.
4. Reorder skill categories and skills within each category so the most relevant skills appear first.
5. For experience bullet points: keep the core fact intact but lightly rephrase 1–2 bullets per role to echo the job description's language naturally — no keyword stuffing.
6. Leave education, project names, dates, and company names unchanged.
7. coverLetter: 3 paragraphs (opening hook, evidence/stories, close with specific enthusiasm for ${companyName}). Conversational — must NOT sound AI-generated.
${QUALITY_CHECKLIST}
${extraGuidance ? `\nADDITIONAL GUIDANCE:\n${extraGuidance}\n` : ""}
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

function buildRefinePrompt(
  baseResume: Resume,
  draftResume: Resume,
  jobTitle: string,
  companyName: string,
  jobDescription: string,
  qualityFeedback: string,
  atsGaps = ""
): string {
  return `You are revising a tailored resume draft that failed quality checks. Fix ONLY what the feedback lists — keep truthful facts and human tone.

JOB
Company: ${companyName}
Title: ${jobTitle}

QUALITY FAILURES TO FIX:
${qualityFeedback}

${atsGaps ? `ATS GAPS TO ADDRESS NATURALLY (no keyword stuffing):\n${atsGaps}\n` : ""}
${QUALITY_CHECKLIST}

DRAFT TO REVISE:
${JSON.stringify(draftResume, null, 0)}

BASE RESUME (source of truth for facts):
${JSON.stringify(baseResume, null, 0)}

JOB DESCRIPTION (reference):
${jobDescription.slice(0, 4000)}

OUTPUT: ONLY valid JSON with the same schema as the draft (include coverLetter). personalInfo.title must be empty.`;
}

function extractJsonObject(raw: string): Record<string, unknown> {
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
  let depth = 0;
  let end = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end !== -1) cleaned = cleaned.slice(0, end + 1);
  return JSON.parse(cleaned) as Record<string, unknown>;
}

function normalizeTailored(
  baseResume: Resume,
  parsed: Record<string, unknown>
): { tailoredResume: Resume; coverLetter: string } {
  const coverLetter = typeof parsed.coverLetter === "string" ? parsed.coverLetter : "";
  const { coverLetter: _cl, ...resumeOnly } = parsed;
  void _cl;
  const tailoredResume = { ...baseResume, ...resumeOnly } as Resume;
  tailoredResume.personalInfo = {
    ...tailoredResume.personalInfo,
    title: "",
  };
  return { tailoredResume, coverLetter };
}

async function callClaude(client: Anthropic, prompt: string) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = message.content[0]?.type === "text" ? message.content[0].text : "";
  return extractJsonObject(raw);
}

export interface TailorWithQualityResult {
  tailoredResume: Resume;
  coverLetter: string;
  quality: TailorQualityResult;
  preAtsScore: number | null;
  postAtsScore: number;
}

export async function tailorResumeWithQualityGate(
  baseResume: Resume,
  job: { title: string; company: string; description: string },
  options: { preAtsScore?: number | null; apiKey?: string } = {}
): Promise<TailorWithQualityResult> {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const preAtsScore =
    options.preAtsScore ??
    calculateAtsScore(job.description, baseResume).score;

  const client = new Anthropic({ apiKey });
  const { title, company, description } = job;

  let parsed = await callClaude(
    client,
    buildTailorPrompt(baseResume, title, company, description)
  );
  let { tailoredResume, coverLetter } = normalizeTailored(baseResume, parsed);

  let postAts = calculateAtsScore(description, tailoredResume);
  let quality = validateTailoredResume(baseResume, tailoredResume, {
    company,
    title,
    coverLetter,
    preAtsScore,
    postAtsScore: postAts.score,
  });

  if (!quality.passed) {
    const atsGaps = postAts.missing?.slice(0, 8).join(", ") ?? "";
    parsed = await callClaude(
      client,
      buildRefinePrompt(
        baseResume,
        tailoredResume,
        title,
        company,
        description,
        formatQualityFeedback(quality),
        atsGaps
      )
    );
    ({ tailoredResume, coverLetter } = normalizeTailored(baseResume, parsed));
    postAts = calculateAtsScore(description, tailoredResume);
    quality = validateTailoredResume(baseResume, tailoredResume, {
      company,
      title,
      coverLetter,
      preAtsScore,
      postAtsScore: postAts.score,
    });
  }

  return {
    tailoredResume,
    coverLetter,
    quality,
    preAtsScore,
    postAtsScore: postAts.score,
  };
}
