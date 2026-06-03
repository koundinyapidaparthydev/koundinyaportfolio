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
| `RECORD_APPLY` | false (true in CI workflow) | Saves video/trace/screenshots under `artifacts/` per row |

## Apply recordings (CI)

When `RECORD_APPLY=true`, each Playwright apply writes:

- `artifacts/apply-videos/` — one `.webm` per row (browser context video)
- `artifacts/traces/row-{N}-trace.zip` — Playwright trace (open with `npx playwright show-trace`)
- `artifacts/screenshots/row-{N}-{before-submit|after-submit|error}.png`

After a **Process Job Batch** run on GitHub Actions, download the artifact from the workflow run page (**Summary → Artifacts → `apply-recordings-{run_id}`**). Artifacts are kept for 14 days.

Locally:

```bash
RECORD_APPLY=true BATCH_SIZE=1 node scripts/process-job-batch.mjs
# then inspect ./artifacts/
```
| `RECORD_APPLY` | false locally | `true` in CI — records Playwright video/trace/screenshot per apply |

## Apply recordings (GCS)

When `RECORD_APPLY=true` (enabled in **Process Job Batch** workflow), each Playwright apply uploads artifacts to GCS:

```
gs://{GCS_BUCKET_NAME}/apply-recordings/{YYYY-MM-DD}/row-{rowIndex}-{company-slug}/video.webm
gs://{GCS_BUCKET_NAME}/apply-recordings/{YYYY-MM-DD}/row-{rowIndex}-{company-slug}/trace.zip
gs://{GCS_BUCKET_NAME}/apply-recordings/{YYYY-MM-DD}/row-{rowIndex}-{company-slug}/screenshot.png
```

Signed URLs (7-day expiry, same as resume PDFs) are written in two places:

1. **Sheet column M (Notes)** — appended after apply status, e.g. `submitted | recording: https://… | trace: https://… | screenshot: https://…`
2. **GitHub Actions log** — lines tagged `Apply recording row {N} video` (and trace/screenshot) via `::notice`; search the run log for `Apply recording` or `recording:`

If GCS upload fails, files are copied to `artifacts/apply-recordings/` in the runner and uploaded as a workflow artifact (`apply-recordings-fallback`, 7-day retention).

Lever applies (HTTP POST, no browser) are not recorded.

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
