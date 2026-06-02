# Deployment Guide

Complete deployment procedures for local development, staging, and production (Vercel).

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 18.17 | Runtime |
| npm | >= 9 | Package manager |
| Git | any | Source control |
| Vercel CLI (optional) | latest | Manual deploys |

---

## Local Development

### 1. Clone and Install

```bash
git clone https://github.com/koundinyapidaparthy2/koundinya-portfolio.git
cd koundinya-portfolio
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Minimum required for the app to start:

```env
# Auth (required)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<any-32-char-random-string>

# Admin credentials (required)
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=yourpassword
```

Optional (for full features):

```env
# Email notifications
EMAIL_USER=your@gmail.com
EMAIL_PASSWORD=<gmail-app-password>

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=<gmail-app-password>

# AI tailoring
ANTHROPIC_API_KEY=sk-ant-...

# Google Sheets (Companies tab jobs)
GOOGLE_SHEET_ID=<sheet-id>
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Google Cloud Storage (PDF storage)
GCS_BUCKET_NAME=<bucket-name>
GCS_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GCS_PROJECT_ID=jobseek-459701

# Internal API key (for automation pipelines)
INTERNAL_API_KEY=<any-secret-string>
```

### 3. Start Dev Server

```bash
npm run dev
# → http://localhost:3000
```

### 4. Access Admin Dashboard

```
http://localhost:3000/login
  Email: <ADMIN_EMAIL value>
  Password: <ADMIN_PASSWORD value>
  → redirects to http://localhost:3000/admin
```

---

## Production Deployment on Vercel

### First-time Setup

#### Step 1: Import Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import from GitHub: `koundinyapidaparthy2/koundinya-portfolio`
3. Framework preset: **Next.js** (auto-detected)
4. Root directory: `/` (default)
5. Build command: `npm run build` (default)
6. Output directory: `.next` (default)

#### Step 2: Set Environment Variables

In Vercel Dashboard → Project → Settings → Environment Variables, add all of these with **Production** scope:

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXTAUTH_URL` | Yes | Set to your exact domain: `https://koundinyapidaparthy.com` |
| `NEXTAUTH_SECRET` | Yes | Use `openssl rand -base64 32` |
| `ADMIN_EMAIL` | Yes | Your admin email |
| `ADMIN_PASSWORD` | Yes | Initial plaintext password |
| `EMAIL_USER` | Recommended | Gmail address |
| `EMAIL_PASSWORD` | Recommended | Gmail App Password |
| `SMTP_HOST` | Recommended | `smtp.gmail.com` |
| `SMTP_PORT` | Recommended | `587` |
| `SMTP_USER` | Recommended | Same as EMAIL_USER |
| `SMTP_PASS` | Recommended | Same as EMAIL_PASSWORD |
| `ANTHROPIC_API_KEY` | Optional | For AI tailoring |
| `GOOGLE_SHEET_ID` | Optional | For Companies job board |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Optional | For Google Sheets |
| `GCS_BUCKET_NAME` | Optional | For PDF cloud storage |
| `GCS_SERVICE_ACCOUNT_JSON` | Optional | For GCS uploads |
| `GCS_PROJECT_ID` | Optional | GCP project ID |
| `INTERNAL_API_KEY` | Optional | For automation pipeline |

#### Step 3: Deploy

```bash
# Option A: Push to main branch (automatic)
git push origin main

# Option B: Manual deploy via CLI
npx vercel --prod
```

#### Step 4: Set Custom Domain

1. Vercel Dashboard → Project → Settings → Domains
2. Add `koundinyapidaparthy.com`
3. Update DNS records at your registrar:
   - `A` record: `76.76.21.21`
   - `CNAME` for `www`: `cname.vercel-dns.com`

---

## Deployment Pipeline (CI/CD)

### Automatic Deploys

```
Developer pushes to GitHub
   │
   ▼
GitHub webhook triggers Vercel build
   │
   ▼
Vercel runs:
  1. npm install
  2. npm run build
     - Type check (tsc)
     - ESLint (next lint)
     - Next.js build (route compilation, static generation)
   │
   ├─ Build fails → deployment aborted, GitHub commit marked failed
   │
   └─ Build passes → new deployment promoted
                          │
                          ▼
                     Production URL updated (zero-downtime swap)
```

### Preview Deployments

Every Pull Request gets a unique preview URL:
```
https://koundinya-portfolio-<hash>-koundinyapidaparthy2.vercel.app
```

Preview URLs have the same env vars as production (set in Vercel "Preview" scope).

---

