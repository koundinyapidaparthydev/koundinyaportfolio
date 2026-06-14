/** Shared ATS thresholds for the Hiring Cafe pipeline (keep in sync with lib/admin/atsConfig.ts). */
export const DEFAULT_ATS_MIN_SCORE = 75;
/** Target ATS % after AI tailoring — only mark resume modified when reached. */
export const TAILOR_TARGET_SCORE = 87;
export const TAILOR_ATS_THRESHOLD = TAILOR_TARGET_SCORE;
export const ATS_STRONG_SCORE = 80;
/** Non-tailored resume filter bar (admin UI). */
export const NON_TAILORED_MIN_SCORE = 87;
/** Max Gemini tailor attempts per job before giving up. */
export const MAX_TAILOR_ATTEMPTS = 5;
/** Minimum resume skills that must match the job description to tailor. */
export const MIN_SKILL_MATCH_COUNT = 3;
