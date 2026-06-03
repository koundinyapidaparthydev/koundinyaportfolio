# Job Pipeline — Split Workflows (Sheet Queue)

## Architecture

The job pipeline is split into two GitHub Actions workflows so a single run never processes hundreds of rows:

| Workflow | Schedule (UTC) | Script | Purpose |
|----------|----------------|--------|---------|
| **Scrape Jobs** | `:00`, `:30` | `scrape-jobs.mjs` | Scrape ATS listings → append rows to Sheet `Jobs` A–G |
| **Process Job Batch** | `:15`, `:45` | `process-job-batch.mjs` | Up to 30 rows/run: generate resume → apply **same row** → update H–M |

This is an **SQS-like drain pattern** without AWS: the Google Sheet is the queue; repeated scheduled batch runs dequeue work until `H` (resume) and `K` (apply status) are satisfied.

## Per-row flow (`process-job-batch.mjs`)

1. Read `Jobs!A2:M`
2. Select up to `BATCH_SIZE` rows (hard cap **50**):
   - **Priority 1:** `description` ≥ 30 chars, column **H** empty → generate + apply
   - **Priority 2:** **H** filled, **K** = `pending` → apply-only
3. For each row (concurrency ≤ 2):
   - If generate needed: Claude → PDF → GCS → write **H–M**
   - Immediately `applyToRow()` for **that row index** (fixes old bug where auto-apply picked the first pending row globally)

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `BATCH_SIZE` | 30 | Capped at 50 in script |
| `START_ROW` | 2 | First sheet row to consider |
| `MAX_CONCURRENT` | 2 | Parallel rows within one batch |
| `DRY_RUN` | false | Skips Playwright submit when `true` |

## Run locally

```bash
# One row, no submit (safe test)
BATCH_SIZE=1 DRY_RUN=true node scripts/process-job-batch.mjs

# Or npm script
npm run job:process-batch:test

# Full batch (uses .env.local)
BATCH_SIZE=5 node scripts/process-job-batch.mjs
```

## Run on GitHub

- **Actions → Scrape Jobs** — scrape only
- **Actions → Process Job Batch (Generate + Apply)** — `workflow_dispatch` with `batch_size` / `start_row`

Legacy scripts remain for ad-hoc use:

- `node scripts/generate-applications.mjs` (respects `MAX_JOBS`)
- `node scripts/auto-apply.mjs` (first N pending rows — not row-paired)

## Resume PDF (ATS)

`lib/resumePdf.tsx` and `scripts/pdf-render-helper.cjs` use black/gray on white, Helvetica, no colored headers or pill tags. Section order: Summary → Skills → Experience → Projects → Education.
