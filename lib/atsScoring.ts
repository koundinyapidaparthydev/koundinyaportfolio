import type { Resume } from "@/types/resume";

export interface AtsResult {
  score: number; // 0-100
  matched: string[];
  missing: string[];
  label: "high" | "medium" | "low";
}

// Words too generic to be meaningful signals
const STOP_WORDS = new Set([
  "and","or","the","a","an","with","for","to","in","of","on","at","by","from",
  "you","we","our","your","their","this","that","will","are","is","be","been",
  "work","working","ability","strong","good","knowledge","understanding",
  "experience","years","team","role","position","join","looking","seeking",
  "must","required","preferred","plus","bonus","nice","have","has","using",
  "help","lead","design","build","develop","implement","support","ensure",
  "across","within","new","key","high","able","well","also","both","can",
  "may","need","use","get","set","run","own","via","per","end","all","any",
  "who","how","what","when","where","why","which","that","not","but","if",
]);

/** Extract tech/skill terms from any text block */
function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  // Normalise separators
  const cleaned = lower.replace(/[^\w\s#+./-]/g, " ").replace(/\s+/g, " ");
  const tokens = cleaned.split(" ");

  const results = new Set<string>();

  // Single tokens
  for (const t of tokens) {
    const w = t.replace(/^[^a-z]+|[^a-z0-9+#.]+$/g, "");
    if (w.length >= 2 && !STOP_WORDS.has(w)) results.add(w);
  }

  // Bi-grams (e.g. "machine learning", "react native", "type script")
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i].replace(/[^a-z0-9]/g, "");
    const b = tokens[i + 1].replace(/[^a-z0-9]/g, "");
    if (a.length >= 2 && b.length >= 2 && !STOP_WORDS.has(a) && !STOP_WORDS.has(b)) {
      results.add(`${a} ${b}`);
    }
  }

  return Array.from(results);
}

/** Build a flat set of resume keywords from all sections */
function buildResumeKeywords(resume: Resume): Set<string> {
  const kws = new Set<string>();

  const add = (s: string) => {
    const lower = s.toLowerCase();
    kws.add(lower);
    // Also add each word individually
    lower.split(/[\s,/()+]+/).forEach((w) => {
      const clean = w.replace(/[^a-z0-9+#.]/g, "");
      if (clean.length >= 2) kws.add(clean);
    });
  };

  // Skills
  for (const cat of resume.skills) {
    for (const skill of cat.skills) add(skill);
  }

  // Experience technologies + bullet keywords
  for (const exp of resume.experience) {
    for (const tech of exp.technologies ?? []) add(tech);
    for (const point of exp.points) {
      // Pull out CamelCase or hyphenated tech names from bullets
      const techMentions = point.match(/\b[A-Z][a-zA-Z0-9.+#-]+\b/g) ?? [];
      techMentions.forEach((t) => add(t));
    }
  }

  // Project stacks
  for (const proj of resume.projects) {
    for (const tech of proj.stack) add(tech);
  }

  return kws;
}

/**
 * Calculate how well a job description matches the candidate's resume.
 * Returns a score 0-100 and matched/missing keyword lists.
 */
export function calculateAtsScore(
  jobDescription: string,
  resume: Resume
): AtsResult {
  if (!jobDescription?.trim()) {
    return { score: 0, matched: [], missing: [], label: "low" };
  }

  const resumeKws = buildResumeKeywords(resume);
  const jobKws = extractKeywords(jobDescription);

  // Keep only keywords that look like tech/skill terms (not pure generic words)
  const techPattern = /^[a-z][a-z0-9+#.]{1,}$/;
  const relevantJobKws = Array.from(new Set(jobKws.filter((k) => techPattern.test(k) && k.length >= 3))).slice(0, 60);

  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of relevantJobKws) {
    // Direct hit OR partial containment (e.g. resume has "react" → matches "reactjs")
    const hit =
      resumeKws.has(kw) ||
      Array.from(resumeKws).some(
        (rk) =>
          (kw.length >= 4 && rk.includes(kw)) ||
          (rk.length >= 4 && kw.includes(rk))
      );
    if (hit) matched.push(kw);
    else missing.push(kw);
  }

  const score =
    relevantJobKws.length > 0
      ? Math.min(100, Math.round((matched.length / relevantJobKws.length) * 100))
      : 0;

  const label: AtsResult["label"] =
    score >= 75 ? "high" : score >= 35 ? "medium" : "low";

  return { score, matched: matched.slice(0, 20), missing: missing.slice(0, 20), label };
}
