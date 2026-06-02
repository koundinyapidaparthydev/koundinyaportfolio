# Admin Flows

Complete step-by-step documentation of every flow in the admin dashboard.

---

## Accessing the Admin Dashboard

### Flow: First-time Login

```
Browser visits /admin
   │
   ▼
middleware.ts checks for NextAuth session
   │
   ├─ Session exists + role === "admin" ──► /admin (serve page)
   │
   └─ No session ──► redirect to /login?callbackUrl=/admin
                          │
                          ▼
                     User submits email + password
                          │
                          ▼
                     POST /api/auth/[...nextauth]
                          │
                     NextAuth CredentialsProvider.authorize()
                          │
                          ├─ data/admin.json has passwordHash ──► PBKDF2 verify
                          │
                          └─ No hash in file ──► compare against ADMIN_PASSWORD env var
                                    │
                               Match: create JWT { role: "admin" }
                               Mismatch: return null → "CredentialsSignin" error
```

**Login page** (`app/login/page.tsx`):
- Uses `react-hook-form` + Zod validation (email + min-length password)
- Calls `signIn("credentials", { redirect: false })`
- On success → `router.push(callbackUrl)` (defaults to `/admin`)
- On error → shows inline banner: "Invalid email or password"
- Back-button link returns to portfolio home

---

## Tab Navigation

The admin dashboard has **5 tabs**, loaded with `next/dynamic` (code-split, lazy):

| Tab | ID | Component | Purpose |
|-----|----|-----------|---------|
| Overview | `overview` | `OverviewTab` | Visitor analytics |
| Edit Resume | `edit-resume` | `EditResumeTab` | Full resume editor |
| Visitors | `visitors` | `VisitorsTab` | Raw visitor log |
| Settings | `settings` | `SettingsTab` | Change password |
| Companies | `companies` | `CompaniesTab` | Job board browser |

The tab state lives in the top-level `AdminPage` component as `useState<AdminTab>`. Switching tabs triggers lazy loading (spinner shown while chunk loads).

**Sidebar** (`app/admin/_components/Sidebar.tsx`):
- Desktop: vertical left column (fixed width 224px)
- Mobile: horizontal scrollable tab strip

---

## Flow 1 — Visitor Analytics (Overview Tab)

```
Admin clicks "Overview"
   │
   ▼
OverviewTab mounts
   │
   ▼
useQuery(["visitors"], fetchVisitors, { staleTime: 30s })
   │
   ▼
GET /api/visitors  (requires admin session)
   │
   ▼
Returns VisitorEntry[] (newest first)
   │
   ▼
Client computes derived stats:
  - Total visitors
  - Today vs yesterday delta
  - Unique IPs (Set dedup)
  - Top browser (most frequent)
  - Last visit timestamp
  - 30-day average per day
   │
   ▼
Renders:
  6 stat cards (2x3 grid)
  7-day traffic bar chart
  By Device / By Browser / By OS breakdown bars
  Top Pages + Top Referrers (horizontal bar lists)
  Geographic Distribution (top 5 countries, pill badges)
  Recent Activity table (last 10 rows)
```

Data freshness: `staleTime: 30_000` ms. Auto-refetches on window focus after staleness.

---

## Flow 2 — Editing Resume (Edit Resume Tab)

### 2a. Load and Initialize

```
Admin clicks "Edit Resume"
   │
   ▼
EditResumeTab mounts
   │
   ▼
useResume() reads from Zustand resumeStore
   │
   ▼
useLayoutEffect: converts Resume → ResumeFormValues via toForm()
  (wraps string[] as {value: string}[] for useFieldArray)
   │
   ▼
useForm initialised with converted data + zodResolver
   │
   ▼
Form renders 5 collapsible sections:
  Personal Info | Experience | Projects | Skills | Education
```

### 2b. Editing a Field

```
Admin types into any input
   │
   ▼
react-hook-form tracks change (uncontrolled)
   │
   ▼
useWatch() detects change
   │
   ▼
500ms debounce fires
   │
   ▼
fromForm(values) converts back to Resume object
   │
   ▼
useUpdateResume(resume) → Zustand set() + auto-save
   │
   ▼
PUT /api/resume (admin auth required)
   │
   ▼
Zod ResumeSchema validates payload
   │
   ▼
saveResume() persists to data/resume.ts (local) / warns on Vercel
   │
   ▼
"Saved" indicator shown for 2s
```

### 2c. Drag to Reorder

```
Admin grabs drag handle on an Experience or Project card
   │
   ▼
@dnd-kit PointerSensor activates (threshold: 8px movement)
   │
   ▼
DragEnd event fires
   │
   ▼
oldIdx and newIdx computed from field IDs
   │
   ▼
useFieldArray.move(oldIdx, newIdx)
   │
   ▼
Form re-renders → debounce triggers auto-save
```

### 2d. Undo / Redo

```
Admin makes edits (each debounce save pushes snapshot to history)
   │
   ▼
Cmd+Z (or Ctrl+Z) fires global keydown listener
   │
   ▼
useResumeHistoryStore.undo()
   │
   ▼
Pops history stack → restores previous Resume object
   │
   ▼
form.reset(toForm(previousResume))
   │
   ▼
Zustand resumeStore updated with restored data
```

History max depth: 20 entries. `Cmd+Shift+Z` = redo.

### 2e. Export JSON Backup

```
Admin clicks "Export JSON"
   │
   ▼
fromForm(form.getValues()) → Resume object
   │
   ▼
JSON.stringify(resume, null, 2)
   │
   ▼
Blob download triggered as resume_backup.json
```

### 2f. Live Preview

