/** Shared ATS thresholds for the Hiring Cafe pipeline (keep in sync with lib/admin/atsConfig.ts). */
export const DEFAULT_ATS_MIN_SCORE = 75;

/** Skip AI tailoring when base (pre-tailor) ATS is already at or above this. */
export const SKIP_TAILOR_INITIAL_ATS = 90;

/** Single-phase tailor loop target — save PDF at or above this score. */
export const TAILOR_TARGET_SCORE = 90;

/** Minimum post-tailor ATS to upload PDF and set Resume Modified = yes. */
export const TAILOR_SAVE_MIN_SCORE = 90;

/** @deprecated Use SKIP_TAILOR_INITIAL_ATS — when base resume needs tailoring. */
export const TAILOR_ATS_THRESHOLD = SKIP_TAILOR_INITIAL_ATS;

export const ATS_STRONG_SCORE = 80;

/** Non-tailored resume filter bar (admin UI) — base resume strong enough to skip tailoring. */
export const NON_TAILORED_MIN_SCORE = SKIP_TAILOR_INITIAL_ATS;

/** Max Gemini tailor attempts per job; after exhaustion, save the highest-scoring draft. */
export const MAX_TAILOR_ATTEMPTS = 2;

/** Minimum resume skills that must match the job description to tailor.
 *  Override via MIN_SKILL_MATCH_COUNT env (set lower to tailor jobs with weak base overlap now that JD-skill injection is allowed). */
const _envMatch = Number(process.env.MIN_SKILL_MATCH_COUNT);
export const MIN_SKILL_MATCH_COUNT = Number.isFinite(_envMatch) ? _envMatch : 3;
