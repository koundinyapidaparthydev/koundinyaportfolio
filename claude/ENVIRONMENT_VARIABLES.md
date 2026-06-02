# Environment Variables

Copy `.env.example` to `.env.local` to get started locally.

---

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXTAUTH_SECRET` | Secret for signing JWT tokens. Generate with `openssl rand -base64 32` | `abc123...` |
| `NEXTAUTH_URL` | Full URL of the app (required in prod) | `https://koundinyapidaparthy.com` |
| `ADMIN_EMAIL` | Email for the single admin account | `koundinyapidaparthy@gmail.com` |
| `ADMIN_PASSWORD` | Plaintext password (fallback before PBKDF2 is set) | `my-secure-password` |

---

## Email Notification Variables

Required to send visitor alerts and contact-form emails:

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_FROM` | Gmail address to send from | `koundinyapidaparthy@gmail.com` |
| `EMAIL_PASSWORD` | Gmail **App Password** (not your account password) | `abcd efgh ijkl mnop` |

> **Gmail App Password**: Go to Google Account → Security → 2-Step Verification → App Passwords. Generate one for "Mail".

If `EMAIL_PASSWORD` is not set, emails are **silently skipped** (useful for local dev).

---

## AI Variables

Required for the AI resume tailoring feature:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key for Claude |

---

## Google Cloud Storage Variables

Required for GCS-backed file upload features:

| Variable | Description |
|----------|-------------|
| `GCS_BUCKET_NAME` | Google Cloud Storage bucket name |
| `GCS_KEY_JSON` | Service account key JSON (stringified) |

---

## Site URL

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_SITE_URL` | Public site URL (used in metadata, sitemap, OG tags) | `https://koundinyapidaparthy.com` |

---

## Local Development Setup

```bash
# 1. Copy the example file
cp .env.example .env.local

# 2. Fill in at minimum:
#    NEXTAUTH_SECRET=<random string>
#    ADMIN_EMAIL=<your email>
#    ADMIN_PASSWORD=<any password>

# 3. Start the dev server
npm run dev
```

For local dev, you can skip `EMAIL_PASSWORD`, `ANTHROPIC_API_KEY`, and GCS variables. The features that depend on them will gracefully no-op.

---

## Vercel Deployment

Add all variables in Vercel Dashboard → Project Settings → Environment Variables.

Set `NEXTAUTH_URL` to your production domain. Do **not** prefix it with `NEXT_PUBLIC_` — it should remain server-only.
