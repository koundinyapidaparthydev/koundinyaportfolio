/** Minimum ATS % for base (non-tailored) resume to count as a strong match. */
export const DEFAULT_ATS_MIN_SCORE = 75;

/** Skip AI tailoring when base (pre-tailor) ATS is already at or above this. */
export const SKIP_TAILOR_INITIAL_ATS = 87;

/** Phase 1 milestone — refine best draft until this score before phase 2. */
export const INTERMEDIATE_MILESTONE_SCORE = 82;

/** Aspirational loop target in phase 2 (best effort). */
export const TAILOR_TARGET_SCORE = 95;

/** Minimum post-tailor ATS to upload PDF and set Resume Modified = yes (>90%). */
export const TAILOR_SAVE_MIN_SCORE = 91;

/** @deprecated Use SKIP_TAILOR_INITIAL_ATS — when base resume needs tailoring. */
export const TAILOR_ATS_THRESHOLD = SKIP_TAILOR_INITIAL_ATS;

/** Strong-fit label tier (display copy). */
export const ATS_STRONG_SCORE = 80;

/** Non-tailored resume filter in All Jobs admin (base resume ATS bar). */
export const NON_TAILORED_MIN_SCORE = SKIP_TAILOR_INITIAL_ATS;

/** Max AI tailor attempts per job (phase 1 + phase 2). */
export const MAX_TAILOR_ATTEMPTS = 7;

/** Minimum resume skills matching the JD before tailoring is allowed. */
export const MIN_SKILL_MATCH_COUNT = 3;
