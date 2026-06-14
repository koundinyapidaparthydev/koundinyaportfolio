/**
 * Normalize messy Gemini tailor JSON (TS mirror of scripts/lib/resume-normalize.mjs).
 */

export type NormalizedSkillCategory = {
  title?: string;
  skills: string[];
};

export function asText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((v) => asText(v)).filter(Boolean).join(" ");
  if (typeof value === "object") return "";
  return String(value);
}

export function safeLower(value: unknown): string {
  return asText(value).toLowerCase();
}

export function normalizePoints(points: unknown): string[] {
  if (!Array.isArray(points)) return [];
  return points.map((p) => asText(p)).filter((p) => p.length > 0);
}

export function normalizeSkillCategories(
  skills: unknown,
  fallback: NormalizedSkillCategory[] = []
): NormalizedSkillCategory[] {
  let list = skills;

  if (!Array.isArray(list)) {
    if (list && typeof list === "object") {
      list = Object.entries(list as Record<string, unknown>).map(([title, val]) => ({
        title,
        skills: Array.isArray(val) ? val : val != null ? [val] : [],
      }));
    } else {
      return fallback;
    }
  }

  return (list as unknown[])
    .filter((cat) => cat != null)
    .map((cat): NormalizedSkillCategory => {
      if (typeof cat === "string") {
        return { title: cat, skills: [] };
      }
      const row = cat as { title?: string; category?: string; skills?: unknown };
      const title = asText(row.title ?? row.category ?? "");
      let skillList = row.skills;
      if (!Array.isArray(skillList)) {
        skillList = skillList != null && skillList !== "" ? [skillList] : [];
      }
      return {
        title,
        skills: (skillList as unknown[]).map((s) => asText(s)).filter(Boolean),
      };
    });
}
