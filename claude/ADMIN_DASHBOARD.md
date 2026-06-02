# Admin Dashboard

Full documentation of the admin dashboard — accessible only to authenticated admins at `/admin`.

---

## Access Control

- **URL**: `/admin`
- **Login**: `/login`
- **Protection**: `middleware.ts` intercepts all `/admin/*` requests and checks NextAuth session with `role === "admin"`. Unauthenticated visitors are redirected to `/login?callbackUrl=/admin`.

---

## Layout

```
┌─────────────────────────────────────────────────────────┐
│  Admin Dashboard                    [admin@email.com]   │
│                                      [Light/Dark toggle]│
├──────────────┬──────────────────────────────────────────┤
│ Sidebar      │                                          │
│              │  Tab Content Area                        │
│ > Overview   │                                          │
│   Edit Resume│                                          │
│   Visitors   │                                          │
│   Settings   │                                          │
│   Companies  │                                          │
│              │                                          │
│ [Preview ↗]  │                                          │
└──────────────┴──────────────────────────────────────────┘
```

- **Desktop**: Fixed left sidebar (224px) + flexible content area
- **Mobile**: Horizontal scrollable tab strip above content

All 5 tab components are loaded via `next/dynamic` (lazy, code-split) with a spinner while loading.

---

## Tab 1: Overview

**Component**: `app/admin/_components/OverviewTab.tsx`  
**Data**: `GET /api/visitors` (staleTime: 30s, TanStack Query)

### Stat Cards (2×3 grid)

| Card | What It Shows |
|------|--------------|
| Total Visitors | Total all-time count (indigo accent) |
| Today's Visitors | Today's count + delta vs yesterday |
| Unique IPs | Distinct IP count |
| Top Browser | Most-used browser name |
| Last Visit | Formatted timestamp of most recent visit |
| 30-Day Avg/Day | `count30Days / 30` formatted to 1 decimal |

### Charts and Breakdowns

- **7-Day Traffic Bar Chart**: CSS bar chart (no external charting lib), relative heights
- **By Device**: Desktop / Mobile / Tablet stacked bar + legend
- **By Browser**: Top 5 browsers stacked bar (orange, red, blue, green, pink)
- **By OS**: Top 5 OSes stacked bar (cyan, emerald, fuchsia, amber, rose)
- **Top Pages**: Horizontal bar list, top 8 pages
- **Top Referrers**: Horizontal bar list, top 6 referrers (domain-parsed)
- **Geographic Distribution**: Pill badges for top 5 countries
- **Recent Activity Table**: Last 10 entries with all fields

---

## Tab 2: Edit Resume

**Component**: `app/admin/_components/EditResumeTab.tsx`  
**Size**: ~1,400 lines

### Features

| Feature | Implementation |
|---------|---------------|
| Debounced auto-save | 500ms `useWatch` + `useUpdateResume()` + `PUT /api/resume` |
| Saved indicator | "Saved ✓" shown for 2 seconds on successful API call |
| Undo / Redo | Zustand `useResumeHistoryStore`, max 20 entries, `Cmd+Z` / `Cmd+Shift+Z` |
| Drag to reorder | `@dnd-kit/sortable` on Experience and Projects sections |
| Live preview | 50/50 split with `ResumePreview` component |
| Export JSON | `resume_backup.json` download via Blob URL |
| Form validation | Zod schema + react-hook-form resolver |

### Collapsible Sections

Each section has a chevron toggle to expand/collapse:
1. **Personal Info** — name, title, email, phone, location, LinkedIn, GitHub, portfolio, summary
2. **Experience** — per entry: company, role, location, dates, bullet points, technologies, other roles
3. **Projects** — per entry: name, dates, description, GitHub, website URL, tech stack, bullet points
4. **Skills** — per category: title + skills list
5. **Education** — per entry: institution, degree, field, GPA, graduation date, achievements

### String Array Editor

Arrays (bullet points, technologies, skills) use `StringArrayEditor`:
- "+ Add" button appends `{ value: "" }` to the array
- Each item has a remove "✕" button
- Uses `useFieldArray` internally

### DnD Reordering

