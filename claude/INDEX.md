# Documentation Index

AI-generated documentation for the **Koundinya Pidaparthy Portfolio** — a Next.js 14 App Router application.

---

## Core Documents

| File | What It Covers |
|------|---------------|
| [OVERVIEW.md](./OVERVIEW.md) | App goals, tech stack, project structure |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Rendering strategy, auth flow, API map, file storage |
| [COMPONENTS.md](./COMPONENTS.md) | All React components — sections, utilities, UI |
| [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) | Zustand slices, selector hooks, undo/redo |
| [DATA_MODELS.md](./DATA_MODELS.md) | TypeScript interfaces — Resume, Experience, Project, VisitorEntry |
| [HOOKS.md](./HOOKS.md) | Custom hooks — typewriter, scroll reveal, aurora |
| [DEPENDENCIES.md](./DEPENDENCIES.md) | Every npm package and why it was chosen |

---

## API & Backend

| File | What It Covers |
|------|---------------|
| [API_ROUTES.md](./API_ROUTES.md) | Every endpoint with request/response shapes (UPDATED) |
| [AUTHENTICATION.md](./AUTHENTICATION.md) | NextAuth, PBKDF2 hashing, JWT flow, middleware |
| [VISITOR_TRACKING.md](./VISITOR_TRACKING.md) | Tracking pipeline, IP/UA parsing, email alerts |
| [RESUME_PDF.md](./RESUME_PDF.md) | PDF generation with `@react-pdf/renderer` |
| [ATS_SCORING.md](./ATS_SCORING.md) | ATS keyword algorithm, scoring logic, limitations |
| [AI_FEATURES.md](./AI_FEATURES.md) | Anthropic Claude integration, tailoring prompt |
| [INTERNAL_PIPELINE_API.md](./INTERNAL_PIPELINE_API.md) | Server-to-server AI pipeline (NEW) |
| [GOOGLE_SHEETS.md](./GOOGLE_SHEETS.md) | Google Sheets integration for job board (NEW) |

---

## Admin Dashboard

| File | What It Covers |
|------|---------------|
| [ADMIN_DASHBOARD.md](./ADMIN_DASHBOARD.md) | All 5 tabs overview, layout, security (UPDATED) |
| [ADMIN_FLOWS.md](./ADMIN_FLOWS.md) | Step-by-step flows for every admin action (NEW) |
| [COMPANIES_TAB.md](./COMPANIES_TAB.md) | Job board tab — ATS, bulk gen, archive (NEW) |

---

## User Flows & Experience

| File | What It Covers |
|------|---------------|
| [VISITOR_FLOWS.md](./VISITOR_FLOWS.md) | Every visitor interaction — scroll, contact, tracking (NEW) |
| [ANIMATIONS.md](./ANIMATIONS.md) | Framer Motion, magnetic cursor, aurora, tilt cards |
| [SEO.md](./SEO.md) | Metadata API, OG image, robots, sitemap, Lighthouse |

---

## Infrastructure & Operations

| File | What It Covers |
|------|---------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel deploy, env setup, CI/CD, post-deploy check (UPDATED) |
| [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) | All env vars with descriptions |
| [TESTING.md](./TESTING.md) | Jest + Cypress setup, coverage targets |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common errors and fixes |

---

## Content & Development

| File | What It Covers |
|------|---------------|
| [PORTFOLIO_CONTENT.md](./PORTFOLIO_CONTENT.md) | Full content catalogue — all experience, projects, skills |
| [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | How to add sections, API routes, update content |

---

## Quick Reference

### Start Dev Server
```bash
npm run dev   # → http://localhost:3000
```

### Admin Access
```
URL:   http://localhost:3000/login
Login: ADMIN_EMAIL + ADMIN_PASSWORD from .env.local
→     http://localhost:3000/admin
```

### Key Files

| File | When to edit |
|------|-------------|
| `data/resume.ts` | Any portfolio content changes |
| `app/page.tsx` | Adding/removing portfolio sections |
| `app/layout.tsx` | Global layout, providers |
| `lib/store.ts` | Adding state slices |
| `types/resume.ts` | Changing data shape |
| `middleware.ts` | Route protection rules |
| `app/admin/_components/CompaniesTab.tsx` | Adding companies to job board |

### Run Tests
```bash
npm test                  # Jest unit tests
npm run cypress:open      # Cypress e2e
npx tsc --noEmit          # TypeScript check
npm run lint              # ESLint
```

### Admin Tab Map

| Tab | ID | Main Purpose |
|-----|----|-------------|
| Overview | `overview` | Visitor analytics charts |
| Edit Resume | `edit-resume` | Live resume editor + PDF download |
| Visitors | `visitors` | Raw visitor log + CSV export |
| Settings | `settings` | Change admin password |
| Companies | `companies` | Job board + AI resume generation |

---

## Document Count

**Total**: 28 documentation files covering every aspect of the application.
