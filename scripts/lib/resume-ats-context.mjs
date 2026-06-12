/**
 * Resume + job context for ATS scoring.
 * - Gemini: condensed resume summary + complete job description
 * - Keyword fallback: broader resume text for matching
 */

/** Matches HC description column cap in the sheet. */
export const MAX_JOB_DESCRIPTION_CHARS = 12_000;

/** Condensed resume JSON cap for Gemini prompts. */
export const MAX_RESUME_SUMMARY_CHARS = 2_500;

/** Condensed resume fields sent to Gemini (skills, roles, tech — not full bullets/education). */
export function buildResumeSummaryForGemini(resume) {
  return {
    title: resume.personalInfo?.title ?? "",
    skills: resume.skills?.flatMap((c) => c.skills ?? []) ?? [],
    experience: (resume.experience ?? []).map((e) => ({
      role: e.role,
      company: e.companyName,
      technologies: e.technologies ?? [],
    })),
    projects: (resume.projects ?? []).map((p) => ({
      name: p.name,
      stack: p.stack ?? [],
    })),
  };
}

export function serializeResumeSummaryForGemini(resume) {
  const json = JSON.stringify(buildResumeSummaryForGemini(resume));
  if (json.length <= MAX_RESUME_SUMMARY_CHARS) return json;
  return json.slice(0, MAX_RESUME_SUMMARY_CHARS);
}

/** Broader payload for keyword-based ATS fallback. */
export function buildResumeAtsPayload(resume) {
  return {
    personalInfo: {
      title: resume.personalInfo?.title ?? "",
      summary: resume.personalInfo?.summary ?? "",
    },
    skills:
      resume.skills?.map((c) => ({
        category: c.title,
        skills: c.skills ?? [],
      })) ?? [],
    experience:
      resume.experience?.map((e) => ({
        company: e.companyName,
        role: e.role,
        technologies: e.technologies ?? [],
        points: e.points ?? [],
      })) ?? [],
    projects:
      resume.projects?.map((p) => ({
        name: p.name,
        stack: p.stack ?? [],
        description: p.description ?? "",
      })) ?? [],
  };
}

export function resumeAtsPayloadToText(payload) {
  const parts = [];
  if (payload.personalInfo?.summary) parts.push(payload.personalInfo.summary);
  if (payload.personalInfo?.title) parts.push(payload.personalInfo.title);

  for (const cat of payload.skills ?? []) {
    parts.push(cat.category, ...(cat.skills ?? []));
  }
  for (const exp of payload.experience ?? []) {
    parts.push(exp.company, exp.role, ...(exp.technologies ?? []), ...(exp.points ?? []));
  }
  for (const proj of payload.projects ?? []) {
    parts.push(proj.name, proj.description, ...(proj.stack ?? []));
  }
  return parts.filter(Boolean).join("\n");
}

/** Complete job description (sheet stores up to 12k chars). */
export function normalizeJobDescriptionForAts(description) {
  const text = String(description ?? "").trim();
  if (text.length <= MAX_JOB_DESCRIPTION_CHARS) return text;
  return text.slice(0, MAX_JOB_DESCRIPTION_CHARS);
}
