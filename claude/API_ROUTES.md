# API Routes

Complete reference for all API endpoints in the portfolio.

---

## Public Endpoints

### `GET /api/resume`

Returns the full resume JSON. Publicly accessible and CDN-cacheable.

**Cache headers**: `public, s-maxage=60, stale-while-revalidate=300`

**Response**:
```json
{
  "personalInfo": { "name": "...", "email": "...", ... },
  "experience": [...],
  "projects": [...],
  "skills": [...],
  "education": [...]
}
```

---

### `GET /api/resume/pdf`

Generates and returns the resume as a PDF file. Publicly accessible.

**Response headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="Koundinya_Pidaparthy_Resume.pdf"
```

**Process**: Loads resume data → `React.createElement(ResumePdfDocument)` → `renderToBuffer()` → binary response.

---

### `POST /api/contact`

Sends a contact form message via SMTP/Nodemailer to the portfolio owner's email.

**Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "subject": "Opportunity",
  "message": "Hi Koundinya, I wanted to reach out..."
}
```

**Validation** (Zod):
- `name`: min 2 chars
- `email`: valid email format
- `subject`: optional, min 2 chars
- `message`: min 10 chars

**Success**: `{ "success": true }`  
**Error**: `{ "error": { ... } }` with 400/500 status

**Nodemailer config**: SMTP via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.

---

### `POST /api/track`

Records a visitor event. Called automatically on every page visit.

**Body**:
```json
{
  "page": "/",
  "referrer": "https://linkedin.com",
  "language": "en-US",
  "screen": "1440x900",
  "timezone": "America/New_York"
}
```

**Server extracts**:
- IP from `x-forwarded-for` / `x-real-ip` headers
- Device type, Browser, OS from User-Agent string
- Country, City from `ip-api.com` geolocation (free tier)

**Persists to**: `data/visitors.json` (local dev) / console.warn (Vercel production — read-only FS)

**Email notification**: Sends real-time alert email if `EMAIL_PASSWORD` is configured.

**Success**: `{ "ok": true }`

---

### `GET /api/jobs`

Returns jobs from the "Jobs" Google Sheet. Used by the admin Companies tab.

**Response**:
```json
{
  "jobs": [
    {
      "company": "Anthropic",
      "title": "Senior Software Engineer",
      "location": "Remote, US",
      "url": "https://...",
      "category": "ai-agentic",
      "fetchedAt": "2026-06-01T14:30:00.000Z",
      "description": "We are looking for..."
    }
  ]
}
```

**Requirements**: `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`  
**Not configured**: Returns `{ jobs: [], error: "not configured" }` with 503

---

## Admin-Only Endpoints (Session Required)

All admin endpoints call `requireAdminSession()` from `lib/auth.ts`. Returns 401 if not authenticated as admin.

---

### `PUT /api/resume`

Saves/updates the full resume JSON.

**Body**: Full `Resume` object (validated against Zod `ResumeSchema`)

**Success**: `{ "success": true, "data": { ... } }`  
**Validation failure**: `{ "error": "Validation failed.", "details": { ... } }` with 422  
**Auth failure**: `{ "error": "Unauthorized." }` with 401

---

### `GET /api/visitors`

Returns all recorded visitor entries (newest first).

**Response**: `VisitorEntry[]`

```json
[
  {
    "id": "abc123",
    "timestamp": "2026-06-01T10:30:00.000Z",
    "ip": "1.2.3.4",
    "device": "Desktop",
    "browser": "Chrome/124.0",
    "os": "macOS 14",
    "country": "United States",
    "city": "New York",
    "page": "/",
    "referrer": "https://linkedin.com",
    "language": "en-US",
    "screen": "1440x900",
    "timezone": "America/New_York",
    "userAgent": "Mozilla/5.0 ..."
  }
]
```

---

### `POST /api/resume/tailor`

