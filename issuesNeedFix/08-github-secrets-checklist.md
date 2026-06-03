# Issue 08: GitHub Actions Secrets Checklist

Configure at: **GitHub repo → Settings → Secrets and variables → Actions**

Never commit secret values. Copy from `.env.local` or PersonalService / Google Cloud consoles.

## CI workflow (`ci.yml`)

| Secret | Required | Notes |
|--------|----------|--------|
| `NEXTAUTH_SECRET` | Optional | Workflow has CI fallbacks |
| `ADMIN_EMAIL` | Optional | Cypress login |
| `ADMIN_PASSWORD` | Optional | Cypress login |

## Scrape Jobs — step: Scrape

| Secret | Required |
|--------|----------|
| `GOOGLE_SHEET_ID` | Yes |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes — full JSON one line |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes |
| `WHATSAPP_ACCESS_TOKEN` | Yes |
| `WHATSAPP_RECIPIENT` | Yes |

## Scrape Jobs — step: Generate resumes

| Secret | Required |
|--------|----------|
| `GOOGLE_SHEET_ID` | Yes |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes |
| `ANTHROPIC_API_KEY` | Yes |
| `GCS_SERVICE_ACCOUNT_JSON` | Yes |
| `GCS_BUCKET_NAME` | Yes |
| `GCS_PROJECT_ID` | Optional (default `jobseek-459701`) |

## Scrape Jobs — step: Auto-apply

| Secret | Required |
|--------|----------|
| `GOOGLE_SHEET_ID` | Yes |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes |
| `APPLICANT_EMAIL` | Recommended — use Profile 3: `koundinyapidaparthy@gmail.com` |
| `APPLICANT_FIRST_NAME` | Optional |
| `APPLICANT_LAST_NAME` | Optional |
| `APPLICANT_PHONE` | Optional |
| `APPLICANT_LINKEDIN` | Optional |
| `APPLICANT_PORTFOLIO` | Optional |
| `WHATSAPP_*` | Same as scrape step |

## Weekly Summary

| Secret | Required |
|--------|----------|
| `GOOGLE_SHEET_ID` | Yes |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes |
| `ANTHROPIC_API_KEY` | Yes |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes |
| `WHATSAPP_ACCESS_TOKEN` | Yes |
| `WHATSAPP_RECIPIENT` | Yes |

## Copy from PersonalService (non-secret metadata)

File: `/Users/koundinya.pidaparthy/Desktop/P1kp/PersonalService/config/user.json`

- Profile 3 email → `APPLICANT_EMAIL`
- WhatsApp block → `WHATSAPP_*` (rotate tokens if exposed)

## List configured secrets (names only)

```bash
gh auth login   # once
gh secret list
```

## After adding secrets

1. Share the Google Sheet with the service account `client_email` from `GOOGLE_SERVICE_ACCOUNT_JSON` (Editor).
2. **Actions → Scrape Jobs → Run workflow** (branch `main`), or: `gh workflow run scrape-jobs.yml`
3. **Actions → Weekly AI Career Summary → Run workflow**

Detailed copy steps: [`scripts/sync-secrets-to-github.md`](../scripts/sync-secrets-to-github.md)
