# Issue 02: Scrape Jobs Workflow Failing

**Workflow file:** `.github/workflows/scrape-jobs.yml`  
**GitHub UI name:** Scrape Jobs → Generate Resumes → Auto-Apply

## Symptoms

- Scheduled run **#93** (and others) fail at **Generate tailored resumes** (~2m 40s).
- Scrape step may succeed; generate or auto-apply step exits with code 1.
- Push to `main` does **not** auto-trigger this workflow (schedule + `workflow_dispatch` only).

## Pipeline steps

1. **Scrape jobs** — `node scripts/scrape-jobs.mjs` → Google Sheet  
2. **Generate tailored resumes** — `node scripts/generate-applications.mjs` → Claude Haiku → PDF → GCS → Sheet columns H–J  
3. **Auto-apply** — `node scripts/auto-apply.mjs` → Playwright → Sheet columns K–M  

## Root causes

| Step | Typical failure |
|------|------------------|
| Install | `npm ci` without dev deps → **Playwright** not installed (`playwright` is a devDependency) |
| Scrape | Invalid / empty `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SHEET_ID` |
| Generate | Missing `ANTHROPIC_API_KEY`, `GCS_*`, or invalid JSON secrets |
| Generate (old workflow) | Step passed `INTERNAL_API_KEY` / `PORTFOLIO_BASE_URL` — **not used** by script (fixed in `c2963a8`) |
| Auto-apply | No rows with `Resume URL` + `Apply Status=pending`; Playwright timeout on ATS |

## Fixes applied in repo

- `scrape-jobs.yml` generate step env: `ANTHROPIC_API_KEY`, `GCS_SERVICE_ACCOUNT_JSON`, `GCS_BUCKET_NAME`, `GCS_PROJECT_ID`
- Scripts: early validation of service account JSON (`scrape-jobs.mjs`, `generate-applications.mjs`, `auto-apply.mjs`)
- Workflow install: use `npm ci --include=dev` (see workflow patch)

## User actions required

1. Add secrets from [08-github-secrets-checklist.md](./08-github-secrets-checklist.md).
2. **Actions → Scrape Jobs → Run workflow** on branch `main` (after push).
3. Confirm sheet `Jobs` tab has columns A–M and service account has **Editor** access.

## Verify locally

```bash
# Requires .env.local with same vars as GitHub secrets
node scripts/scrape-jobs.mjs
node scripts/generate-applications.mjs
DRY_RUN=true node scripts/auto-apply.mjs
```

## Checklist

- [ ] All scrape/generate/apply secrets in GitHub
- [ ] Manual workflow run succeeds on latest `main`
- [ ] Sheet rows get Resume URL (H) and ATS score (J) after generate
