# Known Scrape Issues (as of 2026-06-10)

Pipeline exits **OK** even when a company returns **0 jobs** (graceful degradation). Check **Scrape Log** tab for `Jobs Found=0`.

## HTTP / API failures (~22 companies)

| Company | Error |
|---------|-------|
| Snap Inc., Moveworks, Codeium / Windsurf | Greenhouse 404 |
| Yelp, Postman, Thumbtack | Lever 404 |
| Retool, Mistral AI, Adept AI, Runway ML, Pathos AI, Slack | Ashby 404 |
| Google, Apple | Custom API 404 |
| Expedia, Hilton, Qualcomm, JPMorgan, Shopify, Microsoft, ServiceNow | Workday 422/401 |
| Intuit | Workday 401 |
| Royal Caribbean Group | SmartRecruiters 400 |

## Parsing / empty boards

| Company | Issue |
|---------|-------|
| Meta | JS-rendered page — no embedded JSON |
| DoorDash | Greenhouse board empty (0 total jobs) |

## Not in scrape list

- **Universal Studios** — Cloudflare blocked
- **Flywire** — no public board

## Fixes applied in this pipeline

- Per-company scripts in `scrapers/companies/`
- Sheets-only diff tracking (30m / 2h / 24h)
- Description backfill per company
- Gemini ATS → column J (no resume generation)
- Linear/Retool deduped when scraping single company
