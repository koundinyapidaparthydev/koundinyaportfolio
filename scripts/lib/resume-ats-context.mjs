/**
 * Resume + job context for ATS scoring.
 * - Gemini: condensed resume summary + complete job description
 * - Keyword fallback: broader resume text for matching
 */

/** Matches HC description column cap in the sheet. */
export const MAX_JOB_DESCRIPTION_CHARS = 12_000;

/** Condensed resume JSON cap for Gemini prompts. */
export const MAX_RESUME_SUMMARY_CHARS = 2_500;

function truncateText(text, maxLen) {
  const s = String(text ?? "").trim();
  if (s.length <= maxLen) return s;
  if (maxLen <= 3) return s.slice(0, maxLen);
  return `${s.slice(0, maxLen - 3)}...`;
}

function fitResumeSummaryJson(obj, maxChars) {
  let json = JSON.stringify(obj);
  if (json.length <= maxChars) return obj;

  const summary = truncateText(obj.summary, Math.max(80, Math.floor(maxChars * 0.12)));
  const experience = (obj.experience ?? []).map((e) => ({
    ...e,
    points: (e.points ?? []).map((p) => truncateText(p, 160)),
  }));
  const projects = (obj.projects ?? []).map((p) => ({
    ...p,
    description: truncateText(p.description, 120),
  }));

  let candidate = { ...obj, summary, experience, projects };
  json = JSON.stringify(candidate);
  if (json.length <= maxChars) return candidate;

  candidate = {
    ...candidate,
    experience: experience.map((e) => ({
      ...e,
      points: (e.points ?? []).slice(0, 3).map((p) => truncateText(p, 100)),
    })),
    projects: projects.map((p) => ({
      ...p,
      description: truncateText(p.description, 80),
    })),
  };
  json = JSON.stringify(candidate);
  if (json.length <= maxChars) return candidate;

  candidate = {
    ...candidate,
    summary: truncateText(summary, 200),
    experience: candidate.experience.map((e) => ({
      role: e.role,
      company: e.company,
      technologies: (e.technologies ?? []).slice(0, 6),
      points: (e.points ?? []).slice(0, 2).map((p) => truncateText(p, 80)),
    })),
    projects: candidate.projects.map((p) => ({
      name: p.name,
      stack: (p.stack ?? []).slice(0, 6),
      description: truncateText(p.description, 60),
    })),
  };
  json = JSON.stringify(candidate);
  if (json.length <= maxChars) return candidate;

  candidate = {
    title: candidate.title,
    summary: truncateText(candidate.summary, 120),
    skills: (candidate.skills ?? []).slice(0, 24),
    experience: candidate.experience.map((e) => ({
      role: e.role,
      company: e.company,
      points: (e.points ?? []).slice(0, 1).map((p) => truncateText(p, 60)),
    })),
    projects: candidate.projects.map((p) => ({
      name: p.name,
      description: truncateText(p.description, 40),
    })),
  };
  return candidate;
}

/** Condensed resume fields sent to Gemini (summary, bullets, skills, roles, projects). */
export function buildResumeSummaryForGemini(resume) {
  const raw = {
    title: resume.personalInfo?.title ?? "",
    summary: resume.personalInfo?.summary ?? "",
    skills: resume.skills?.flatMap((c) => c.skills ?? []) ?? [],
    experience: (resume.experience ?? []).map((e) => ({
      role: e.role,
      company: e.companyName,
      technologies: e.technologies ?? [],
      points: e.points ?? [],
    })),
    projects: (resume.projects ?? []).map((p) => ({
      name: p.name,
      stack: p.stack ?? [],
      description: p.description ?? "",
    })),
  };
  return fitResumeSummaryJson(raw, MAX_RESUME_SUMMARY_CHARS);
}

export function serializeResumeSummaryForGemini(resume) {
  return JSON.stringify(buildResumeSummaryForGemini(resume));
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