Experience and Project sections use `@dnd-kit`:
- `PointerSensor` with 8px activation distance
- `KeyboardSensor` for accessibility
- `SortableContext` with `verticalListSortingStrategy`
- Drag handle appears as a 6-dot grip icon
- Dragged item has 45% opacity

---

## Tab 3: Visitors

**Component**: `app/admin/_components/VisitorsTab.tsx`  
**Data**: `GET /api/visitors` (shared TanStack Query cache with Overview tab)

### Features

- **Pagination**: 25 rows per page, Previous/Next buttons
- **Search**: Client-side filter by IP, page, country, or browser
- **Export CSV**: Downloads currently-filtered visitors as `.csv`
- **Refresh**: Manual re-fetch button

### Table Columns

| Column | Notes |
|--------|-------|
| Timestamp | Formatted `short` date + `short` time |
| IP | Monospace |
| Device | Colored badge: Desktop (indigo) / Mobile (violet) / Tablet (sky) |
| Browser | First word of browser string (e.g., "Chrome") |
| OS | First word of OS string (e.g., "macOS") |
| Country | Raw country string |
| Page | Monospace path |
| Referrer | Domain-parsed, "direct" shown in italic |
| UA | Truncated, max 140px |

---

## Tab 4: Settings

**Component**: `app/admin/_components/SettingsTab.tsx`

### Change Password Form

Fields:
1. Current password
2. New password (min 8 chars)
3. Confirm new password (must match)

Validation: Zod schema with cross-field refinement.

**API call**: `PATCH /api/auth/password`

**Toast** (auto-dismisses after 5s):
- Green: "Password changed successfully."
- Red: Server error message or "Network error"

### Account Info Card

Shows:
- Email: displays `NEXT_PUBLIC_ADMIN_EMAIL_HINT` env var (or "configured via env")
- Role: `admin` badge (indigo)

---

## Tab 5: Companies

**Component**: `app/admin/_components/CompaniesTab.tsx`  
**Size**: ~1,550 lines — largest component in the project

See [COMPANIES_TAB.md](./COMPANIES_TAB.md) for complete documentation.

### Quick Summary

- 4 category tabs: Travel Ticketing | AI & Agentic | General Full Stack | Hiring Cafe
- 70+ curated company cards with logos, career page links, job counts
- Jobs pulled from Google Sheets via `GET /api/jobs`
- ATS scoring on every job card using current resume
- Per-job: tailored resume PDF + cover letter PDF download (Claude AI)
- Bulk generate: auto-download PDFs for all ATS >= 70% jobs
- Archive: move old jobs to "Old Jobs" Google Sheet tab
- Filters: time window, location type, sort order, free text search

---

## Admin Theme

**Component**: `app/admin/_components/AdminThemeProvider.tsx`  
**Storage**: `localStorage["admin-theme"]`

The admin dashboard has its own independent theme toggle (separate from the public portfolio's `next-themes`). A `ThemeToggleButton` in the page header shows "Light" or "Dark" with matching icon.

**Implementation**:
```ts
// Toggle dark class on documentElement
document.documentElement.classList.toggle("dark");
localStorage.setItem("admin-theme", newTheme);
```

On mount, it reads `localStorage["admin-theme"]` and applies the saved preference.

---

## Security Summary

| Layer | Implementation |
|-------|---------------|
| Route protection | `middleware.ts` intercepts all `/admin*` routes |
| API protection | `requireAdminSession()` in every admin API handler |
| Password hashing | PBKDF2 SHA-256, 100,000 iterations |
| Session token | NextAuth JWT (HTTP-only cookie) |
| CSRF | NextAuth's built-in CSRF protection |
| Internal API | `x-internal-key` header auth for `/api/internal/*` |

---

## Performance

- All 5 tabs are **lazy-loaded** with `next/dynamic` — only the current tab's JS is fetched
- Visitor data is fetched once and **shared** via TanStack Query between Overview and Visitors tabs
- Company ATS scores are computed **client-side** (no network call) on every job list render
- The admin dashboard is a pure **Client Component** (`"use client"`) — no server-rendered admin HTML
