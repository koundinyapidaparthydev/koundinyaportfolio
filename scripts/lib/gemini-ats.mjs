/**
 * ATS scoring via Gemini (lowest-cost flash-lite model).
 * Falls back to keyword scoring when API key missing or request fails.
 */

import { calculateAtsScore } from "./ats-scoring.mjs";

/** Cheapest generally-available Gemini model for short classification tasks. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

export async function scoreJobWithGemini(jobTitle, jobDescription, resume) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const fallback = () => {
    const local = calculateAtsScore(jobDescription, resume);
    return { ...local, source: "local-keywords" };
  };

  if (!apiKey || !jobDescription?.trim()) return fallback();

  const resumeSummary = JSON.stringify({
    skills: resume.skills?.flatMap((c) => c.skills) ?? [],
    experience: (resume.experience ?? []).map((e) => ({
      title: e.title,
      company: e.company,
      technologies: e.technologies,
    })),
    projects: (resume.projects ?? []).map((p) => ({ name: p.name, stack: p.stack })),
  });

  const prompt = `You are an ATS matcher. Score how well this resume matches the job (0-100 integer only).
Return JSON: {"score": number, "label": "high"|"medium"|"low", "matched": string[], "missing": string[]}
high >= 65, medium >= 35, low < 35. No resume generation. Score only.

Job title: ${jobTitle}
Job description (truncated): ${jobDescription.slice(0, 3000)}
Resume summary: ${resumeSummary.slice(0, 2500)}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 256, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      console.warn(`  ⚠  Gemini ATS HTTP ${res.status} — using local keywords`);
      return fallback();
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text);
    const score = Math.min(100, Math.max(0, Number(parsed.score) || 0));
    const label = score >= 65 ? "high" : score >= 35 ? "medium" : "low";
    return {
      score,
      label: parsed.label ?? label,
      matched: Array.isArray(parsed.matched) ? parsed.matched.slice(0, 20) : [],
      missing: Array.isArray(parsed.missing) ? parsed.missing.slice(0, 20) : [],
      source: "gemini",
    };
  } catch (err) {
    console.warn(`  ⚠  Gemini ATS error: ${err.message} — using local keywords`);
    return fallback();
  }
}
