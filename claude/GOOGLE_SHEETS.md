# Google Sheets Integration

The portfolio uses Google Sheets as a lightweight database for the job board feature in the admin Companies tab.

---

## Overview

| Sheet Tab | Purpose |
|-----------|---------|
| `Jobs` | Active job listings (read/write) |
| `Old Jobs` | Archived jobs older than 2 days |

The Sheets are read/written via the **Google Sheets API v4** using a **service account** (server-to-server auth — no OAuth user flow needed).

---

## Setup: Google Cloud Service Account

### Step 1: Create a GCP Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g., `jobseek-459701`)

### Step 2: Enable Sheets API

1. Go to APIs & Services → Enable APIs
2. Search for "Google Sheets API"
3. Click Enable

### Step 3: Create a Service Account

1. IAM & Admin → Service Accounts → Create Service Account
2. Name: `portfolio-sheets-reader`
3. Role: **Editor** (or a custom role with sheets read/write)
4. Click Done

### Step 4: Download JSON Key

1. Click the service account → Keys → Add Key → JSON
2. Download the JSON file
3. Set as `GOOGLE_SERVICE_ACCOUNT_JSON` env var (entire JSON as one string)

### Step 5: Share the Google Sheet

1. Open your Google Sheet
2. Share → paste the service account email (ends in `@<project>.iam.gserviceaccount.com`)
3. Give **Editor** role

---

## Sheet Structure

### "Jobs" Sheet Columns

| Col | Name | Example |
|-----|------|---------|
| A | `company` | `"Anthropic"` |
| B | `title` | `"Senior Software Engineer"` |
| C | `location` | `"Remote, US"` |
| D | `url` | `"https://..."` |
| E | `category` | `"ai-agentic"` |
| F | `fetchedAt` | `"2026-06-01T14:30:00.000Z"` |
| G | `description` | `"We are looking for..."` |

Row 1 is a header row (skipped by the API).

---

## API Endpoints

### `GET /api/jobs`

**File**: `app/api/jobs/route.ts`

Reads all rows from the "Jobs" sheet.

```ts
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });
const response = await sheets.spreadsheets.values.get({
  spreadsheetId: process.env.GOOGLE_SHEET_ID,
  range: "Jobs!A:G",
});
```

Returns `{ jobs: Job[] }`. Never cached (`export const dynamic = "force-dynamic"`).

**Error handling**:
- If `GOOGLE_SHEET_ID` or `GOOGLE_SERVICE_ACCOUNT_JSON` not set → 503 `{ jobs: [], error: "not configured" }`
- If Sheets API call fails → 500 `{ jobs: [], error: "Failed to fetch jobs" }`

### `POST /api/jobs/archive`

**File**: `app/api/jobs/archive/route.ts`

Moves jobs older than 2 days from "Jobs" to "Old Jobs" sheet.

Steps:
1. Read all rows from "Jobs"
2. Identify rows where `fetchedAt` is more than 48 hours ago
3. Append those rows to "Old Jobs"
4. Delete those rows from "Jobs" (in reverse order to preserve row indices)
5. Return `{ archived: N, kept: M }`

---

## Environment Variables

```env
GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"...","client_email":"...@....iam.gserviceaccount.com"}
```

> **Important**: The JSON must be the raw JSON string, NOT double-stringified. If you set it in Vercel, paste the JSON directly into the value field (Vercel handles the escaping).

---

## How Jobs Get Into the Sheet

The sheet is populated by an **external automation pipeline** — not the portfolio itself. The portfolio only reads and archives.

The expected pipeline (based on `POST /api/internal/generate-and-store`):

```
External job scraper / cron job
   │
   ▼
POST /api/internal/generate-and-store
  x-internal-key: <INTERNAL_API_KEY>
  { company, title, description, jobUrl }
   │
   ▼
Claude tailors resume + generates cover letter
PDF uploaded to GCS
Returns { resumeUrl, coverLetterText, atsScore, matched, missing }
```

A separate script (not in this repo) would be responsible for:
1. Scraping job listings
2. Calling the portfolio's internal endpoint
3. Writing results to Google Sheets

---

## Using Without Google Sheets

If `GOOGLE_SHEET_ID` is not set, the Companies tab will:
- Show all company cards (they're hardcoded)
- Show 0 job counts on all cards
- Show empty job list when a company is selected
- NOT error — just shows empty state

This is acceptable for the portfolio itself. The job board feature is purely for the admin's private use.

---

## Data Freshness

The "Jobs" tab is not automatically refreshed. The admin must:
1. Run the external scraper script (or automation), OR
2. Manually add rows to the sheet

The Companies tab shows a pulsing green dot on company cards that have jobs fetched within the last 2 hours (based on the `fetchedAt` column).

---

## Security

- The service account JSON is a server-only secret (never exposed to the browser)
- `GET /api/jobs` does NOT require admin auth — it's technically public but returns only job data
- `POST /api/jobs/archive` should be protected (check the route handler for auth guard)
