# Koundinya Pidaparthy — Portfolio Application Overview

## What Is This?

This is a **Next.js 14 App Router** portfolio website for **Koundinya Pidaparthy**, a Full Stack Software Engineer based in New York, NY. The site serves as both a public-facing portfolio and a private admin dashboard for managing resume content.

- **Live URL**: [koundinyapidaparthy.com](https://koundinyapidaparthy.com)
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Deployed on**: Vercel

---

## Goals of the Application

| Goal | How It's Achieved |
|------|------------------|
| Showcase work & skills | Dedicated sections: Hero, About, Skills, Experience, Projects |
| Visitor analytics | `TrackerInit` + `/api/track` + `visitors.json` + email alerts |
| Admin resume editing | Protected `/admin` route with in-browser live editor |
| ATS-scoring tool | Paste a job description → get a match score against the resume |
| PDF resume export | `@react-pdf/renderer` renders the resume as a downloadable PDF |
| AI resume tailoring | Anthropic Claude SDK used on `/api/resume/tailor` to rewrite bullets |
| SEO & discoverability | `metadata` exports, `robots.ts`, `sitemap.ts`, Open Graph, Twitter card |

---

## Tech Stack at a Glance

```
Next.js 14 (App Router)
TypeScript 5
Tailwind CSS v3
Framer Motion
Zustand + Immer (client state)
next-auth v4 (JWT, CredentialsProvider)
Nodemailer + Gmail (email notifications)
@react-pdf/renderer (PDF generation)
Anthropic SDK (AI tailoring)
@google-cloud/storage (GCS uploads)
Jest + React Testing Library (unit tests)
Cypress (e2e tests)
```

---

## Project Structure (Top Level)

```
koundinya-portfolio/
├── app/              # Next.js App Router pages & API routes
│   ├── admin/        # Protected admin dashboard
│   ├── api/          # Server-side API route handlers
│   ├── login/        # Login page
│   ├── layout.tsx    # Root layout (providers, navbar, footer)
│   └── page.tsx      # Main portfolio page
├── components/       # Shared React components
│   ├── sections/     # Portfolio sections (Hero, About, Skills…)
│   └── ui/           # Generic UI primitives (Navbar, buttons…)
├── data/             # Static JSON/TS data (resume, visitors, admin)
├── hooks/            # Custom React hooks
├── lib/              # Server and client utilities
├── types/            # TypeScript type definitions
├── public/           # Static assets
├── __tests__/        # Jest unit tests
├── cypress/          # Cypress e2e tests
└── claude/           # AI-assisted documentation (this folder)
```
