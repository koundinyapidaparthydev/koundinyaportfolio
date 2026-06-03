/**
 * Load applicant info for auto-apply from env or PersonalService config.
 *
 * Profile 3 (job search): koundinyapidaparthy@gmail.com
 * Set PERSONAL_SERVICE_CONFIG to PersonalService/config/user.json locally.
 */
import { existsSync, readFileSync } from "fs";

const DEFAULT_PROFILE_ID = process.env.APPLICANT_PROFILE_ID ?? "profile3";

export function normalizeEnvValue(value) {
  const trimmed = String(value ?? "").trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadPersonalServiceProfile() {
  const configPath = process.env.PERSONAL_SERVICE_CONFIG;
  if (!configPath || !existsSync(configPath)) return null;

  try {
    const data = JSON.parse(readFileSync(configPath, "utf8"));
    const profile = (data.profiles ?? []).find((p) => p.id === DEFAULT_PROFILE_ID);
    if (!profile?.email) return null;
    return {
      email: profile.email,
      profileId: profile.id,
      label: profile.label ?? profile.id,
    };
  } catch {
    return null;
  }
}

/**
 * Merge env APPLICANT_* with PersonalService profile3 defaults.
 */
export function resolveApplicant(overrides = {}) {
  const ps = loadPersonalServiceProfile();

  const firstName =
    normalizeEnvValue(process.env.APPLICANT_FIRST_NAME ?? "") || "Koundinya";
  const lastName =
    normalizeEnvValue(process.env.APPLICANT_LAST_NAME ?? "") || "Pidaparthy";

  return {
    email:
      normalizeEnvValue(process.env.APPLICANT_EMAIL ?? "") ||
      ps?.email ||
      "koundinyapidaparthy@gmail.com",
    firstName,
    lastName,
    phone: normalizeEnvValue(process.env.APPLICANT_PHONE ?? "") || "551-229-8660",
    linkedin:
      normalizeEnvValue(process.env.APPLICANT_LINKEDIN ?? "") ||
      "https://linkedin.com/in/koundinyap",
    portfolio:
      normalizeEnvValue(process.env.APPLICANT_PORTFOLIO ?? "") ||
      "https://koundinyapidaparhty.vercel.app",
    location: "New York, NY",
    workAuth: "yes",
    sponsorship: "no",
    profileSource: ps ? `PersonalService:${ps.profileId}` : "env",
    ...overrides,
  };
}
