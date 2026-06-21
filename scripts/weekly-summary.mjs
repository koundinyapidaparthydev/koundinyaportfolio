#!/usr/bin/env node
/**
 * Weekly AI Career Summary
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every Sunday via GitHub Actions (weekly-summary.yml).
 * 1. Fetches the last 7 days of jobs from Google Sheets
 * 2. Sends everything + your resume profile to Gemini
 * 3. Gemini returns:
 *    • Weekly job-market analysis  (which companies, roles, trends)
 *    • 3 tailored project suggestions to build this week
 *    • 3 resume / skill tips specific to what employers are asking for
 * 4. Delivers the report in 3 WhatsApp messages via Meta WhatsApp Cloud API
 *
 * Required env vars:
 *   GOOGLE_SHEET_ID              — target sheet
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — service account (full JSON string)
 *   GEMINI_API_KEY               — Gemini API key
 *   WHATSAPP_PHONE_NUMBER_ID     — from Meta Developer console
 *   WHATSAPP_ACCESS_TOKEN        — permanent system user token
 *   WHATSAPP_RECIPIENT           — recipient phone e.g. +15512298660 (optional)
 */

import { readFileSync } from "fs";
import { loadEnvLocal } from "./lib/load-env.mjs";
import { validatePipelineEnv } from "./lib/pipeline-env.mjs";
import { google } from "googleapis";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";

loadEnvLocal();

