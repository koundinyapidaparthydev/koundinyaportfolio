/** Minimum resume skills that must appear in the job description before tailoring. */
export const MIN_SKILL_MATCH_COUNT = 3;

/** True when fewer than 3 resume skills match the job (sink to bottom of All Jobs). */
export function isLowSkillFit(job: { skillMatchCount?: string | number }): boolean {
  const raw = job.skillMatchCount;
  if (raw === undefined || raw === null || String(raw).trim() === "") return true;
  const n = Number(raw);
  return !Number.isFinite(n) || n < MIN_SKILL_MATCH_COUNT;
}

/** Keep low-skill-fit rows at the bottom while preserving order within each group. */
export function deprioritizeLowSkillFit<T extends { skillMatchCount?: string | number }>(
  jobs: T[]
): T[] {
  const eligible: T[] = [];
  const lowFit: T[] = [];
  for (const job of jobs) {
    if (isLowSkillFit(job)) lowFit.push(job);
    else eligible.push(job);
  }
  return [...eligible, ...lowFit];
}
