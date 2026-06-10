# Scraper Pipeline Architecture

## Overview

Each company has its own Python entry point under `scrapers/companies/`. All state is stored in **Google Sheets only** — no local job databases.

```
companies.json
    ↓
scrapers/companies/<slug>.py  →  scrapers/_base.py
    ↓
scripts/run-company-pipeline.mjs
    ↓
scripts/scrape-jobs.mjs (fetch) + Sheets write + descriptions + Gemini ATS
```

## Google Sheets tabs

| Tab | Purpose |
|-----|---------|
| **Jobs** | Live job rows (A–N). Column G = description, J = ATS score |
| **Scrape Log** | Per-company scrape history with 30m / 2h / 24h deltas |
| **Significant Changes** | Notable deltas (≥5 jobs or ≥3 new/removed) |
| **Old Jobs** | Archived rows (>48h) |

### Scrape Log columns

`Company | Scraped At | Jobs Found | New Jobs | Removed Jobs | Delta 30m | Delta 2h | Delta 24h | Status | Notes`

## Per-company scripts

Each company in `companies.json` has a dedicated Python entry point:

```
scrapers/companies/<slug>.py   # e.g. stripe.py, door_dash.py
```

`scraper.py "Stripe"` dispatches to `scrapers/companies/stripe.py`, which calls
`scripts/run-company-pipeline.mjs` via `scrapers/_base.py`. Regenerate all 87
scripts after editing `companies.json`:

```bash
python3 scripts/generate-company-scrapers.py
```

## Per-company flow

1. Fetch jobs via `scripts/scrape-jobs.mjs` (`COMPANY` filter)
2. Write new rows to **Jobs** (dedup by URL)
3. Backfill descriptions (column G) for that company — **max 15/cycle** (`DESCRIPTION_BACKFILL_LIMIT`)
4. ATS score via **Gemini 2.0 Flash Lite** → column J (fallback: keyword scorer)
5. Append row to **Scrape Log** with time-window diffs
6. If significant → append **Significant Changes**

## Sheets API quota

Reads/writes go through `scripts/lib/sheets-rate-limit.mjs`:

- **350 ms** minimum between reads (`SHEETS_READ_INTERVAL_MS`)
- **200 ms** between writes (`SHEETS_WRITE_INTERVAL_MS`)
- **429 retry** with exponential backoff (up to 5 attempts)
- Pipeline consolidates per-company reads (2–3 per company instead of 5+)
- Description backfill capped per cycle so 87-company bursts stay under quota

## Commands

```bash
# Regenerate per-company scripts from companies.json
python3 scripts/generate-company-scrapers.py

# Run one company (writes to Sheets)
python3 scraper.py "Stripe"

# Full autonomous loop
python3 autonomous_agent.py --once
```

## Env vars

- `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` — required
- `GEMINI_API_KEY` — ATS scoring (optional; falls back to local keywords)
- `GEMINI_MODEL` — default `gemini-2.0-flash-lite`

## Resume generation

**Not enabled in this pipeline.** Only ATS match scores are written to column J.
