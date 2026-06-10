# Deploy Readiness Checklist

Last updated: 2026-06-10

## Pre-deploy checks

| Check | Command / location | Expected |
|-------|-------------------|----------|
| Unit tests | `python3 test_suite.py` | All pass |
| Per-company scrapers | `ls scrapers/companies/*.py \| wc -l` | 87 (+ `__init__.py`) |
| Regenerate scrapers | `python3 scripts/generate-company-scrapers.py` | Synced with `companies.json` |
| Single-company smoke | `python3 scraper.py "Stripe"` | Exit 0, Scrape Log row |
| Full cycle smoke | `python3 autonomous_agent.py --once` | Completes (may defer desc backfill) |

## Required environment variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_SHEET_ID` | Target spreadsheet |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account credentials (JSON string) |
| `GEMINI_API_KEY` | ATS scoring via Gemini (optional — keyword fallback) |

Optional tuning:

| Variable | Default | Purpose |
|----------|---------|---------|
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | ATS model |
| `DESCRIPTION_BACKFILL_LIMIT` | `15` | Max descriptions filled per company per cycle |
| `DESCRIPTION_CONCURRENCY` | `3` | Parallel description fetches |
| `SHEETS_READ_INTERVAL_MS` | `350` | Min delay between Sheets reads |
| `SHEETS_WRITE_INTERVAL_MS` | `200` | Min delay between Sheets writes |
| `SHEETS_MAX_RETRIES` | `5` | 429 retry attempts |
| `DRY_RUN` | `false` | Skip all sheet writes (scrape only) |

## Google Sheets tabs

| Tab | Required | Purpose |
|-----|----------|---------|
| **Jobs** | Yes | Live job rows (A–N) |
| **Scrape Log** | Auto-created | Per-company history + deltas |
| **Significant Changes** | Auto-created | Notable job-count swings |
| **Old Jobs** | Auto-created | Archived rows (>48h) |

## Architecture summary

```
companies.json (87 companies)
  → scrapers/companies/<slug>.py (one per company)
  → scripts/run-company-pipeline.mjs
  → scripts/scrape-jobs.mjs + Sheets + Gemini ATS
```

Autonomous loop: `python3 autonomous_agent.py` (every 10 min via agent loop or cron).

## Known non-blockers

See [KNOWN-SCRAPE-ISSUES.md](./KNOWN-SCRAPE-ISSUES.md):

- ~22 companies return HTTP 404/401 (graceful — logged as 0 jobs or FAILED)
- Meta JS-rendered board (0 jobs until Playwright enrich)
- Description backfill may defer rows when quota is tight (re-filled next cycle)

## Deploy status

Run this checklist before each deploy. Blockers = failing tests, missing env vars, or Sheets auth errors.
