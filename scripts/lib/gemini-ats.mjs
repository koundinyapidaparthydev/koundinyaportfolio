/**
 * ATS scoring via Gemini (lowest-cost flash-lite model).
 * Falls back to keyword scoring when API key missing or request fails.
 */

import { calculateAtsScore } from "./ats-scoring.mjs";
import {
  normalizeJobDescriptionForAts,
  serializeResumeSummaryForGemini,
} from "./resume-ats-context.mjs";

/** Cheapest generally-available Gemini model for short classification tasks. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

export async function scoreJobWithGemini(jobTitle, jobDescription, resume) {
  const fullDescription = normalizeJobDescriptionForAts(jobDescription);
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  const fallback = () => {
    const local = calculateAtsScore(fullDescription, resume);
    const matched = local.matched?.slice(0, 8).join(", ") || "—";
    const missing = local.missing?.slice(0, 8).join(", ") || "—";
    return {
      ...local,
      matchSummary: `Keyword match ${local.score}% — strong overlap on ${matched}.`,
      keyGaps: missing,
      recommendedKeywords: (local.missing ?? []).slice(0, 12).join(", "),
      source: "local-keywords",
    };
  };

  if (!apiKey || !fullDescription) return fallback();

  const resumeContext = serializeResumeSummaryForGemini(resume);

  const prompt = `You are an ATS matcher. Score how well this resume matches the job (0-100 integer).
Return JSON: {
  "score": number,
  "label": "high"|"medium"|"low",
  "matched": string[],
  "missing": string[],
  "matchSummary": "1-2 sentences on fit",
  "keyGaps": string[],
  "recommendedKeywords": string[]
}
high >= 75, medium >= 35, low < 35. recommendedKeywords = top terms to add to resume for this role.

Job title: ${jobTitle}

Complete job description:
${fullDescription}

Resume summary (summary paragraph, experience bullets, skills, roles, technologies, projects):
${resumeContext}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      console.warn(`  ⚠  Gemini ATS HTTP ${res.status} — using local keywords`);
      return fallback();
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text);
    const score = Math.min(100, Math.max(0, Number(parsed.score) || 0));
    const label = score >= 75 ? "high" : score >= 35 ? "medium" : "low";
    const matched = Array.isArray(parsed.matched) ? parsed.matched.slice(0, 20) : [];
    const missing = Array.isArray(parsed.missing) ? parsed.missing.slice(0, 20) : [];
    const keyGaps = Array.isArray(parsed.keyGaps)
      ? parsed.keyGaps.slice(0, 12).join(", ")
      : missing.slice(0, 8).join(", ");
    const recommendedKeywords = Array.isArray(parsed.recommendedKeywords)
      ? parsed.recommendedKeywords.slice(0, 12).join(", ")
      : missing.slice(0, 10).join(", ");

    return {
      score,
      label: parsed.label ?? label,
      matched,
      missing,
      matchSummary:
        parsed.matchSummary ??
        `Score ${score}/100 — matched: ${matched.slice(0, 6).join(", ") || "—"}.`,
      keyGaps,
      recommendedKeywords,
      source: "gemini",
    };
  } catch (err) {
    console.warn(`  ⚠  Gemini ATS error: ${err.message} — using local keywords`);
    return fallback();
  }
}
