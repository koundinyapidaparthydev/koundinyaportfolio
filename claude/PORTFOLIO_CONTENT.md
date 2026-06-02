# Portfolio Content

Full content catalogue of what is shown on the live portfolio.

---

## Personal Info

| Field | Value |
|-------|-------|
| Name | Koundinya Pidaparthy |
| Title | Full Stack Software Engineer |
| Email | koundinyapidaparthy@gmail.com |
| Phone | 551-229-8660 |
| Location | New York, NY |
| LinkedIn | linkedin.com/in/koundinyap |
| GitHub | github.com/koundinyapidaparthy2 |
| Portfolio | koundinyapidaparthy.com |

**Summary**:
> Full Stack Software Engineer with 3+ years of experience building scalable web applications. Proficient in React, Next.js, Node.js, TypeScript, and cloud platforms (AWS, GCP). Passionate about crafting performant, user-first products and integrating AI-powered features.

---

## Education

### Pace University — M.S. Computer Science
- **Location**: New York, NY
- **Graduated**: May 2025
- **GPA**: 3.95
- **Achievements**:
  - Dean's List — every semester
  - Graduate Teaching Assistant — Data Structures & Algorithms

### Jawaharlal Nehru Technological University — B.Tech Computer Science & Engineering
- **Location**: Hyderabad, India
- **Graduated**: May 2021

---

## Work Experience

### Anchor Operating System — Software Engineer
**June 2025 – Present | New York, NY (Remote)**

**Tech**: Next.js 14, TypeScript, React Server Components, WebSockets, Redis, GraphQL, Apollo, AWS CDK, ECS Fargate, GitHub Actions

- Architected core modules of an AI-first OS layer using Next.js 14 App Router, reducing TTI by 38%
- Designed real-time collaboration engine using WebSockets + Redis pub/sub, sub-100ms latency
- Built plugin/extension marketplace with Module Federation
- Established CI/CD pipelines with GitHub Actions + AWS CDK (zero-downtime blue/green)
- Led monolithic REST → GraphQL federation migration (45% query performance improvement)
- Mentored 2 junior engineers (30% faster onboarding)

---

### Anchor Operating System — Software Engineer Intern
**May 2024 – Sep 2024 | New York, NY (Remote)**

**Tech**: React, Zustand, Tailwind CSS, NextAuth.js, Node.js, Express, MongoDB Atlas, Jest, Framer Motion

- Built core dashboard UI with React, Zustand, Tailwind CSS
- Implemented OAuth 2.0 with NextAuth.js (Google + GitHub), 22% conversion improvement
- Developed RESTful API endpoints for user preferences module
- Achieved 82% test coverage on critical user-flow components
- Translated Figma prototypes into WCAG 2.1 AA accessible components

---

### Hornblower Group — Software Developer
**Aug 2022 – Jul 2023 | New York, NY**

**Tech**: React, Redux, GraphQL, Node.js, TypeScript, MongoDB, DynamoDB, Stripe, LaunchDarkly, AWS Lambda

- Built ticketing & event management features serving 2M+ annual users
- Reduced average API response time from 850ms to 210ms
- Integrated Stripe with idempotent transaction handling ($5M+/month, 99.98% success)
- Developed seat-selection microservice in Node.js/TypeScript with DynamoDB Streams
- Feature flags with LaunchDarkly (60% reduction in production incidents)
- On-call rotation with average MTTR < 25 minutes

---

### Syscloud Technologies — Frontend Software Engineer Intern
**June 2021 – June 2022 | Hyderabad, India**

**Tech**: React, Material UI, Storybook, React Query, Google Workspace APIs, JavaScript, CSS3, Webpack

- Built responsive SaaS dashboard for Google Workspace backup products (18% task completion improvement)
- Built reusable component library with Storybook (35% less duplicate code, 4 teams)
- Integrated Google Drive & Gmail APIs with real-time polling via React Query
- Reduced bundle size from 1.8MB to 620KB, Lighthouse score from 54 to 89

---

## Skills

### Languages
JavaScript (ES2022+), TypeScript, Python, Java, HTML5, CSS3, SQL, GraphQL

### Frontend
React, Next.js, React Native, Redux, Zustand, Framer Motion, Tailwind CSS, Material UI, shadcn/ui, Storybook, Webpack, Vite

### Backend
Node.js, Express.js, GraphQL (Apollo Server), REST APIs, WebSockets, NextAuth.js, Prisma, Redis

### Databases
MongoDB, PostgreSQL, DynamoDB, MySQL, Firebase Firestore, BigTable, Redis

### Cloud & DevOps
AWS (EC2, Lambda, S3, DynamoDB, CDK, API Gateway, ECS, IAM), GCP (GCS, BigTable, Cloud Build, Cloud Run), GitHub Actions, Docker, Terraform, Vercel, Netlify, CI/CD Pipelines

### Testing
Jest, React Testing Library, Cypress, Vitest, Playwright

### Tools & Practices
Git / GitHub, Jira, Figma, Postman, LaunchDarkly, Stripe, Agile / Scrum, Code Review, System Design

---

## Projects

### AplifyAI
**Jan 2025 – May 2025**  
[aplifyai.com](https://aplifyai.com) | [GitHub](https://github.com/koundinyapidaparthy2/aplifyai)

**Stack**: Next.js 14, TypeScript, OpenAI GPT-4, LangChain, Pinecone, Supabase, Tailwind CSS, Stripe

> AI-powered job application platform that auto-tailors resumes and cover letters to specific job descriptions using RAG and GPT-4.

- RAG pipeline with LangChain + Pinecone (60% relevance improvement)
- GPT-4 integration for ATS-optimised bullets & cover letters (< 8 seconds/request)
- Multi-tenant SaaS on Supabase (Free/Pro/Enterprise tiers via Stripe)
- Real-time PDF editor with live preview using @react-pdf/renderer
- 98 Lighthouse performance score

---

### Harmony AI
**Aug 2024 – Dec 2024**  
[GitHub](https://github.com/koundinyapidaparthy2/harmony-ai)

**Stack**: React, Node.js, Express, OpenAI Whisper, GPT-4, MongoDB, AWS S3, Socket.io

> AI-driven music collaboration platform that transcribes, analyzes, and provides real-time feedback on musical performances.

- Real-time audio transcription with OpenAI Whisper (200ms chunks, sub-second latency)
- LLM-based music feedback engine (tempo, melody, lyrics analysis)
- WebSocket rooms with live collaboration, cursor presence, synchronized playback
- AWS S3 pre-signed URL upload pipeline
- MongoDB aggregation dashboard for practice analytics

---

### AI Exam Prep Platform
**Mar 2024 – Jul 2024**  
[ai-exam-prep.vercel.app](https://ai-exam-prep.vercel.app) | [GitHub](https://github.com/koundinyapidaparthy2/ai-exam-prep)

**Stack**: Next.js, TypeScript, OpenAI GPT-4, Prisma, PostgreSQL, Tailwind CSS, React Query, Vercel

> Adaptive exam preparation platform that generates personalized practice questions, evaluates answers, and tracks mastery using AI.

- Adaptive question generation with GPT-4 + SM-2 spaced-repetition algorithm
- Natural-language answer evaluation with rubric scoring
- Prisma + PostgreSQL schema with efficient indexing
- Performance analytics dashboard with Chart.js
- p95 latency < 1.2 seconds for question generation (Vercel edge functions)
