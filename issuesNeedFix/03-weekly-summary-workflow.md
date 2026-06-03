# Issue 03: Weekly AI Career Summary Failing

**Workflow file:** `.github/workflows/weekly-summary.yml`  
**GitHub UI name:** Weekly AI Career Summary

## Symptoms

- Run **#6** failed (commit `69691a8`, May 31) — not re-run after recent fixes.
- Cron: Sundays 03:00 UTC (8 PM PDT previous day).

## What the script does

`scripts/weekly-summary.mjs`:

1. Reads job stats from Google Sheet  
2. Calls **Claude** (`claude-haiku-4-5`) for a weekly report  
3. Sends summary via **WhatsApp** (Meta Cloud API)

## Root causes

- Missing `ANTHROPIC_API_KEY`, `GOOGLE_*`, or WhatsApp secrets in GitHub Actions.
- `npm ci` without dev dependencies if any dev-only package is required.
- Duplicate `WHATSAPP_RECIPIENT` in old YAML (fixed on current `main`).

## User actions

1. Configure secrets (see [08-github-secrets-checklist.md](./08-github-secrets-checklist.md)).
2. **Actions → Weekly AI Career Summary → Run workflow** to test.

## Verify locally

```bash
node scripts/weekly-summary.mjs
```

## Checklist

- [ ] Secrets configured
- [ ] Manual `workflow_dispatch` run succeeds
- [ ] WhatsApp message received
