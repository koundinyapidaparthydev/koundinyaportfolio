/**
 * Tailor resume JSON for a specific job via Gemini (pipeline use).
 * Includes humanized prompts, quality validation, and one refinement pass.
 */

import { scoreJobWithGemini, GEMINI_MODEL } from "./gemini-ats.mjs";
import {
  validateTailoredResume,
  formatQualityFeedback,
  sanitizeTailoredResume,
} from "./resume-quality.mjs";

const QUALITY_CHECKLIST = `
QUALITY CHECKLIST — verify before responding:
- Summary is 2–3 sentences, specific to the company/role (not a generic template)
- No headline job title under the candidate's name (personalInfo.title empty)
- Zero buzzwords: leveraged, spearheaded, synergy, cutting-edge, results-driven, passionate about delivering, thrilled to apply
- Edited bullets start with strong past-tense verbs; each bullet under ~2 lines
- Only reorder skills and lightly rephrase bullets — never invent companies, roles, skills, or metrics
- Cover letter: 3 short paragraphs, conversational, mentions one concrete story from the resume`;

function buildTailorPrompt(resume, jobTitle, companyName, jobDescription, extraGuidance = "") {
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
  baseResume,
  draftResume,
  jobTitle,
  companyName,
  jobDescription,
  qualityFeedback,
  atsGaps = ""
) {
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

function extractJsonObject(raw) {
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
  return JSON.parse(cleaned);
}

function normalizeTailored(baseResume, parsed) {
  const coverLetter = parsed.coverLetter ?? "";
  const { coverLetter: _cl, ...resumeOnly } = parsed;
  void _cl;
  const tailoredResume = sanitizeTailoredResume(baseResume, {
    ...baseResume,
    ...resumeOnly,
  });
  if (tailoredResume.personalInfo) {
    tailoredResume.personalInfo.title = "";
  }
  return { tailoredResume, coverLetter };
}

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) throw new Error("Empty response from Gemini");
  return extractJsonObject(text);
}

/**
 * @returns {{ tailoredResume: object, coverLetter: string }}
 */
export async function tailorResumeForJob(baseResume, { title, company, description }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const parsed = await callGemini(
    apiKey,
    buildTailorPrompt(baseResume, title, company, description)
  );
  return normalizeTailored(baseResume, parsed);
}

/**
 * Tailor with quality gate: validate → refine once if needed → re-score.
 */
export async function tailorResumeWithQualityGate(
  baseResume,
  { title, company, description },
  options = {}
) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const preAtsScore = options.preAtsScore ?? null;

  let parsed = await callGemini(
    apiKey,
    buildTailorPrompt(baseResume, title, company, description)
  );
  let { tailoredResume, coverLetter } = normalizeTailored(baseResume, parsed);

  let postResult = await scoreJobWithGemini(title, description, tailoredResume);
  let quality = validateTailoredResume(baseResume, tailoredResume, {
    company,
    title,
    coverLetter,
    preAtsScore,
    postAtsScore: postResult.score,
  });

  if (!quality.passed) {
    console.log(`  ↻ Quality refine for ${company} (${quality.errors.length} issues)`);
    const feedback = formatQualityFeedback(quality);
    const atsGaps = postResult.keyGaps ?? postResult.recommendedKeywords ?? "";
    parsed = await callGemini(
      apiKey,
      buildRefinePrompt(
        baseResume,
        tailoredResume,
        title,
        company,
        description,
        feedback,
        atsGaps
      )
    );
    ({ tailoredResume, coverLetter } = normalizeTailored(baseResume, parsed));
    postResult = await scoreJobWithGemini(title, description, tailoredResume);
    quality = validateTailoredResume(baseResume, tailoredResume, {
      company,
      title,
      coverLetter,
      preAtsScore,
      postAtsScore: postResult.score,
    });
  }

  return {
    tailoredResume,
    coverLetter,
    quality,
    preAtsScore,
    postAtsScore: postResult.score,
    postResult,
  };
}
