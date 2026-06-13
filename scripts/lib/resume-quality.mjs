/**
 * Quality checks for AI-tailored resumes (pipeline mirror of lib/resumeQuality.ts).
 */

import {
  DEFAULT_ATS_MIN_SCORE,
} from "./ats-config.mjs";

export const MIN_ATS_IMPROVEMENT = 5;
export const TARGET_TAILORED_ATS = DEFAULT_ATS_MIN_SCORE;

export const AI_BUZZWORDS = [
  "leveraged",
  "spearheaded",
  "synergy",
  "cutting-edge",
  "cutting edge",
  "results-driven",
  "results driven",
  "proven track record",
  "adept at",
  "dynamic professional",
  "passionate about delivering",
  "thrilled to apply",
  "excited to bring",
  "innovative solutions",
  "thought leader",
  "best-in-class",
  "world-class",
  "game-changer",
  "go-getter",
  "detail-oriented professional",
  "team player with a passion",
];

function collectResumeText(resume) {
  const parts = [];
  const pi = resume.personalInfo ?? {};
  if (pi.summary) parts.push(pi.summary);
  if (pi.title) parts.push(pi.title);
  for (const exp of resume.experience ?? []) {
    parts.push(exp.role, exp.companyName, ...(exp.points ?? []));
  }
  for (const proj of resume.projects ?? []) {
    parts.push(proj.name, proj.description, ...(proj.points ?? []));
  }
  return parts.join(" ").toLowerCase();
}

function findBuzzwords(text) {
  const lower = text.toLowerCase();
  return AI_BUZZWORDS.filter((phrase) => lower.includes(phrase));
}

function experienceFingerprint(resume) {
  return (resume.experience ?? []).map(
    (e) => `${e.id}|${e.companyName}|${e.role}|${e.date}`
  );
}

function educationFingerprint(resume) {
  return (resume.education ?? []).map(
    (e) => `${e.id}|${e.institution}|${e.degree}|${e.graduationDate}`
  );
}

function projectFingerprint(resume) {
  return (resume.projects ?? []).map((p) => `${p.id}|${p.name}|${p.date}`);
}

function baseSkillSet(resume) {
  const set = new Set();
  for (const cat of resume.skills ?? []) {
    for (const s of cat.skills ?? []) {
      set.add(String(s).trim().toLowerCase());
    }
  }
  return set;
}

/** Clamp Gemini output to base-resume facts — always keep a usable tailored PDF. */
export function sanitizeTailoredResume(base, tailored) {
  const tailoredByExpId = new Map((tailored.experience ?? []).map((e) => [e.id, e]));
  const experience = (base.experience ?? []).map((exp) => {
    const t = tailoredByExpId.get(exp.id);
    const points = t?.points?.length ? t.points : exp.points;
    return { ...exp, points };
  });

  const allowedSkills = baseSkillSet(base);
  let skills = (tailored.skills ?? [])
    .map((cat) => ({
      ...cat,
      skills: (cat.skills ?? []).filter((s) =>
        allowedSkills.has(String(s).trim().toLowerCase())
      ),
    }))
    .filter((cat) => cat.skills.length > 0);
  if (skills.length === 0) skills = base.skills ?? [];

  const summary = (tailored.personalInfo?.summary ?? "").trim();
  const useSummary =
    summary.length >= 40 ? summary : (base.personalInfo?.summary ?? "");

  return {
    ...base,
    personalInfo: {
      ...base.personalInfo,
      title: "",
      summary: useSummary,
    },
    education: base.education,
    projects: base.projects,
    experience,
    skills,
  };
}

export function validateTailoredResume(base, tailored, ctx) {
  const issues = [];
  const summary = (tailored.personalInfo?.summary ?? "").trim();
  const headline = (tailored.personalInfo?.title ?? "").trim();

  if (headline.length > 0) {
    issues.push({
      code: "headline_title",
      message: "Remove generic headline title under the candidate name.",
      severity: "warning",
    });
  }

  if (summary.length < 80) {
    issues.push({
      code: "summary_short",
      message: "Summary is too short — aim for 2–3 specific sentences.",
      severity: "warning",
    });
  } else if (summary.length > 420) {
    issues.push({
      code: "summary_long",
      message: "Summary is too long — keep it under ~3 sentences.",
      severity: "warning",
    });
  }

  const companyLower = (ctx.company ?? "").toLowerCase();
  if (companyLower && !summary.toLowerCase().includes(companyLower.split(/\s+/)[0])) {
    issues.push({
      code: "summary_generic",
      message: `Summary should reference ${ctx.company} or the role focus — not read as a generic template.`,
      severity: "warning",
    });
  }

  const buzzInResume = findBuzzwords(collectResumeText(tailored));
  if (buzzInResume.length > 0) {
    issues.push({
      code: "ai_buzzwords_resume",
      message: `Remove AI-sounding phrases: ${buzzInResume.slice(0, 4).join(", ")}`,
      severity: "warning",
    });
  }

  if (ctx.coverLetter) {
    const buzzInLetter = findBuzzwords(ctx.coverLetter);
    if (buzzInLetter.length > 0) {
      issues.push({
        code: "ai_buzzwords_cover",
        message: `Cover letter sounds templated — remove: ${buzzInLetter.slice(0, 4).join(", ")}`,
        severity: "warning",
      });
    }
  }

  if (experienceFingerprint(base).join("§") !== experienceFingerprint(tailored).join("§")) {
    issues.push({
      code: "experience_structure",
      message: "Experience roles, companies, or dates were changed — only rephrase bullets.",
      severity: "warning",
    });
  }

  if (educationFingerprint(base).join("§") !== educationFingerprint(tailored).join("§")) {
    issues.push({
      code: "education_structure",
      message: "Education entries must stay unchanged.",
      severity: "warning",
    });
  }

  if (projectFingerprint(base).join("§") !== projectFingerprint(tailored).join("§")) {
    issues.push({
      code: "projects_structure",
      message: "Project names or dates were changed — projects must stay intact.",
      severity: "warning",
    });
  }

  const allowedSkills = baseSkillSet(base);
  for (const cat of tailored.skills ?? []) {
    for (const skill of cat.skills ?? []) {
      if (!allowedSkills.has(String(skill).trim().toLowerCase())) {
        issues.push({
          code: "invented_skill",
          message: `Do not add skills not on the base resume: "${skill}"`,
          severity: "warning",
        });
        break;
      }
    }
  }

  if (
    ctx.preAtsScore != null &&
    ctx.postAtsScore != null &&
    Number.isFinite(ctx.preAtsScore) &&
    Number.isFinite(ctx.postAtsScore)
  ) {
    const lift = ctx.postAtsScore - ctx.preAtsScore;
    const hitTarget = ctx.postAtsScore >= TARGET_TAILORED_ATS;
    const meaningfulLift = lift >= MIN_ATS_IMPROVEMENT;
    if (!hitTarget && !meaningfulLift) {
      issues.push({
        code: "ats_no_lift",
        message: `ATS only moved ${ctx.preAtsScore}% → ${ctx.postAtsScore}% — need ≥${TARGET_TAILORED_ATS}% or +${MIN_ATS_IMPROVEMENT} points.`,
        severity: "warning",
      });
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const score = Math.max(0, 100 - errors.length * 25 - warnings.length * 5);

  return {
    passed: errors.length === 0,
    score,
    issues,
    errors,
    warnings,
  };
}

export function formatQualityFeedback(result) {
  return result.issues.map((i) => `[${i.severity}] ${i.message}`).join("\n");
}
