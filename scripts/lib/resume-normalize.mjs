/**
 * Normalize messy Gemini tailor JSON into shapes the pipeline expects.
 */

export function asText(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((v) => asText(v)).filter(Boolean).join(" ");
  if (typeof value === "object") return "";
  return String(value);
}

export function safeLower(value) {
  return asText(value).toLowerCase();
}

export function normalizePoints(points) {
  if (!Array.isArray(points)) return [];
  return points.map((p) => asText(p)).filter((p) => p.length > 0);
}

/** Coerce skills into [{ title, skills: string[] }]. */
export function normalizeSkillCategories(skills, fallback = []) {
  let list = skills;

  if (!Array.isArray(list)) {
    if (list && typeof list === "object") {
      list = Object.entries(list).map(([title, val]) => ({
        title,
        skills: Array.isArray(val) ? val : val != null ? [val] : [],
      }));
    } else {
      return Array.isArray(fallback) ? fallback : [];
    }
  }

  return list
    .filter((cat) => cat != null)
    .map((cat) => {
      if (typeof cat === "string") {
        return { title: cat, skills: [] };
      }
      const title = asText(cat.title ?? cat.category ?? "");
      let skillList = cat.skills;
      if (!Array.isArray(skillList)) {
        skillList = skillList != null && skillList !== "" ? [skillList] : [];
      }
      return {
        ...cat,
        title,
        skills: skillList.map((s) => asText(s)).filter(Boolean),
      };
    });
}

export function normalizeExperienceList(experience, fallback = []) {
  if (!Array.isArray(experience)) return fallback;
  return experience.map((exp) => ({
    ...exp,
    points: normalizePoints(exp?.points),
  }));
}

/** Shape Gemini tailor JSON before merging with base resume. */
export function normalizeParsedTailorResponse(baseResume, parsed) {
  const p = parsed && typeof parsed === "object" ? parsed : {};
  return {
    ...p,
    personalInfo: {
      ...(baseResume.personalInfo ?? {}),
      ...(p.personalInfo ?? {}),
      title: "",
      summary: asText(p.personalInfo?.summary ?? ""),
    },
    skills: normalizeSkillCategories(p.skills, baseResume.skills),
    experience: normalizeExperienceList(p.experience, baseResume.experience),
    education: Array.isArray(p.education) ? p.education : baseResume.education,
    projects: Array.isArray(p.projects) ? p.projects : baseResume.projects,
    coverLetter: asText(p.coverLetter),
  };
}
