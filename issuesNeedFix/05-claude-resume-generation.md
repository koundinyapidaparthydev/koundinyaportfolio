# Issue 05: Auto Resume Generation (Claude Haiku) Not Working

**Script:** `scripts/generate-applications.mjs`  
**API route (optional):** `app/api/internal/generate-and-store/route.ts`  
**Model:** `claude-haiku-4-5-20251001` (overridable via `ANTHROPIC_MODEL`)

## Symptoms

- GitHub Actions step **Generate tailored resumes** fails immediately or mid-batch.
- Sheet column **H (Resume URL)** stays empty for new jobs.
- No PDFs in GCS bucket `koundinya-job-resumes`.

## How generation works

1. Read rows from Google Sheet `Jobs` where column H is empty (unless `FORCE_REGENERATE=true`).
2. Load base resume from `data/resume.json`.
3. **Claude** returns tailored JSON (summary, experience bullets, cover letter).
4. `scripts/pdf-render-helper.cjs` renders PDF.
5. Upload to GCS; write URL, cover letter, ATS score back to sheet.

## Root causes

| Cause | Detail |
|--------|--------|
| Missing `ANTHROPIC_API_KEY` in GitHub | Script exits: `Missing required env vars` |
| Invalid / truncated `GCS_SERVICE_ACCOUNT_JSON` in GitHub secret | JSON parse error at startup |
| Wrong model name | Use `ANTHROPIC_MODEL` env; default `claude-haiku-4-5-20251001` |
| API rate limits | Reduce `MAX_CONCURRENT` (workflow sets `2`) |
| No jobs to process | All rows already have Resume URL |

## Local vs CI

- Local: auto-loads `.env.local` (hand-rolled parser preserves JSON with quotes).
- CI: only GitHub Secrets — must paste **full** one-line JSON for service accounts.

## Related: Ai/resume-generator

Path: `/Users/koundinya.pidaparthy/Desktop/P1kp/Ai/resume-generator/server.js`  
Separate Express service for LaTeX/PDF templates — **not** wired into portfolio CI today. Portfolio uses `@react-pdf/renderer` via `pdf-render-helper.cjs`.

## Verify

```bash
MAX_JOBS=1 node scripts/generate-applications.mjs
```

## Checklist

- [ ] `ANTHROPIC_API_KEY` in GitHub + `.env.local`
- [ ] `GCS_*` secrets valid
- [ ] One test row gets column H populated
- [ ] Claude API billing active
