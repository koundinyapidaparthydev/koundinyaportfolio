# Architecture

## Rendering Strategy

This app uses the **Next.js 14 App Router** with a mix of rendering strategies:

| Route / Component | Strategy | Reason |
|---|---|---|
| `app/page.tsx` (portfolio) | **Server Component** (static) | SEO-critical; data comes from a static `resumeData` export |
| `app/admin/page.tsx` | **Server Component** + client islands | Auth check on server; editing UI is a Client Component |
| `app/api/**` | **Route Handlers** | Server-only: auth, email, file I/O, Anthropic API |
| `components/sections/*` | **Client Components** | Need Framer Motion animations, Zustand selectors |
| `app/layout.tsx` | **Server Component** shell | Renders Providers (client boundary) + footer |

---

## Data Flow

```
Static Data (data/resume.ts)
    │
    ├──► Server Components (page.tsx, admin page)
    │
    └──► Zustand Store (lib/store.ts)  ←── StoreHydrator seeds it on mount
              │
              ├──► Section components via selector hooks (useResume, useSkills…)
              │
              └──► Admin Editor (updates store → PATCH /api/resume)
```

---

## State Management

Zustand is used with three middleware layers stacked:

```
useStore = create(
  devtools(         // Redux DevTools integration
    persist(        // localStorage persistence (auth state only)
      immer(…)      // Immer for immutable draft mutations
    )
  )
)
```

The store is split into two **slices**:

### Auth Slice (`lib/store.ts`)
- `isAdmin`, `user`, `isLoading`
- Actions: `login()`, `logout()`, `setUser()`
- Persisted to `localStorage` key `kp-portfolio-store`

### Resume Slice (`lib/store.ts`)
- `resume` (full Resume object), `isEditing`, `isDirty`
- Actions: `updatePersonalInfo`, `updateExperience`, `updateEducation`, `updateSkills`, `updateProjects`, `resetToSaved`
- **Not persisted** — always seeded from `data/resume.ts` at hydration

A **separate** `useResumeHistoryStore` provides undo/redo (up to 20 snapshots) without any persistence.

---

## Authentication Flow

```
User hits /admin/*
    │
    ▼
middleware.ts  (withAuth from next-auth)
    │  token.role !== "admin"?
    │       └──► redirect /
    │  no token?
    │       └──► redirect /login?callbackUrl=/admin
    │
    ▼
/login page → calls NextAuth signIn("credentials")
    │
    ▼
lib/auth.ts → CredentialsProvider.authorize()
    │  checks ADMIN_EMAIL env var
    │  verifies password: PBKDF2 hash (data/admin.json) OR env plaintext
    │       └──► returns { id, name, email, role: "admin" }
    │
    ▼
NextAuth issues JWT → session strategy (24h maxAge)
    │
    ▼
JWT callback attaches role → session callback exposes role
    │
    ▼
Server Route Handlers call requireAdminSession() to gate mutations
```

---

## API Routes Map

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/api/auth/[...nextauth]` | GET/POST | — | NextAuth handler |
| `/api/contact` | POST | — | Sends contact-form email via Nodemailer |
| `/api/track` | POST | — | Records visitor & sends owner email alert |
| `/api/visitors` | GET | Admin | Returns full visitor log |
| `/api/resume` | GET/PATCH | PATCH→Admin | Read/update resume JSON |
| `/api/resume/pdf` | POST | — | Generates & streams PDF |
| `/api/resume/tailor` | POST | — | AI resume tailoring via Anthropic |
| `/api/jobs` | GET | — | Job listings (external or static) |
| `/api/internal` | Various | Admin | Internal admin utilities |

---

## File I/O vs Database

This project intentionally uses **file-based storage** instead of a database:

| Data | File | Notes |
|------|------|-------|
| Resume content | `data/resume.ts` (source of truth) | Exported as typed TS constant |
| Resume overrides | `data/resume.json` (runtime) | PATCH /api/resume writes here |
| Visitor log | `data/visitors.json` | Atomic write (tmp→rename), capped at 500 entries |
| Admin credentials | `data/admin.json` | Stores PBKDF2 hash of password |

> **Note**: On Vercel's read-only filesystem, writes to `visitors.json` are silently skipped with a console warning. The site continues to function normally.

---

## Visitor Tracking Pipeline

```
Browser loads page
    │
    ▼
TrackerInit (client component, mounts once)
    │  POST /api/track  { page, referrer, screen, timezone, language }
    │
    ▼
/api/track route handler
    │  Extracts IP from X-Forwarded-For / CF-Connecting-IP
    │  Detects browser, OS, device from User-Agent
    │  Reads geo from Vercel/Cloudflare headers
    │
    ├──► appendVisitor() → data/visitors.json
    │
    └──► sendVisitorNotification() → Gmail → owner's inbox
```

---

## PDF Generation

The `/api/resume/pdf` route:
1. Accepts the current `Resume` object as POST body
2. Uses `@react-pdf/renderer` (`lib/resumePdf.tsx`) to render a React tree to PDF
3. Streams the resulting PDF buffer back with `Content-Type: application/pdf`

---

## AI Resume Tailoring

The `/api/resume/tailor` route:
1. Accepts `{ jobDescription, resume }` in POST body
2. Calls **Anthropic Claude** SDK (`@anthropic-ai/sdk`)
3. Instructs Claude to rewrite experience bullets to match the JD
4. Returns the modified resume JSON
5. Admin can then save or discard the AI-tailored version