try {
  validatePipelineEnv("weekly");
} catch (err) {
  console.error(`❌  ${err.message}`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SHEET_NAME = "Jobs";
const ADMIN_URL = "https://koundinyapidaparhty.vercel.app/admin";

// ─────────────────────────────────────────────────────────────────────────────
// Google Sheets — get last N days of jobs
// ─────────────────────────────────────────────────────────────────────────────

function parseServiceAccountJson(raw) {
  const creds = JSON.parse(raw);
  if (!creds?.client_email || !creds?.private_key) {
    throw new Error("missing client_email or private_key");
  }
  return creds;
}

async function getSheets() {
  const creds = parseServiceAccountJson(GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

async function fetchRecentJobs(sheets, days = 7) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A2:G`,
  });
  const rows = resp.data.values ?? [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const recent = rows.filter((row) => {
    const fetchedAt = row[5];
    if (!fetchedAt) return false;
    try {
      return new Date(fetchedAt) >= cutoff;
    } catch {
      return false;
    }
  });

  return recent.map((row) => ({
    company: row[0] ?? "",
    title: row[1] ?? "",
    location: row[2] ?? "",
    url: row[3] ?? "",
    category: row[4] ?? "",
    fetchedAt: row[5] ?? "",
    description: (row[6] ?? "").slice(0, 400), // trim long descriptions
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Build a compact profile from resume.json
// ─────────────────────────────────────────────────────────────────────────────

function buildProfile() {
  try {
    const resume = JSON.parse(readFileSync("data/resume.json", "utf8"));
    const p = resume.personalInfo ?? {};
    const skills = (resume.skills ?? [])
      .flatMap((s) => s.skills ?? [])
      .join(", ");
    const experience = (resume.experience ?? [])
      .slice(0, 3)
      .map((e) => `${e.role} @ ${e.companyName} (${e.date})`)
      .join("; ");
    const projects = (resume.projects ?? [])
      .slice(0, 3)
      .map((pr) => `${pr.name} — ${pr.description?.slice(0, 80) ?? ""}`)
      .join("; ");
    return `
Name: ${p.name}
Title: ${p.title}
Location: ${p.location}
Summary: ${p.summary}
Skills: ${skills}
Recent Experience: ${experience}
Projects: ${projects}
    `.trim();
  } catch {
    return "Full-Stack Software Engineer with 3+ years experience in React, Next.js, Node.js, TypeScript, AWS.";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini — generate the weekly report
// ─────────────────────────────────────────────────────────────────────────────

async function generateReport(jobs, profile) {

  // Summarise jobs for the prompt (don't blow the context window)
  const companyCounts = {};
  const roleSample = [];
  for (const job of jobs) {
    companyCounts[job.company] = (companyCounts[job.company] ?? 0) + 1;
    if (roleSample.length < 40) roleSample.push(`${job.title} @ ${job.company}`);
  }
  const companySummary = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c} (${n})`)
    .join(", ");

  const weekLabel = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });

  const prompt = `You are a senior tech career coach. Analyse the job market data below and the candidate's profile to produce a weekly career report.

## CANDIDATE PROFILE
${profile}

## JOB MARKET DATA  (week of ${weekLabel})
Total new jobs posted: ${jobs.length}
Companies and job counts: ${companySummary}
Sample roles:
${roleSample.join("\n")}

---
Produce a report in EXACTLY this format with these section separators (do not change the separators):

===MARKET===
📊 *Job Market — Week of ${weekLabel}*

Write 3–4 sentences: what companies are hiring most, what role types are trending, and how this matches the candidate's skills. Keep it sharp and personal.

Total: ${jobs.length} roles across ${Object.keys(companyCounts).length} companies.

Top hiring:
• [top 5 companies with counts, one per line]

Trending roles: [3–5 role types you see most]

===PROJECTS===
💡 *3 Projects to Build This Week*

For each project give: project name (bold), the stack (1 line), and 2–3 sentences on what to build and exactly why it helps for the jobs above. Be specific and practical. Format exactly as:

*1. [Project Name]*
Stack: [technologies]
[2–3 sentences: what to build + why it directly targets the jobs you see]

*2. [Project Name]*
Stack: [technologies]
[2–3 sentences]

*3. [Project Name]*
Stack: [technologies]
[2–3 sentences]

===TIPS===
✍️ *Resume & Skill Tips This Week*

3 specific, actionable tips based on what the job descriptions above are asking for that the candidate should add or improve. Each tip should be 1–2 sentences.

• [Tip 1]
• [Tip 2]  
• [Tip 3]

🔗 ${ADMIN_URL}

---
Rules:
- Use WhatsApp formatting: *bold* for headers and project names
- Keep each section under 1500 characters
- Be direct and personal, address the candidate as "you"
- Do not add any text outside the three sections
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 1800,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse Gemini's response into 3 sections
// ─────────────────────────────────────────────────────────────────────────────

function parseSections(raw) {
  const market = raw.match(/===MARKET===([\s\S]*?)===PROJECTS===/)?.[1]?.trim() ?? "";
  const projects = raw.match(/===PROJECTS===([\s\S]*?)===TIPS===/)?.[1]?.trim() ?? "";
  const tips = raw.match(/===TIPS===([\s\S]*?)$/)?.[1]?.trim() ?? "";
  return { market, projects, tips };
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp via Callmebot
// ─────────────────────────────────────────────────────────────────────────────

async function sendWhatsApp(text) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN;
  const recipient     = process.env.WHATSAPP_RECIPIENT ?? "+15512298660";

  if (!phoneNumberId || !accessToken) {
    console.log("ℹ️   WHATSAPP credentials not set — printing message instead:\n");
    console.log(text);
    console.log("---");
    return;
  }

  const body = text.slice(0, 4000);
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "text",
          text: { body },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
    if (res.ok) {
      console.log("📱  Sent:", body.slice(0, 60) + "…");
    } else {
      if (res.status === 401 || res.status === 403) {
        console.warn(
          `⚠️   WhatsApp auth failed (${res.status}) — WHATSAPP_ACCESS_TOKEN is expired or revoked. ` +
          `Refresh it in Meta Business Suite (System Users → permanent token), then update the GitHub ` +
          `secret and .env.local.`
        );
      } else {
        console.warn(`⚠️   Send failed (${res.status}):`, (await res.text()).slice(0, 300));
      }
    }
  } catch (err) {
    console.warn("⚠️   WhatsApp error:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // Validate required env vars
  if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.error("❌  Missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON");
    process.exit(1);
  }
  if (!GEMINI_API_KEY) {
    console.error("❌  Missing GEMINI_API_KEY");
    process.exit(1);
  }

  console.log("📅  Generating weekly career summary…");

  // 1. Fetch jobs from last 7 days
  const sheets = await getSheets();
  const jobs = await fetchRecentJobs(sheets, 7);
  console.log(`✅  Found ${jobs.length} jobs from the last 7 days`);

  if (jobs.length === 0) {
    console.log("ℹ️   No jobs found in the last 7 days — skipping report");
    return;
  }

  // 2. Build candidate profile
  const profile = buildProfile();

  // 3. Ask Gemini for the report
  console.log("🤖  Calling Gemini for analysis…");
  const raw = await generateReport(jobs, profile);
  console.log("✅  Gemini response received");

  // 4. Parse into 3 sections
  const { market, projects, tips } = parseSections(raw);

  if (!market && !projects && !tips) {
    console.warn("⚠️   Could not parse sections from Gemini response:");
    console.log(raw);
    // Send raw as a single message as fallback
    await sendWhatsApp(raw.slice(0, 1600));
    return;
  }

  // 5. Send 3 WhatsApp messages (with 65s gap for Callmebot rate limit)
  console.log("📤  Sending 3 WhatsApp messages…");
  await sendWhatsApp(market);
  await sendWhatsApp(projects);
  await sendWhatsApp(tips);

  console.log("🎉  Weekly summary delivered!");
}

main().catch((err) => {
  console.error("❌  Fatal error:", err);
  process.exit(1);
});
