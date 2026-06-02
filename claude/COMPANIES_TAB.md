# Companies Tab & Job Board

The **Companies** admin tab is the most feature-rich component in the dashboard. It's a private job-application management tool built into the portfolio's admin panel.

---

## Overview

**Location**: `app/admin/_components/CompaniesTab.tsx`  
**Size**: ~1,500 lines — the largest single component in the project  
**Data source**: Google Sheets via `GET /api/jobs`

The Companies tab lets the admin:
- Browse a curated list of target companies organized by category
- See live job listings per company (fetched from Google Sheets)
- Auto-score every job against the resume using the ATS algorithm
- Generate a tailored resume PDF and cover letter PDF per job (Claude AI)
- Bulk-generate PDFs for all high-match jobs at once
- Archive stale job listings to keep the sheet clean

---

## Company Categories

### ✈️ Travel Ticketing (17 companies)
Companies in the live events / travel / ticketing space:
Live Nation, Airbnb, Booking.com, Sabre, NCL, Royal Caribbean Group, Disney, Universal Studios, SeaWorld, SeatGeek (Remote), SeatGeek (NY), StubHub, AXS, CLEAR, Flywire, Lyft, Uber Freight

### 🤖 AI & Agentic (30+ companies)
AI-first and automation companies:
Anthropic, OpenAI, Cursor, Notion, Zapier, LangChain, Cohere, Mistral AI, Hebbia, Harvey AI, Sierra AI, Ema, Adept AI, Cognition AI, Dust.tt, Linear, Retool, Writer, Runway ML, Weights & Biases, Codeium/Windsurf, Salesforce, Microsoft, ServiceNow, and more

### 🌐 General Full Stack (25+ companies)
FAANG and top-tier tech:
Amazon, Google, Meta, Apple, Snap, Stripe, Databricks, Twilio, Cloudflare, Datadog, MongoDB, Riot Games, Vercel, Instacart, Pinterest, DoorDash, Figma, Brex, Ramp, Confluent, Snowflake, Adobe, Intuit, PayPal, Capital One, JPMorgan Chase, Shopify, Zendesk

### ☕ Hiring Cafe
Jobs from the Hiring Cafe aggregator (different data source/format)

Each company record:
```ts
interface Company {
  name: string;
  url: string;         // Direct career page URL
  color: string;       // Tailwind gradient classes for the card
  logo: string;        // Path under /Company_Images/
}
```

---

## Data Flow

```
CompaniesTab mounts
   │
   ▼
useEffect → GET /api/jobs → reads Google Sheets "Jobs" tab
   │
   ▼
Job[] loaded into state:
  { company, title, location, url, category, fetchedAt, description }
   │
   ▼
useEffect → GET /api/resume → loads resume for ATS scoring
   │
   ▼
atsScores Map computed:
  jobs with descriptions → calculateAtsScore(description, resume).score
   │
   ▼
Company cards render with:
  - Total job count per company (filtered by time window)
  - "New" pulse dot if any jobs in last 2 hours
```

---

## Job Filtering

Multiple independent filters are applied in sequence:

```
1. Time filter (applied first):
   filterByTime(jobs, timeFilter)
   → Last 2h | Last 12h | Last 24h | Last 48h

2. Company selection:
   jobs where job.company === selectedCompany

3. Search filter:
   filterBySearch(jobs, searchQuery)
   → matches title or company (case-insensitive)

4. Location filter:
   filterByLocation(jobs, locationFilter)
   → All | Remote (includes "remote" in title/desc)
   → On-site (no "remote" or "hybrid" in title/desc)

5. Sort:
   sortJobs(jobs, sortBy, atsScores)
   → "newest": sort by fetchedAt desc
   → "ats": sort by ATS score desc
   → "title": sort by title A-Z
```

---

## ATS Integration

### Per-Job Score

For every job with a description, the ATS score is pre-computed:

```ts
const atsScores = new Map<string, number>(
  resume
    ? jobs
        .filter((j) => j.description)
        .map((j) => [j.url, calculateAtsScore(j.description, resume).score])
    : []
);
```

### ATS Ring Component

Displayed on each job card:

```
SVG circular ring:
  Score >= 70% → green (#10b981)
  Score >= 50% → amber (#f59e0b)
  Score < 50%  → slate (#94a3b8)
```

### ATS Insight Panel (expanded job)

Clicking a job card expands the `AtsInsightPanel` which shows:

1. **Seniority badge** — inferred from title:
   - Senior/Lead/Staff/Principal → 👑 Senior
   - Junior/Entry/Associate → 🌱 Junior
   - Otherwise → ⚡ Mid

