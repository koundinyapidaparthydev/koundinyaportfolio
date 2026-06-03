/**
 * Shared validation for job-pipeline scripts and GitHub Actions preflight.
 */
import { normalizeEnvValue } from "./applicant-profile.mjs";

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
  generate: [
    "GOOGLE_SHEET_ID",
    "GOOGLE_SERVICE_ACCOUNT_JSON",
    "ANTHROPIC_API_KEY",
    "GCS_SERVICE_ACCOUNT_JSON",
    "GCS_BUCKET_NAME",
  ],
  apply: ["GOOGLE_SHEET_ID", "GOOGLE_SERVICE_ACCOUNT_JSON"],
  weekly: [
    "GOOGLE_SHEET_ID",
    "GOOGLE_SERVICE_ACCOUNT_JSON",
    "ANTHROPIC_API_KEY",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_RECIPIENT",
  ],
};

export function validatePipelineEnv(stage = "generate") {
  const keys = STAGES[stage];
  if (!keys) {
    throw new Error(`Unknown stage: ${stage}. Use: ${Object.keys(STAGES).join(", ")}`);
  }

  const missing = keys.filter((k) => !normalizeEnvValue(process.env[k] ?? ""));
  if (missing.length) {
    throw new Error(`Missing env: ${missing.join(", ")}`);
  }

  parseServiceAccountJson(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, "Google Sheets");

  if (stage === "generate") {
    parseServiceAccountJson(process.env.GCS_SERVICE_ACCOUNT_JSON, "GCS");
    if (!process.env.ANTHROPIC_API_KEY?.startsWith("sk-")) {
      console.warn("⚠️  ANTHROPIC_API_KEY may be invalid (expected sk-… prefix)");
    }
  }

  if (stage === "apply" && process.env.RECORD_APPLY === "true") {
    parseServiceAccountJson(process.env.GCS_SERVICE_ACCOUNT_JSON, "GCS");
    if (!normalizeEnvValue(process.env.GCS_BUCKET_NAME ?? "")) {
      throw new Error("Missing env: GCS_BUCKET_NAME (required when RECORD_APPLY=true)");
    }
  }

  return true;
}
