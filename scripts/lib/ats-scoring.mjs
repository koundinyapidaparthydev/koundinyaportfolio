/**
 * Keyword-based ATS scoring (mirrors lib/atsScoring.ts for Node scripts).
 */

const STOP_WORDS = new Set([
  "and", "or", "the", "a", "an", "with", "for", "to", "in", "of", "on", "at", "by", "from",
  "you", "we", "our", "your", "their", "this", "that", "will", "are", "is", "be", "been",
  "work", "working", "ability", "strong", "good", "knowledge", "understanding",
  "experience", "years", "team", "role", "position", "join", "looking", "seeking",
  "must", "required", "preferred", "plus", "bonus", "nice", "have", "has", "using",
  "help", "lead", "design", "build", "develop", "implement", "support", "ensure",
  "across", "within", "new", "key", "high", "able", "well", "also", "both", "can",
  "may", "need", "use", "get", "set", "run", "own", "via", "per", "end", "all", "any",
  "who", "how", "what", "when", "where", "why", "which", "not", "but", "if",
]);

function extractKeywords(text) {
  const lower = String(text ?? "").toLowerCase();
  const cleaned = lower.replace(/[^\w\s#+./-]/g, " ").replace(/\s+/g, " ");
  const tokens = cleaned.split(" ");
  const results = new Set();

  for (const t of tokens) {
    const w = t.replace(/^[^a-z]+|[^a-z0-9+#.]+$/g, "");
    if (w.length >= 2 && !STOP_WORDS.has(w)) results.add(w);
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i].replace(/[^a-z0-9]/g, "");
    const b = tokens[i + 1].replace(/[^a-z0-9]/g, "");
    if (a.length >= 2 && b.length >= 2 && !STOP_WORDS.has(a) && !STOP_WORDS.has(b)) {
      results.add(`${a} ${b}`);
    }
  }
  return Array.from(results);
}

function buildResumeKeywords(resume) {
  const kws = new Set();
  const add = (s) => {
    const lower = String(s).toLowerCase();
    kws.add(lower);
    lower.split(/[\s,/()+]+/).forEach((w) => {
      const clean = w.replace(/[^a-z0-9+#.]/g, "");
      if (clean.length >= 2) kws.add(clean);
    });
  };

  for (const cat of resume.skills ?? []) {
    for (const skill of cat.skills ?? []) add(skill);
  }
  for (const exp of resume.experience ?? []) {
    for (const tech of exp.technologies ?? []) add(tech);
    for (const point of exp.points ?? []) {
      const techMentions = point.match(/\b[A-Z][a-zA-Z0-9.+#-]+\b/g) ?? [];
      techMentions.forEach((t) => add(t));
    }
  }
  for (const proj of resume.projects ?? []) {
    for (const tech of proj.stack ?? []) add(tech);
  }
  return kws;
}

export function calculateAtsScore(jobDescription, resume) {
  if (!jobDescription?.trim()) {
    return { score: 0, matched: [], missing: [], label: "low" };
  }

  const resumeKws = buildResumeKeywords(resume);
  const jobKws = extractKeywords(jobDescription);
  const techPattern = /^[a-z][a-z0-9+#.]{1,}$/;
  const relevantJobKws = Array.from(new Set(jobKws.filter((k) => techPattern.test(k) && k.length >= 3))).slice(0, 60);

  const matched = [];
  const missing = [];
  for (const kw of relevantJobKws) {
    const hit =
      resumeKws.has(kw) ||
      Array.from(resumeKws).some(
        (rk) => (kw.length >= 4 && rk.includes(kw)) || (rk.length >= 4 && kw.includes(rk)),
      );
    if (hit) matched.push(kw);
    else missing.push(kw);
  }

  const score =
    relevantJobKws.length > 0
      ? Math.min(100, Math.round((matched.length / relevantJobKws.length) * 100))
      : 0;
  const label = score >= 65 ? "high" : score >= 35 ? "medium" : "low";
  return { score, matched: matched.slice(0, 20), missing: missing.slice(0, 20), label };
}
