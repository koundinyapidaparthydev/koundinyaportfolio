/**
 * Shared validation for job-scraping scripts and GitHub Actions preflight.
 */

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

export function parseServiceAccountJson(raw, label = "service account") {
  if (!raw?.trim()) {
    throw new Error(`${label} JSON is empty`);
  }
  const creds = JSON.parse(raw);
  if (!creds?.client_email || !creds?.private_key) {
    throw new Error(`${label} JSON missing client_email or private_key`);
  }
  return creds;
}

const STAGES = {
  scrape: ["GOOGLE_SHEET_ID", "GOOGLE_SERVICE_ACCOUNT_JSON"],
  weekly: [
    "GOOGLE_SHEET_ID",
    "GOOGLE_SERVICE_ACCOUNT_JSON",
    "GEMINI_API_KEY",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_RECIPIENT",
  ],
};

export function validatePipelineEnv(stage = "scrape") {
  const keys = STAGES[stage];
  if (!keys) {
    throw new Error(`Unknown stage: ${stage}. Use: ${Object.keys(STAGES).join(", ")}`);
  }

  const missing = keys.filter((k) => !normalizeEnvValue(process.env[k] ?? ""));
  if (missing.length) {
    throw new Error(`Missing env: ${missing.join(", ")}`);
  }

  parseServiceAccountJson(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, "Google Sheets");

  if (stage === "scrape") {
    warnOptionalPipelineEnv();
  }

  return true;
}

function warnOptionalPipelineEnv() {
  const warnings = [];

  if (!normalizeEnvValue(process.env.GEMINI_API_KEY ?? "")) {
    warnings.push("GEMINI_API_KEY — ATS scoring and resume tailoring will be skipped");
  }

  const hasGcsCreds = normalizeEnvValue(process.env.GCS_SERVICE_ACCOUNT_JSON ?? "");
  const hasGcsBucket = normalizeEnvValue(process.env.GCS_BUCKET_NAME ?? "");
  if (!hasGcsCreds || !hasGcsBucket) {
    warnings.push(
      "GCS_SERVICE_ACCOUNT_JSON / GCS_BUCKET_NAME — tailored resume PDFs cannot be uploaded"
    );
  }

  for (const msg of warnings) {
    console.warn(`⚠️  Pipeline optional env missing: ${msg}`);
  }
}

/** Warn when optional scrape-stage env is missing (ATS scoring / resume upload). */
export function warnOptionalEnv(stage = "scrape") {
  if (stage === "scrape") warnOptionalPipelineEnv();
}
