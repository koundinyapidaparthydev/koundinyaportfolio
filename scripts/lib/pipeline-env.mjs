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
  return true;
}