## Build Configuration

### `next.config.ts`

Key settings:
- `typescript.ignoreBuildErrors: false` — TypeScript errors fail the build
- `eslint.ignoreDuringBuilds: false` — ESLint errors fail the build
- Image optimization: Vercel's built-in

### `vercel.json` (if present)

Controls function timeout. For AI endpoints (60s needed):

```json
{
  "functions": {
    "app/api/resume/tailor/route.ts": { "maxDuration": 60 },
    "app/api/internal/generate-and-store/route.ts": { "maxDuration": 60 }
  }
}
```

### Vercel Plan Requirements

| Feature | Hobby | Pro |
|---------|-------|-----|
| Serverless function timeout | 10s | 60s |
| AI tailoring (Claude) | May timeout | Works reliably |
| Bulk PDF generation | Likely timeout | Works |
| Bandwidth | 100 GB/mo | 1 TB/mo |

**Recommendation**: Use **Vercel Pro** if you plan to use AI tailoring regularly.

---

## Read-Only Filesystem Warning

Vercel's production environment has a **read-only filesystem**. This affects:

| Feature | Local Dev | Production |
|---------|-----------|------------|
| `data/visitors.json` writes | Works | FAILS silently (console warning) |
| `data/admin.json` password changes | Works | FAILS silently |
| `data/resume.ts` edits via admin | Works | FAILS silently |

### Mitigation

To make the portfolio fully functional on Vercel, migrate to:

1. **Vercel KV** (Redis) for visitor data and sessions
2. **Vercel Postgres** or **Supabase** for resume and admin data
3. **Vercel Blob** for PDF storage (instead of GCS)

These changes require updates to `lib/visitorStore.ts`, `lib/resumeStore.ts`, and `lib/auth.ts`.

---

## Manual Rollback

```bash
# Via Vercel Dashboard:
#   Deployments → find previous deployment → "..." → Promote to Production

# Via CLI:
npx vercel ls                        # list recent deployments
npx vercel promote <deployment-url>  # promote a specific deployment
```

---

## Post-Deployment Verification

After deploying, check these endpoints:

```bash
# 1. Portfolio loads
curl -I https://koundinyapidaparthy.com
# → 200 OK

# 2. Resume API (public)
curl https://koundinyapidaparthy.com/api/resume
# → JSON resume data

# 3. Tracking API (should accept POST)
curl -X POST https://koundinyapidaparthy.com/api/track \
  -H "Content-Type: application/json" \
  -d '{"page":"/","referrer":"","language":"en-US","screen":"1440x900","timezone":"UTC"}'
# → { "ok": true }

# 4. Contact form (optional — sends real email)
# Test via the contact form on the live site

# 5. Login flow
# Manually visit /login and verify credentials work
```

---

## Environment Variable Validation Checklist

Before going live, verify each critical var:

- [ ] `NEXTAUTH_URL` matches exact production URL (no trailing slash)
- [ ] `NEXTAUTH_SECRET` is at least 32 characters
- [ ] `ADMIN_EMAIL` is the correct email you'll log in with
- [ ] `ADMIN_PASSWORD` is known (write it down securely)
- [ ] Gmail App Password is the 16-char generated password (not your Gmail account password)
- [ ] `ANTHROPIC_API_KEY` starts with `sk-ant-`
- [ ] `GOOGLE_SERVICE_ACCOUNT_JSON` is valid JSON (not stringified twice)
- [ ] `GCS_BUCKET_NAME` bucket exists in GCP project

---

## Monitoring and Logs

### Vercel Function Logs

```
Vercel Dashboard → Project → Logs
```

Filter by function name or error level. All `console.error()` calls appear here with the prefix in brackets, e.g.:
- `[GET /api/resume]`
- `[api/track]`
- `[generate-and-store] Claude error:`

### Vercel Analytics (Optional)

Enable in Vercel Dashboard → Analytics tab. Tracks Web Vitals (LCP, CLS, INP) automatically.

---

## Common Deployment Failures

| Error | Cause | Fix |
|-------|-------|-----|
| `Type error: ...` | TypeScript error in code | Fix the type error before pushing |
| `Module not found` | Missing import or wrong path | Check import paths use `@/` alias |
| `Build failed: Exit code 1` | ESLint error | Run `npm run lint` locally first |
| Login fails on prod | `NEXTAUTH_URL` wrong | Must match exact domain with https |
| AI returns 503 | `ANTHROPIC_API_KEY` not set | Add to Vercel env vars |
| No emails received | Gmail App Password wrong | Regenerate App Password |
