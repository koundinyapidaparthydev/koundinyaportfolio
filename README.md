# Koundinya Pidaparthy — Portfolio

[![CI](https://github.com/koundinyapidaparthy2/koundinyaportfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/koundinyapidaparthy2/koundinyaportfolio/actions/workflows/ci.yml)
[![Deploy on Vercel](https://img.shields.io/badge/deploy-vercel-black?logo=vercel)](https://vercel.com/new/clone?repository-url=https://github.com/koundinyapidaparthy2/koundinyaportfolio)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A full-stack, production-ready developer portfolio built with **Next.js 14 App Router**, TypeScript, Tailwind CSS, and Framer Motion. Features a secure admin dashboard, PDF résumé generation, contact form, dark/light mode, CI/CD pipeline, and 99%+ test coverage.

---

## Features

| # | Feature |
|---|---------|
| 1 | **Next.js 14 App Router** — file-based routing, layouts, server components |
| 2 | **TypeScript strict mode** — zero `any` escapes, full type safety |
| 3 | **Tailwind CSS** — utility-first styling with dark mode support |
| 4 | **Framer Motion** — scroll animations, page transitions, staggered lists |
| 5 | **Admin Dashboard** — protected `/admin` route with NextAuth.js credentials |
| 6 | **PDF Résumé** — `@react-pdf/renderer` generates résumé on-demand via `/api/resume/pdf` |
| 7 | **Contact Form** — server-side Nodemailer with Zod validation and rate limiting |
| 8 | **Drag-and-Drop Editor** — `@dnd-kit` reorder résumé sections inside admin |
| 9 | **React Query + Zustand** — server-state caching + lightweight client state |
| 10 | **139 Jest/RTL unit tests** — 99.68% statement coverage, 85%+ line threshold |
| 11 | **Cypress 13 E2E tests** — 5 spec files covering critical user flows |
| 12 | **Open Graph meta tags** — dynamic `opengraph-image.tsx` via Edge runtime |
| 13 | **robots.ts + sitemap.ts** — auto-generated for SEO |
| 14 | **CI/CD + Vercel deploy** — GitHub Actions pipeline, security headers, immutable asset cache |

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 14.2 (App Router) |
| Language | TypeScript 5.9 (strict) |
| Styling | Tailwind CSS 3 + class-variance-authority |
| Animations | Framer Motion 12 |
| Auth | NextAuth.js (credentials provider) |
| PDF | @react-pdf/renderer 4 |
| Email | Nodemailer + Zod |
| Drag & Drop | @dnd-kit/core + sortable |
| State | Zustand + TanStack React Query 5 |
| UI Primitives | @base-ui/react |
| Forms | react-hook-form + @hookform/resolvers |
| Unit Tests | Jest 30 + React Testing Library |
| E2E Tests | Cypress 13 |
| CI/CD | GitHub Actions |
| Deployment | Vercel |
| Theme | next-themes |

---

## Architecture

```
koundinya-portfolio/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (ThemeProvider, Navbar, Footer)
│   ├── page.tsx                # Home page (SSR)
│   ├── not-found.tsx           # Custom 404
│   ├── loading.tsx             # Root skeleton
│   ├── error.tsx               # Root error boundary
│   ├── robots.ts               # SEO robots
│   ├── sitemap.ts              # SEO sitemap
│   ├── opengraph-image.tsx     # Dynamic OG image (Edge)
│   ├── admin/                  # Protected admin dashboard
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── loading.tsx
│   │   └── error.tsx
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth handler
│       ├── contact/            # POST /api/contact (Nodemailer)
│       └── resume/pdf/         # GET /api/resume/pdf
├── components/                 # Shared UI components
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── ThemeToggle.tsx
│   └── sections/               # Home page sections
├── lib/                        # Server utilities
│   ├── auth.ts
│   ├── email.ts
│   ├── pdf.ts
│   └── validations.ts
├── store/                      # Zustand stores
├── __tests__/                  # Jest unit tests (139 tests)
├── cypress/                    # Cypress E2E (5 spec files)
├── .github/workflows/ci.yml    # CI pipeline
├── vercel.json                 # Vercel config + security headers
└── .env.local.example          # Environment variable template
```

---

## Local Setup

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Clone & install

```bash
git clone https://github.com/koundinya/koundinya-portfolio.git
cd koundinya-portfolio
npm ci
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your values (see [Environment Variables](#environment-variables) below).

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXTAUTH_URL` | ✅ | Full URL of your deployment (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | ✅ | Random secret — run `openssl rand -base64 32` |
| `ADMIN_EMAIL` | ✅ | Email address for admin login |
| `ADMIN_PASSWORD` | ✅ | Password for admin login |
| `SMTP_HOST` | ✅ | SMTP server host (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | ✅ | SMTP port (587 for TLS) |
| `SMTP_USER` | ✅ | SMTP username / email |
| `SMTP_PASS` | ✅ | SMTP password or app password |
| `SMTP_FROM` | ✅ | Sender display name + email |
| `NEXT_PUBLIC_GA_ID` | ❌ | Google Analytics measurement ID |
| `NEXT_PUBLIC_SITE_URL` | ❌ | Canonical site URL for OG tags |

---

## Running Tests

### Unit tests (Jest + React Testing Library)

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report (must meet 80% branch / 85% line thresholds)
npm run test:coverage
```

### E2E tests (Cypress)

```bash
# Interactive mode
npm run cypress:open

# Headless (CI)
npm run cypress:run
```

---

## Deployment

### Vercel (recommended)

1. Push your repo to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Add all environment variables from `.env.local.example` in the Vercel dashboard.
4. Deploy — Vercel auto-detects Next.js and runs `npm run build`.

The included `vercel.json` sets:
- Security headers (CSP, X-Frame-Options, HSTS)
- Immutable cache for `/_next/static`
- No-store cache for `/api`
- Redirect `/resume` → `/api/resume/pdf`

### Manual (self-hosted)

```bash
npm run build
npm start
```

### Lighthouse CI

```bash
npx lhci autorun
```

Thresholds (`.lighthouserc.js`): Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90, SEO ≥ 90.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run Jest unit tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:watch` | Run tests in watch mode |
| `npm run cypress:open` | Open Cypress test runner |
| `npm run cypress:run` | Run Cypress headlessly |
| `npm run lint` | ESLint check |

---

## License

MIT © Koundinya Pidaparthy