```
Admin clicks "Preview" button
   │
   ▼
isPreviewOpen = true
   │
   ▼
Layout shifts to 50/50 split:
  Left panel: form editor
  Right panel: ResumePreview component (read-only visual)
```

---

## Flow 3 — Visitors Raw Log (Visitors Tab)

```
Admin clicks "Visitors"
   │
   ▼
VisitorsTab mounts, useQuery fetches visitor data
   │
   ▼
Renders scrollable table with 9 columns:
  Timestamp | IP | Device | Browser | OS | Country | Page | Referrer | UA

Admin actions:
  Search  → filters by IP, page, country, browser (client-side, instant)
  Paginate → 25 rows/page, Previous/Next
  Refresh  → manually re-fetches from API
  Export CSV → downloads filtered results as visitors-YYYY-MM-DD.csv
```

**CSV columns**: Timestamp, IP, Device, Browser, OS, Country, City, Page, Referrer, Language, Screen, Timezone, User Agent

---

## Flow 4 — Change Password (Settings Tab)

```
Admin fills 3 fields: Current password, New password, Confirm new password
   │
   ▼
Zod validates client-side (new >= 8 chars, confirm matches)
   │
   ▼
PATCH /api/auth/password { currentPassword, newPassword }
   │
   ▼
Server verifies currentPassword:
  1. PBKDF2 compare against data/admin.json hash, OR
  2. Plain compare against ADMIN_PASSWORD env var fallback
   │
   ├─ Valid: PBKDF2 hash new password → write data/admin.json → 200 OK
   └─ Invalid: return 401 { error: "..." }
   │
   ▼
Client shows success (green) or error (red) toast for 5 seconds
Form resets on success
```

---

## Flow 5 — Companies / Job Browser (Companies Tab)

### 5a. Browse Company Cards

```
CompaniesTab mounts
   │
   ▼
GET /api/jobs (reads Google Sheets "Jobs" tab via googleapis)
   │
   ▼
4 category tabs: Travel Ticketing | AI & Agentic | General Full Stack | Hiring Cafe
   │
   ▼
Company cards grid:
  - Logo + name
  - Job count badge
  - Pulsing green dot if new jobs in last 2h
  - Direct career page external link
```

### 5b. Filter and Sort Jobs

```
Admin clicks a company card → selectedCompany set
   │
   ▼
Job list panel appears below grid

Filters available:
  Time:     Last 2h | Last 12h | Last 24h | Last 48h
  Location: All | Remote only | On-site only
  Sort:     Newest | ATS score desc | Title A-Z
  Search:   free text (title or company)
```

### 5c. ATS Score per Job

```
Each job card shows:
  - ATS ring (circular SVG): % resume keyword match
  - Seniority badge: Senior / Mid / Junior (inferred from title)
  - Location badge: Remote / Hybrid / On-site

Clicking a job expands AtsInsightPanel showing:
  - "Why apply" bullet reasons
  - Matched keywords (green chips, up to 8)
  - Gap keywords (grey chips, up to 4)
  - Full job description text
```

### 5d. Generate Tailored Resume / Cover Letter

```
Admin clicks "Tailored Resume" or "Cover Letter" on a job
   │
   ▼
POST /api/resume/tailor { title, company, description, type }
   │
   ▼
Claude haiku tailors resume JSON (or generates cover letter)
   │
   ▼
@react-pdf/renderer renders PDF buffer
   │
   ▼
Blob response → browser download (Company_Resume.pdf or Company_Cover_Letter.pdf)
```

### 5e. Bulk Generate Top Matches

```
Admin clicks "Bulk Generate All Top Matches"
   │
   ▼
System filters: jobs with ATS score >= 70% AND have description
   │
   ▼
Sequential loop (800ms delay between each):
  POST /api/resume/tailor → PDF → download
   │
   ▼
Progress shown: "Generating 3 of 8..."
Final: "Done — X errors"
```

### 5f. Archive Old Jobs

```
Admin clicks "Archive Old Jobs"
   │
   ▼
POST /api/jobs/archive
   │
   ▼
Server moves jobs older than 2 days from "Jobs" sheet to "Old Jobs" sheet
   │
   ▼
Returns { archived: N, kept: M }
   │
   ▼
GET /api/jobs refetches automatically
Result shown: "Archived 12 jobs, kept 8"
```

---

## Flow 6 — Download Resume PDF

```
Admin clicks "Download PDF" in Edit Resume toolbar
   │
   ▼
GET /api/resume/pdf
   │
   ▼
getResume() loads current resume data
   │
   ▼
React.createElement(ResumePdfDocument, { resume })
renderToBuffer() → PDF binary
   │
   ▼
Response headers:
  Content-Type: application/pdf
  Content-Disposition: attachment; filename="Koundinya_Pidaparthy_Resume.pdf"
   │
   ▼
Browser downloads PDF file
```

---

## Flow 7 — Theme Toggle

```
Admin clicks Light/Dark toggle (top-right of admin page header)
   │
   ▼
useAdminTheme().toggle()
   │
   ▼
AdminThemeProvider toggles "dark" class on document.documentElement
Saves "admin-theme" preference to localStorage
   │
   ▼
All Tailwind dark: variants update across admin UI
```

Note: Admin theme is independent of the portfolio's `next-themes` system-preference based theming.

---

## Error States

| Scenario | Behaviour |
|----------|-----------|
| Visitor API fails | Red error banner |
| Resume save fails on Vercel | Console warning; UI shows no confirmation |
| AI not configured | 503, browser alert shown |
| Wrong password | 401, red toast for 5s |
| Jobs API not configured | 503, empty list |
| PDF render error | 500, browser alert |
| Google Sheets error | 500, error state in Companies tab |
| Bulk generate partial failure | Error count shown in completion summary |
