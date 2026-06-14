/** Minimum ATS % for base (non-tailored) resume to count as a strong match. */
export const DEFAULT_ATS_MIN_SCORE = 75;

/** Jobs below this score get an AI-tailored resume in the HC pipeline. */
export const TAILOR_ATS_THRESHOLD = 87;

/** Target ATS % — tailoring loops until this is reached (max 5 attempts). */
export const TAILOR_TARGET_SCORE = 87;

/** Strong-fit label tier (display copy). */
export const ATS_STRONG_SCORE = 80;

/** Non-tailored resume filter in All Jobs admin (base resume ATS bar). */
export const NON_TAILORED_MIN_SCORE = 87;

/** Max AI tailor attempts per job. */
export const MAX_TAILOR_ATTEMPTS = 5;

/** Minimum resume skills matching the JD before tailoring is allowed. */
export const MIN_SKILL_MATCH_COUNT = 3;
