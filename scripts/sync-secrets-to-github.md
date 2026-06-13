# Sync pipeline secrets to GitHub Actions

**Never paste secret values in chat, commits, or this file.** Copy values from `.env.local` into the repo UI.

**Where:** [GitHub → Settings → Secrets and variables → Actions](https://github.com/koundinyapidaparthy2/koundinyaportfolio/settings/secrets/actions)

## Required secret names

### Scrape Jobs — scrape step

| Secret name |
|-------------|
| `GOOGLE_SHEET_ID` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` |
| `WHATSAPP_PHONE_NUMBER_ID` |
| `WHATSAPP_ACCESS_TOKEN` |
| `WHATSAPP_RECIPIENT` |

### Scrape Jobs — generate step

| Secret name |
|-------------|
| `GOOGLE_SHEET_ID` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` |
| `GEMINI_API_KEY` |
| `GCS_SERVICE_ACCOUNT_JSON` |
| `GCS_BUCKET_NAME` |
| `GCS_PROJECT_ID` (optional) |

### Scrape Jobs — auto-apply step

| Secret name |
|-------------|
| `GOOGLE_SHEET_ID` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` |
| `APPLICANT_EMAIL` (recommended: `koundinyapidaparthy@gmail.com`) |
| `APPLICANT_FIRST_NAME` (optional) |
| `APPLICANT_LAST_NAME` (optional) |
| `APPLICANT_PHONE` (optional) |
| `APPLICANT_LINKEDIN` (optional) |
| `APPLICANT_PORTFOLIO` (optional) |

### Weekly Summary workflow

| Secret name |
|-------------|
| `GOOGLE_SHEET_ID` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` |
| `GEMINI_API_KEY` |
| `WHATSAPP_PHONE_NUMBER_ID` |
| `WHATSAPP_ACCESS_TOKEN` |
| `WHATSAPP_RECIPIENT` |

### CI (optional)

| Secret name |
|-------------|
| `NEXTAUTH_SECRET` |
| `ADMIN_EMAIL` |
| `ADMIN_PASSWORD` |

## Copy checklist

1. Open `.env.local` locally (not committed).
2. For each JSON secret (`GOOGLE_SERVICE_ACCOUNT_JSON`, `GCS_SERVICE_ACCOUNT_JSON`): paste as **one line** in GitHub.
3. Confirm `GOOGLE_SHEET_ID` matches your spreadsheet URL.
4. From `GOOGLE_SERVICE_ACCOUNT_JSON`, copy `client_email` → share the Google Sheet with that email as **Editor**.
5. List configured secrets (names only): `gh secret list`
6. Trigger pipeline: **Actions → Scrape Jobs → Run workflow** on branch `main` (default **1** job per run via `max_jobs`; scheduled runs use the same limit).

## Verify locally first

```bash
npm run job:diagnose
npm run job:validate-env
node scripts/validate-pipeline-env.mjs --stage=scrape
MAX_JOBS=1 node scripts/generate-applications.mjs
DRY_RUN=true APPLY_LIMIT=1 node scripts/auto-apply.mjs
```

See also: [`issuesNeedFix/08-github-secrets-checklist.md`](../issuesNeedFix/08-github-secrets-checklist.md)
