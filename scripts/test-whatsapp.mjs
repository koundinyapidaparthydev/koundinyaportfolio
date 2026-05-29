/**
 * One-shot test: sends a sample WhatsApp notification via Meta WhatsApp Cloud API.
 * Credentials are from PersonalService/config/user.json — already set in .env.local
 * Run:  node scripts/test-whatsapp.mjs
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN;
const RECIPIENT       = process.env.WHATSAPP_RECIPIENT ?? "+15512298660";

if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
  console.error("❌  WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN is not set in .env.local");
  process.exit(1);
}

// Fake job rows: [Company, Title, Location, URL, Category, FetchedAt, Description]
const fakeJobs = [
  ["SeatGeek (Remote)", "Senior Software Engineer", "Remote - US", "https://boards.greenhouse.io/seatgeek/jobs/1", "Engineering", new Date().toISOString(), ""],
  ["SeatGeek (Remote)", "Staff Engineer – Platform", "Remote - US", "https://boards.greenhouse.io/seatgeek/jobs/2", "Engineering", new Date().toISOString(), ""],
  ["Airbnb", "Software Engineer, Payments", "San Francisco, CA", "https://careers.airbnb.com/positions/1", "Engineering", new Date().toISOString(), ""],
  ["Uber", "Senior Frontend Engineer", "New York, NY", "https://www.uber.com/careers/list/1", "Engineering", new Date().toISOString(), ""],
];

// Group by company
const byCompany = {};
for (const row of fakeJobs) {
  const company = row[0] ?? "Unknown";
  (byCompany[company] ??= []).push({ title: row[1] ?? "", url: row[3] ?? "" });
}

const ts = new Date().toLocaleString("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
});

const lines = [
  `🎯 *[TEST] ${fakeJobs.length} New Engineering Jobs* — ${ts} PDT`,
  ``,
  `_(This is a test — real alerts fire automatically after each scrape)_`,
];

for (const [company, jobs] of Object.entries(byCompany)) {
  lines.push(`\n*${company}* (${jobs.length})`);
  for (const { title, url } of jobs.slice(0, 5)) {
    lines.push(`• ${title}\n  ${url}`);
  }
}
lines.push(`\n🔗 https://koundinyapidaparhty.vercel.app/admin`);

const text = lines.join("\n").slice(0, 4000);

console.log("📤  Sending test WhatsApp to", RECIPIENT, "...");
console.log("--- Message preview ---");
console.log(text);
console.log("--- End preview ---\n");

const res = await fetch(
  `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: RECIPIENT,
      type: "text",
      text: { body: text },
    }),
  }
);
const body = await res.json();

if (res.ok) {
  console.log("✅  Message sent! Check WhatsApp on", RECIPIENT);
  console.log("   Message ID:", body.messages?.[0]?.id);
} else {
  console.error(`❌  Failed (${res.status}):`, JSON.stringify(body, null, 2));
}
