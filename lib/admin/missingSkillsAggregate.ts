import type { Job } from "@/app/api/jobs/route";
import { gapTermOnResume } from "@/lib/admin/resumeSkills";
import type { MissingSkillUserStatus } from "@/lib/admin/missingSkillsStorage";

export type GapSource = "keyGaps" | "recommendedKeywords";

export interface MissingSkillJobRef {
  company: string;
  title: string;
  rowIndex: number;
  atsScore?: string;
  fetchedAt?: string;
}

export interface AggregatedMissingSkill {
  term: string;
  normalizedKey: string;
  jobCount: number;
  keyGapsCount: number;
  keywordsCount: number;
  jobs: MissingSkillJobRef[];
  onResume: boolean;
  userStatus: MissingSkillUserStatus;
}

export type MissingSkillFilter = "all" | "actionable" | "added" | "dismissed" | "on-resume";

/** Split comma-separated Gemini gap fields into individual terms. */
export function parseGapField(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && part !== "—" && part !== "-");
}

export function normalizeGapTerm(term: string): string {
  return term.toLowerCase().trim().replace(/\s+/g, " ");
}

function pickDisplayTerm(current: string, incoming: string): string {
  if (!current) return incoming;
  if (incoming.length > current.length && incoming.length <= 48) return incoming;
  return current;
}

function jobRef(job: Job): MissingSkillJobRef {
  return {
    company: job.company,
    title: job.title,
    rowIndex: job.rowIndex,
    atsScore: job.atsScore,
    fetchedAt: job.fetchedAt,
  };
}

function jobRefKey(ref: MissingSkillJobRef): string {
  return `${ref.rowIndex}|${ref.company}|${ref.title}`;
}

export interface AggregateMissingSkillsOptions {
  resumeSkills?: string[];
  userStatuses?: Record<string, { status: MissingSkillUserStatus }>;
}

/** Aggregate keyGaps + recommendedKeywords across job rows. */
export function aggregateMissingSkills(
  jobs: Job[],
  options: AggregateMissingSkillsOptions = {}
): AggregatedMissingSkill[] {
  const { resumeSkills = [], userStatuses = {} } = options;
  const byKey = new Map<
    string,
    {
      term: string;
      keyGapsCount: number;
      keywordsCount: number;
      jobs: Map<string, MissingSkillJobRef>;
    }
  >();

  for (const job of jobs) {
    const ref = jobRef(job);

    for (const term of parseGapField(job.keyGaps)) {
      const key = normalizeGapTerm(term);
      if (!key) continue;
      const entry = byKey.get(key) ?? {
        term,
        keyGapsCount: 0,
        keywordsCount: 0,
        jobs: new Map<string, MissingSkillJobRef>(),
      };
      entry.term = pickDisplayTerm(entry.term, term);
      entry.keyGapsCount += 1;
      entry.jobs.set(jobRefKey(ref), ref);
      byKey.set(key, entry);
    }

    for (const term of parseGapField(job.recommendedKeywords)) {
      const key = normalizeGapTerm(term);
      if (!key) continue;
      const entry = byKey.get(key) ?? {
        term,
        keyGapsCount: 0,
        keywordsCount: 0,
        jobs: new Map<string, MissingSkillJobRef>(),
      };
      entry.term = pickDisplayTerm(entry.term, term);
      entry.keywordsCount += 1;
      entry.jobs.set(jobRefKey(ref), ref);
      byKey.set(key, entry);
    }
  }

  const results: AggregatedMissingSkill[] = [];

  for (const [normalizedKey, entry] of byKey) {
    const jobsList = Array.from(entry.jobs.values()).sort((a, b) => {
      const scoreA = Number.parseInt(String(a.atsScore ?? ""), 10);
      const scoreB = Number.parseInt(String(b.atsScore ?? ""), 10);
      const safeA = Number.isFinite(scoreA) ? scoreA : 999;
      const safeB = Number.isFinite(scoreB) ? scoreB : 999;
      if (safeA !== safeB) return safeA - safeB;
      return a.company.localeCompare(b.company);
    });

    const onResume = gapTermOnResume(entry.term, resumeSkills);
    const userStatus = userStatuses[normalizedKey]?.status ?? "open";

    results.push({
      term: entry.term,
      normalizedKey,
      jobCount: jobsList.length,
      keyGapsCount: entry.keyGapsCount,
      keywordsCount: entry.keywordsCount,
      jobs: jobsList,
      onResume,
      userStatus,
    });
  }

  return results.sort((a, b) => {
    if (b.jobCount !== a.jobCount) return b.jobCount - a.jobCount;
    return a.term.localeCompare(b.term);
  });
}

export function filterMissingSkills(
  skills: AggregatedMissingSkill[],
  filter: MissingSkillFilter
): AggregatedMissingSkill[] {
  switch (filter) {
    case "actionable":
      return skills.filter((s) => s.userStatus === "open" && !s.onResume);
    case "added":
      return skills.filter((s) => s.userStatus === "added" || s.onResume);
    case "dismissed":
      return skills.filter((s) => s.userStatus === "dismissed");
    case "on-resume":
      return skills.filter((s) => s.onResume);
    default:
      return skills;
  }
}

export function summarizeMissingSkills(skills: AggregatedMissingSkill[]) {
  const actionable = skills.filter((s) => s.userStatus === "open" && !s.onResume);
  const onResume = skills.filter((s) => s.onResume);
  const jobsWithGaps = new Set<number>();

  for (const skill of skills) {
    for (const job of skill.jobs) {
      jobsWithGaps.add(job.rowIndex);
    }
  }

  return {
    uniqueTerms: skills.length,
    actionableCount: actionable.length,
    onResumeCount: onResume.length,
    jobsWithGaps: jobsWithGaps.size,
    topActionable: actionable.slice(0, 5),
  };
}