AI-tailors the resume for a specific job. Returns a PDF (for direct download).

**Body**:
```json
{
  "title": "Senior Software Engineer",
  "company": "Stripe",
  "description": "Full job description text...",
  "type": "resume"
}
```

`type` can be `"resume"` or `"cover"` (for cover letter PDF).

**Process**:
1. Claude tailors resume JSON (or writes cover letter text)
2. `@react-pdf/renderer` renders PDF buffer
3. Returns binary PDF response

**Response headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="Stripe_Resume.pdf"
```

**Requirements**: `ANTHROPIC_API_KEY`  
**Not configured**: 503 `{ "error": "AI tailoring not configured" }`

---

### `PATCH /api/auth/password`

Changes the admin password.

**Body**:
```json
{
  "currentPassword": "oldpass",
  "newPassword": "newpass123"
}
```

**Process**:
1. Verifies `currentPassword` against existing PBKDF2 hash or env var
2. Hashes `newPassword` with PBKDF2 (SHA-256, 100,000 iterations)
3. Writes new hash to `data/admin.json`

**Success**: `{ "success": true }`  
**Wrong password**: 401 `{ "error": "..." }`

---

## Internal Server-to-Server Endpoint

### `POST /api/internal/generate-and-store`

AI generates a tailored resume + cover letter, renders as PDF, uploads to GCS.

**Auth**: `x-internal-key: <INTERNAL_API_KEY>` header (NOT session-based)

**Body**:
```json
{
  "company": "Anthropic",
  "title": "Senior Software Engineer",
  "description": "Full job description...",
  "jobUrl": "https://..."
}
```

**Process**:
1. Claude `claude-haiku-4-5-20251001` tailors resume + generates cover letter
2. Computes ATS score
3. Renders PDF via `@react-pdf/renderer`
4. Uploads PDF to GCS (signed URL, 7-day expiry)

**Response**:
```json
{
  "resumeUrl": "https://storage.googleapis.com/...",
  "coverLetterText": "Dear Hiring Manager...",
  "atsScore": 78,
  "matched": ["typescript", "react"],
  "missing": ["rust", "kubernetes"]
}
```

**Timeout**: `maxDuration = 60` (requires Vercel Pro)

**Requirements**: `INTERNAL_API_KEY`, `ANTHROPIC_API_KEY`, optionally `GCS_*`

---

## Authentication Endpoints (NextAuth)

### `GET/POST /api/auth/[...nextauth]`

Managed entirely by NextAuth.js. Handles:

- `POST /api/auth/signin` — initiates sign-in
- `POST /api/auth/callback/credentials` — processes credential submission
- `GET /api/auth/session` — returns current session (or null)
- `POST /api/auth/signout` — clears the session cookie

The `CredentialsProvider` in `lib/auth.ts` handles credential verification.

---

## Archive Endpoint

### `POST /api/jobs/archive`

Moves jobs older than 2 days from "Jobs" to "Old Jobs" Google Sheet.

**Response**:
```json
{ "archived": 12, "kept": 8 }
```

**Requirements**: `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`

---

## API Quick Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/resume` | None | Get full resume JSON |
| PUT | `/api/resume` | Admin | Save updated resume |
| GET | `/api/resume/pdf` | None | Download resume PDF |
| POST | `/api/resume/tailor` | Admin | AI-tailor + download PDF |
| POST | `/api/contact` | None | Submit contact form |
| POST | `/api/track` | None | Record visitor event |
| GET | `/api/visitors` | Admin | Get all visitor logs |
| GET/POST | `/api/auth/[...nextauth]` | — | NextAuth handlers |
| PATCH | `/api/auth/password` | Admin | Change admin password |
| GET | `/api/jobs` | None | Get jobs from Google Sheets |
| POST | `/api/jobs/archive` | — | Archive old job rows |
| POST | `/api/internal/generate-and-store` | x-internal-key | AI generate + upload to GCS |
