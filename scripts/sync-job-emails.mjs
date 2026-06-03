#!/usr/bin/env node
/**
 * Sync Profile 3 Gmail job-related emails into Google Sheet Notes (column M).
 *
 * Requires:
 *   PERSONAL_SERVICE_CONFIG → PersonalService/config/user.json
 *   GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON
 *
 * Profile 3 token: ../Email/token.profile3.json (relative to PersonalService)
 */
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { parseServiceAccountJson } from "./lib/pipeline-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadEnvLocal();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const PROFILE_ID = process.env.APPLICANT_PROFILE_ID ?? "profile3";
const SHEET_NAME = "Jobs";

const JOB_CATEGORIES = [
  { key: "interview", patterns: [/\binterview\b/i, /phone.*screen/i, /schedule.*call/i] },
  { key: "offer", patterns: [/offer letter/i, /\bjob offer\b/i, /extend.*offer/i] },
  { key: "rejection", patterns: [/not moving forward/i, /unfortunately/i, /not selected/i] },
  { key: "assessment", patterns: [/\bassessment\b/i, /coding challenge/i, /hackerrank/i] },
];

function classify(text) {
  for (const c of JOB_CATEGORIES) {
    if (c.patterns.some((rx) => rx.test(text))) return c.key;
  }
  return null;
}

function resolveProfile(configPath) {
  const raw = JSON.parse(readFileSync(configPath, "utf8"));
  const profile = (raw.profiles ?? []).find((p) => p.id === PROFILE_ID);
  if (!profile) throw new Error(`Profile ${PROFILE_ID} not found in ${configPath}`);
  const configDir = path.dirname(configPath);
  const tokenPath = path.resolve(configDir, profile.tokenPath);
  return { profile, tokenPath };
}

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: parseServiceAccountJson(GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function fetchJobEmails(tokenPath) {
  const tokenData = JSON.parse(readFileSync(tokenPath, "utf8"));
  if (!tokenData?.refresh_token) {
    throw new Error(`Invalid Gmail token at ${tokenPath}`);
  }
  const auth = google.auth.fromJSON(tokenData);
  const gmail = google.gmail({ version: "v1", auth });
  const q =
    "newer_than:7d (interview OR offer OR assessment OR \"not moving forward\" OR \"application received\") -category:promotions";

  const list = await gmail.users.messages.list({ userId: "me", maxResults: 40, q });
  const messages = list.data.messages ?? [];
  const results = [];

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    });
    const headers = detail.data.payload?.headers ?? [];
    const get = (n) => headers.find((h) => h.name === n)?.value ?? "";
    const subject = get("Subject");
    const from = get("From");
    const snippet = detail.data.snippet ?? "";
    const combined = `${subject} ${from} ${snippet}`;
    const cat = classify(combined);
    if (!cat) continue;
    results.push({
      category: cat,
      subject,
      from,
      date: get("Date"),
      snippet: snippet.slice(0, 120),
    });
  }
  return results;
}

function companyFromEmail(from, subject) {
  const domain = from.match(/@([\w.-]+)/)?.[1] ?? "";
  const name = domain.split(".")[0];
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : subject.slice(0, 40);
}

async function main() {
  if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.error("❌  Missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON");
    process.exit(1);
  }

  const configPath = process.env.PERSONAL_SERVICE_CONFIG;
  if (!configPath || !existsSync(configPath)) {
    console.error(
      "❌  Set PERSONAL_SERVICE_CONFIG to PersonalService/config/user.json"
    );
    process.exit(1);
  }

  const { profile, tokenPath } = resolveProfile(configPath);
  if (!existsSync(tokenPath)) {
    console.error(`❌  Gmail token not found: ${tokenPath}`);
    process.exit(1);
  }

  console.log(`📧  Syncing job emails for ${profile.email}…\n`);
  const emails = await fetchJobEmails(tokenPath);
  console.log(`   Found ${emails.length} job-related messages\n`);

  if (emails.length === 0) return;

  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A2:M5000`,
  });
  const rows = res.data.values ?? [];

  let updated = 0;
  for (const email of emails) {
    const hint = companyFromEmail(email.from, email.subject).toLowerCase();
    for (let i = 0; i < rows.length; i++) {
      const company = (rows[i][0] ?? "").toLowerCase();
      if (!company) continue;
      const match =
        hint.includes(company.slice(0, 4)) || company.includes(hint.slice(0, 4));
      if (!match) continue;
      const note = `[${email.category}] ${email.subject} (${email.date?.slice(0, 16) ?? ""})`;
      const rowIndex = i + 2;
      await sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${SHEET_NAME}!M${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [[note]] },
      });
      updated++;
      break;
    }
  }

  console.log(`✅  Updated ${updated} sheet row(s) in column M (Notes)`);
}

main().catch((err) => {
  console.error("Fatal:", err.message ?? err);
  process.exit(1);
});
