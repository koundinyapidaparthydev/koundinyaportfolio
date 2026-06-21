import type { Resume } from "@/types/resume";

/** Collect canonical skills/technologies from resume JSON (mirrors scripts/lib/skill-match.mjs). */
export function extractResumeSkills(resume: Resume | null | undefined): string[] {
  if (!resume) return [];

  const seen = new Set<string>();
  const skills: string[] = [];

  const add = (raw: unknown) => {
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

function normalizeSkillKey(skill: string): string {
  return skill.toLowerCase().trim().replace(/\s+/g, " ");
}

/** True when a gap term is already represented on the resume (substring match). */
export function gapTermOnResume(term: string, resumeSkills: string[]): boolean {
  const needle = normalizeSkillKey(term);
  if (!needle || needle.length < 2) return false;

  for (const skill of resumeSkills) {
    const hay = normalizeSkillKey(skill);
    if (hay === needle) return true;
    if (needle.length >= 3 && hay.includes(needle)) return true;
    if (hay.length >= 3 && needle.includes(hay)) return true;

    const compactNeedle = needle.replace(/[.\s/_-]+/g, "");
    const compactHay = hay.replace(/[.\s/_-]+/g, "");
    if (compactNeedle.length >= 3 && compactHay.includes(compactNeedle)) return true;
    if (compactHay.length >= 3 && compactNeedle.includes(compactHay)) return true;
  }

  return false;
}