2. **Location badge** — inferred from job location + description:
   - Contains "remote" → 🏠 Remote
   - Contains "hybrid" → 🔀 Hybrid
   - Has location text → 🏢 On-site
   - Unknown → hidden

3. **"Why apply" reasons** — computed by `computeWhyApply()`:
   - Based on ATS score tier
   - Seniority match reasoning
   - Top 4 matched keywords listed
   - Top 2 missing keywords flagged

4. **Keyword chips**: matched (green) and gap (grey)

5. **Full job description** (scrollable, max height 240px)

---

## PDF Generation

### Single Job

```
Admin clicks "Tailored Resume" or "Cover Letter" button
   │
   ▼
POST /api/resume/tailor
  { title, company, description, type: "resume" | "cover" }
   │
   ▼
Server:
  1. Claude claude-haiku-4-5 tailors resume + writes cover letter
  2. @react-pdf/renderer renders PDF buffer
  3. Returns binary PDF as response
   │
   ▼
Client downloads:
  "CompanyName_Resume.pdf" or "CompanyName_Cover_Letter.pdf"
```

### Bulk Generation

Top matches = jobs with ATS >= 70% that have descriptions.

```
Admin clicks "Bulk Generate All Top Matches"
   │
   ▼
bulkState = { running: true, done: 0, total: N, errors: 0 }
   │
   ▼
Sequential loop with 800ms delay between each:
  POST /api/resume/tailor → blob → download
  Update progress counter: "Generating 3 of 8..."
   │
   ▼
Complete: "Done — 2 errors" (or "Done" if zero errors)
bulkState.running = false
```

The 800ms delay prevents browsers from blocking multiple simultaneous downloads.

---

## Archive Flow

```
Admin clicks "Archive Old Jobs"
   │
   ▼
POST /api/jobs/archive
   │
   ▼
Server:
  Reads Google Sheets "Jobs" tab
  Finds rows where fetchedAt is older than 2 days
  Appends those rows to "Old Jobs" sheet
  Deletes them from "Jobs" sheet
   │
   ▼
Returns { archived: N, kept: M }
   │
   ▼
GET /api/jobs refetches automatically
Result displayed: "Archived 12, kept 8"
```

---

## Salary Extraction

For Hiring Cafe jobs, salary info is embedded in the description:

```ts
function extractSalary(desc: string): string {
  // Matches: "$120,000 - $160,000 / yr"
  const m = desc?.match(/^Salary:\s*(\$[\d,]+[kKmM]?(?:\s*[-–—]\s*\$[\d,]+[kKmM]?)?(?:\s*\/\s*(?:yr|year|hr|hour))?)/m);
  // Also tries inline salary pattern
}
```

Displayed as a chip on Hiring Cafe job cards.

---

## State Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `activeCategory` | `CompanyCategory` | Currently selected tab |
| `selectedCompany` | `string \| null` | Which company's jobs are shown |
| `jobs` | `Job[]` | All jobs from Google Sheets |
| `timeFilter` | `TimeFilter` | Active time filter |
| `searchQuery` | `string` | Free text search |
| `sortBy` | `SortMode` | Sort order |
| `locationFilter` | `LocationFilter` | Remote/onsite filter |
| `expandedJob` | `string \| null` | URL of expanded job card |
| `resume` | `Resume \| null` | Loaded from /api/resume for ATS |
| `generating` | `Record<string, "resume"\|"cover">` | In-progress generations |
| `bulkState` | `{ running, done, total, errors }` | Bulk generation progress |
| `archiving` | `boolean` | Archive in progress |
| `archiveResult` | `{ archived, kept } \| null` | Last archive result |

---

## Google Sheets Structure

The "Jobs" sheet has columns A through G:

| Column | Field |
|--------|-------|
| A | company |
| B | title |
| C | location |
| D | url |
| E | category |
| F | fetchedAt (ISO string) |
| G | description |

Row 1 is headers — the API skips it.

---

## Adding New Companies

To add a company to a category, edit `CompaniesTab.tsx`:

```ts
const TRAVEL_COMPANIES: Company[] = [
  // ... existing entries
  {
    name: "New Company",
    url: "https://newcompany.com/careers",
    color: "from-sky-500/20 to-sky-600/10 border-sky-500/30 hover:border-sky-400/60",
    logo: "/Company_Images/NewCompany.ico",
  },
];
```

Add the logo file to `public/Company_Images/`.

---

## Dependencies

| Package | Version | Use |
|---------|---------|-----|
| `googleapis` | ^173 | Sheets read/write |
| `@anthropic-ai/sdk` | ^0.100 | Claude API |
| `@react-pdf/renderer` | ^4.5 | PDF generation |
| `@google-cloud/storage` | ^7 | PDF cloud upload |
| `lib/atsScoring.ts` | internal | ATS keyword matching |
