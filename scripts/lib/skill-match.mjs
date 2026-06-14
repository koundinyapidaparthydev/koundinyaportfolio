/**
 * Resume ↔ job description skill overlap (gate before AI tailoring).
 */

import { MIN_SKILL_MATCH_COUNT } from "./ats-config.mjs";

/** Collect canonical skills/technologies from resume JSON. */
export function extractResumeSkills(resume) {
  const seen = new Set();
  const skills = [];

  const add = (raw) => {
    const s = String(raw ?? "").trim();
    if (s.length < 2) return;
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    skills.push(s);
  };

  for (const cat of resume.skills ?? []) {
    for (const skill of cat.skills ?? []) add(skill);
  }
  for (const exp of resume.experience ?? []) {
    for (const tech of exp.technologies ?? []) add(tech);
  }
  for (const proj of resume.projects ?? []) {
    for (const tech of proj.stack ?? []) add(tech);
  }

  return skills;
}

function skillInDescription(skill, description) {
  const text = String(description ?? "").toLowerCase();
  const s = skill.toLowerCase().trim();
  if (!text || s.length < 2) return false;

  if (text.includes(s)) return true;

  const compact = s.replace(/[.\s/_-]+/g, "");
  if (compact.length >= 3 && text.replace(/[.\s/_-]+/g, "").includes(compact)) {
    return true;
  }

  const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return re.test(description);
}

/**
 * @returns {{ count: number, matched: string[], passes: boolean }}
 */
export function countSkillMatches(jobDescription, resume) {
  const resumeSkills = extractResumeSkills(resume);
  const matched = resumeSkills.filter((skill) => skillInDescription(skill, jobDescription));
  const count = matched.length;
  return {
    count,
    matched: matched.slice(0, 20),
    passes: count >= MIN_SKILL_MATCH_COUNT,
  };
}

export { MIN_SKILL_MATCH_COUNT };
