# Scrape Diff Tracking

All diff data lives in Google Sheets — nothing is saved locally.

## Time windows

| Window | Column | Meaning |
|--------|--------|---------|
| 30 minutes | `Delta 30m` | Change in job count vs closest scrape ~30m ago |
| 2 hours | `Delta 2h` | Change vs ~2h ago |
| 24 hours | `Delta 24h` | Change vs ~24h ago (yesterday/today comparison) |

## Per-scrape metrics

- **Jobs Found** — engineering roles returned this scrape
- **New Jobs** — URLs in scrape but not in sheet before
- **Removed Jobs** — URLs in sheet before but not in current scrape

## Significant changes

Logged to **Significant Changes** tab when:

- `New Jobs ≥ 3` or `Removed Jobs ≥ 3`, OR
- Any delta window `|Δ| ≥ 5`

## Viewing diffs

1. Open Google Sheet → **Scrape Log** tab
2. Filter by company column A
3. Compare `Delta 30m`, `Delta 2h`, `Delta 24h` across rows
4. Check **Significant Changes** for alerts

## Admin UI

`AllJobsTab` and `CompaniesTab` read **Jobs** tab via `GET /api/jobs`. ATS scores in column J appear after pipeline runs.
