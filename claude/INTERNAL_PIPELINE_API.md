# Internal Pipeline API

The portfolio exposes a server-to-server endpoint for AI-powered job application automation.

---

## Overview

`POST /api/internal/generate-and-store`

This endpoint is **not for browser clients**. It's designed to be called by an external automation pipeline (a cron job, a scraper, or a CI/CD workflow).

**Authentication**: `x-internal-key` header must match the `INTERNAL_API_KEY` environment variable.

---

## What It Does

```
External caller sends: { company, title, description, jobUrl }
   │
   ▼
1. Verifies x-internal-key header
   │
   ▼
2. Loads current base resume from resumeStore
   │
   ▼
3. Calls Claude (claude-haiku-4-5-20251001, max 8192 tokens)
   Prompt instructs Claude to:
   - Rewrite personalInfo.summary for this specific role
   - Reorder skill categories (most relevant first)
   - Lightly rephrase 1-2 bullets per experience entry
   - Write a 3-paragraph cover letter
   - Return valid JSON only (no markdown, no fences)
   │
   ▼
4. Extracts tailoredResume and coverLetterText from Claude's JSON
   │
   ▼
5. Computes ATS score: calculateAtsScore(description, tailoredResume)
   │
   ▼
6. Renders tailored resume as PDF via @react-pdf/renderer
   │
   ▼
7. Uploads PDF to Google Cloud Storage (GCS)
   Path: resumes/YYYY-MM-DD/Company_Title.pdf
   Returns: signed URL valid for 7 days
   │
   ▼
8. Returns JSON response:
   {
     resumeUrl: "<signed GCS URL>",
     coverLetterText: "<full cover letter>",
     atsScore: 78,
     matched: ["typescript", "react", ...],
     missing: ["rust", "wasm", ...]
   }
```

---

## Request Format

```http
POST /api/internal/generate-and-store
Content-Type: application/json
x-internal-key: <INTERNAL_API_KEY>

{
  "company": "Anthropic",
  "title": "Senior Software Engineer",
  "description": "We are looking for...",
  "jobUrl": "https://jobs.ashbyhq.com/anthropic/12345"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `company` | string | Company name (used for file naming) |
| `title` | string | Job title (used for file naming, truncated to 40 chars) |
| `description` | string | Full job description (truncated to 3000 chars for Claude) |
| `jobUrl` | string | URL of the job posting (optional — included for reference) |

---

## Response Format

### Success (200)

```json
{
  "resumeUrl": "https://storage.googleapis.com/bucket/resumes/2026-06-01/Anthropic_Senior_Software_Engineer.pdf?X-Goog-Signature=...",
  "coverLetterText": "Dear Hiring Manager,\n\nI am excited to apply...\n\n...\n\nSincerely,\nKoundinya Pidaparthy",
  "atsScore": 78,
  "matched": ["typescript", "react", "node.js", "graphql"],
  "missing": ["rust", "kubernetes"]
}
```

### Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 401 | `{ "error": "Unauthorized" }` | Missing or wrong x-internal-key |
| 400 | `{ "error": "company, title, description required" }` | Missing body fields |
| 502 | `{ "error": "AI generation failed" }` | Claude API error or unparseable JSON |
| 500 | `{ "error": "PDF generation failed" }` | @react-pdf/renderer error |
| 503 | `{ "error": "ANTHROPIC_API_KEY not set" }` | Missing env var |

### GCS Fallback

If GCS upload fails, the endpoint does NOT return an error. Instead, `resumeUrl` is a `data:application/pdf;base64,...` string (the raw PDF encoded as base64). The caller can handle this gracefully.

---

## Claude Prompt Details

**Model**: `claude-haiku-4-5-20251001`  
**Max tokens**: 8192  
**Temperature**: default (not set explicitly)

### System Instructions

```
You are a senior technical resume writer. Tailor this resume for the job, then write a 3-paragraph cover letter.

RULES:
1. Keep all facts truthful — never invent metrics or experiences.
2. Rewrite personalInfo.summary (2–3 sentences) to speak directly to this role.
3. Reorder skill categories so most relevant appear first.
4. Lightly rephrase 1–2 bullets per role to echo the job description naturally.
5. coverLetter: 3 paragraphs. Opening hook, evidence/stories, close with enthusiasm for <company>.
   Must NOT sound AI-generated.

OUTPUT: ONLY valid JSON, no markdown, no code fences.
```

### JSON Robustness

Claude sometimes adds text before/after the JSON object. The parser handles this:

```ts
// Strip markdown code fences
let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

// Find outermost JSON object (handles trailing explanations)
const firstBrace = cleaned.indexOf("{");
if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
// ... brace-counting to find the closing }
```

---

## Google Cloud Storage

**Library**: `@google-cloud/storage`  
**File**: `lib/gcsUpload.ts`

### PDF File Naming

```
resumes/<YYYY-MM-DD>/<SafeCompany>_<SafeTitle>.pdf

Example:
resumes/2026-06-01/Anthropic_Senior_Software_Engineer.pdf
```

- `SafeCompany`: company name with non-alphanumeric chars replaced by `_`
- `SafeTitle`: job title with same sanitisation, truncated to 40 chars

### Signed URL

The returned URL is signed with a **7-day expiry**. After 7 days, the URL is no longer valid (but the file remains in GCS).

### Fallback (GCS not configured)

If `GCS_BUCKET_NAME` or `GCS_SERVICE_ACCOUNT_JSON` is not set:
- `uploadToGCS()` throws
- The endpoint catches the error and returns a base64 data URL instead
- No 5xx error is returned to the caller

---

## Required Environment Variables

```env
INTERNAL_API_KEY=<any-secret-string>
ANTHROPIC_API_KEY=sk-ant-...

# Google Cloud Storage
GCS_BUCKET_NAME=<bucket-name>
GCS_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"jobseek-459701",...}
GCS_PROJECT_ID=jobseek-459701
```

---

## Function Timeout

This endpoint does heavy work:
- Claude API call: 3–15 seconds
- PDF rendering: 1–3 seconds
- GCS upload: 1–2 seconds

**Total**: up to ~20 seconds

```ts
export const maxDuration = 60; // Vercel Pro required for 60s timeout
```

On Vercel Hobby (10s limit), this endpoint will timeout for complex resumes or slow Claude responses.

---

## Example Calling Script

```bash
curl -X POST https://koundinyapidaparthy.com/api/internal/generate-and-store \
  -H "Content-Type: application/json" \
  -H "x-internal-key: your-internal-key" \
  -d '{
    "company": "Stripe",
    "title": "Senior Software Engineer",
    "description": "Stripe is looking for a senior engineer...",
    "jobUrl": "https://stripe.com/jobs/12345"
  }'
```

Expected response time: 10–25 seconds.

---

## Security Considerations

- **x-internal-key** is a simple shared secret. For higher security, use HMAC-signed requests with a timestamp to prevent replay attacks.
- The endpoint is not rate-limited. A malicious caller with the key could rack up Claude API charges.
- Consider adding IP allowlisting at the Vercel middleware or reverse proxy level.
- The `coverLetterText` in the response contains personal information — treat it accordingly.
