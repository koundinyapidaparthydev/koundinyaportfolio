# Jobs pipeline (Hiring Cafe only)

This project **scrapes engineering job listings from Hiring Cafe** into a Google Sheet. Apply is manual in the admin UI — there is no auto-apply pipeline.

**Source of truth:** Google Sheet (`GOOGLE_SHEET_ID`) → tab **`Jobs`** (active apply-now window) and **`Old Jobs`** (archived after ~12 hours).

**Job fetching:** `.github/workflows/scrape-jobs.yml` scrapes jobs every 10 min. **Parallel tailoring** runs in `.github/workflows/tailor-jobs.yml` every 5 min. The `CI` workflow runs tests on push — it does not fetch jobs.

**Production mode:** Hiring Cafe only — Engineering + Software Development departments, jobs posted within the last 2 days. Legacy multi-portal scraping (`companies.json`) is disabled unless `ALLOW_LEGACY_SCRAPE=1`.

---

## Overview

```mermaid
flowchart LR
  HC[hiring.cafe Playwright scrape]
  HC --> Filter[isEngineeringRole + US]
  Filter --> Refresh[Refresh discovered-at for existing rows]
  Refresh --> Dedup[Dedup HC id + company/title]
  Dedup --> Sheet[Append new jobs to Jobs A–U]
  Sheet --> ATS[Gemini ATS score]
  ATS --> Verify[Verify eligible rows vs 90%]
  Verify --> TailorQuick[Quick tailor batch 5]
  TailorQuick --> Archive[Archive rows older than 12h → Old Jobs]
  Archive --> Notify[WhatsApp optional]

  subgraph tailorWF [tailor-jobs.yml every 5m]
    Parallel[Parallel tailor concurrency 5]
    Save[Upload PDF when score >= 90]
    Parallel --> Save
  end

  Verify -->|re-queue J < 90| Parallel
  Parallel --> Sheet
```

| Stage | Script | npm command |
|-------|--------|-------------|
| **HC pipeline** (default) | `scripts/run-hiring-cafe-pipeline.mjs` | `npm run job:pipeline` |
| **Parallel tailor** (GHA every 5m) | `scripts/run-tailor-pipeline.mjs` | — |
| **Local 10-min loop** | `scripts/run-hiring-cafe-loop.mjs` | Disabled by default — use GHA. Dev: `ALLOW_LOCAL_PIPELINE_LOOP=1 npm run job:pipeline:loop` |
| **Re-tailor below 90%** | `scripts/retailor-below-target.mjs` | `npm run job:retailor` |
| **Full sheet backfill** | `scripts/retailor-all-below-90.mjs` | `npm run job:retailor:all` |
| **Purge legacy rows** | `scripts/purge-jobs-sheet.mjs` | `npm run job:purge` |
| **Diagnose sheet** | `scripts/diagnose-sheet.mjs` | `npm run job:diagnose` |
| **Env check** | `scripts/validate-pipeline-env.mjs` | `npm run job:validate-env` |
| **Legacy multi-portal** (manual only) | `scripts/run-full-pipeline.mjs` | `ALLOW_LEGACY_SCRAPE=1 npm run job:pipeline:companies` |

**GitHub Actions:**

| Workflow | Schedule | Role |
|----------|----------|------|
| `scrape-jobs.yml` | Every 10 min | Scrape, ATS score, **verify** compliance, quick tailor (batch 5) |
| `tailor-jobs.yml` | Every 5 min | Bulk parallel tailoring (batch 30, concurrency 5) |

Batch limits in GHA: `HC_ATS_BATCH_LIMIT=60`, `HC_TAILOR_BATCH_LIMIT=5` (scrape) / `30` (tailor workflow).

---

## Hiring Cafe scrape config

| Setting | Value |
|---------|--------|
| Search URL | `https://hiring.cafe/?searchState=…` — Engineering + Software Development, last 2 days, sorted by date (no HC `locations` filter) |
| US filter | Applied after scrape via `isUsHcJob` (admin defaults to US-only) |
| Departments | Engineering, Software Development |
| Date window | Last 2 days (`dateFetchedPastNDays: 2`) |
| Apply-now window | Jobs tab keeps discoveries from last **12 hours** (older rows archived) |
| Dedup | HC job id + company/title vs `Jobs` + `Old Jobs`; sheet compact each run |
| Refresh | Existing rows get column F updated every scrape (last discovered) |
| Schedule | GHA every 10 min; admin filters include 10m / 20m / 30m windows |
| Pagination | Pages 1–5 each run via HC `&page=` param (0-based) |
| Descriptions | Full text from HC job detail API (`job_information.description`) |
| ATS | Gemini scores base resume vs description → J, O–Q |
| Verify | Every scrape re-scores eligible rows; rows below 90% reset column U |
| Auto-tailor | Base ATS &lt;90% with ≥3 skill matches → single-phase Gemini tailor (max 12 tries) → PDF upload when ≥90% → H; R=`yes` only when upload succeeds |

### Tailoring thresholds

| Constant | Value | Meaning |
|----------|-------|---------|
| `SKIP_TAILOR_INITIAL_ATS` | 90% | Skip tailoring when base resume already scores this high |
| `TAILOR_TARGET_SCORE` | 90% | Single-phase loop target |
| `TAILOR_SAVE_MIN_SCORE` | 90% | Minimum post-tailor score to upload PDF and set R=`yes` |
| `MAX_TAILOR_ATTEMPTS` | 12 | Max tailor attempts per job |
| `MIN_SKILL_MATCH_COUNT` | 3 | Minimum skill overlap required to tailor |

Single-phase loop: attempt 1 from base resume, attempts 2+ refine the **best-scoring draft** with ATS gap feedback. A lower-scoring retry never replaces a better draft.

Config lives in `scripts/lib/ats-config.mjs` (keep in sync with `lib/admin/atsConfig.ts`).

### Concurrency env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `HC_TAILOR_BATCH_LIMIT` | 5 (scrape) / 30 (tailor GHA) | Jobs per tailor run |
| `HC_TAILOR_CONCURRENCY` | 5 | Parallel Gemini tailor workers |
| `HC_TAILOR_DELAY_MS` | 2000 | Delay between jobs when concurrency = 1 |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Bulk initial ATS scoring |
| `GEMINI_TAILOR_MODEL` | `gemini-2.0-flash` | Tailor + post-tailor scoring + verify |

---

## Sheet columns (A–U)

| Col | Field | Set by |
|-----|-------|--------|
| A–G | Company, Title, Location, URL, Category, Fetched At, Description | Scraper (full description from HC Job Description tab) |
| H–M | Resume URL, Cover Letter, ATS Score, Apply Status, Applied At, Notes | Pipeline / manual apply |
| N | Posted At | Scraper (HC API / relative DOM times) |
| O | ATS Match Summary | Gemini ATS analysis |
| P | Key Gaps | Gemini ATS analysis |
| Q | Recommended Keywords | Gemini ATS analysis |
| R | Resume Modified | `no` = base or below save min; `yes` = AI-tailored PDF saved (post-tailor ≥90%) |
| S | Pre-Tailor ATS | Base-resume score before tailoring (for comparison) |
| T | Skill Match | Count of resume skills found in job description |
| U | Tailor Attempts | Cumulative Gemini tailor attempts for this row |

---

## One-time purge (legacy → HC-only)

When migrating from multi-portal rows to HC-only:

```bash
DRY_RUN=true npm run job:purge              # preview row counts
npm run job:purge -- --clear-dedup          # backup Jobs → Old Jobs, clear Jobs, wipe Old Jobs dedup
npm run job:pipeline                        # fresh HC scrape
npm run job:diagnose                        # confirm ~hundreds of hiring-cafe rows
```

`--clear-dedup` wipes `Old Jobs` so previously archived URLs can be re-imported.

---

## Environment

Required:

- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

Optional (warned at scrape time if missing):

- `GEMINI_API_KEY` — ATS scoring (columns J, O–Q), resume tailoring, verify pass
- `GCS_SERVICE_ACCOUNT_JSON`, `GCS_BUCKET_NAME` — tailored resume PDF upload (column H)
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_RECIPIENT` — new-job alerts
- `DRY_RUN=true` — fetch + summary only; no writes
- `ALLOW_LEGACY_SCRAPE=1` — required to run `job:pipeline:companies` (multi-portal legacy scrape)
- `HC_ATS_BATCH_LIMIT` — ATS scoring batch per run (default 60 in GHA)
- `HC_TAILOR_BATCH_LIMIT` — tailor batch per run (default 5 in scrape GHA, 30 in tailor GHA)
- `HC_TAILOR_CONCURRENCY` — parallel tailor workers (default 5)
- `GEMINI_TAILOR_MODEL` — model for tailor + verify scoring (default `gemini-2.0-flash`)
- `HC_RESET_TAILOR_ATTEMPTS` — retailor script resets column U (default on; set `0` to skip)

---

## Local commands

```bash
npm run job:validate-env
npm run job:pipeline:hc:dry     # DRY_RUN — no sheet writes
npm run job:pipeline            # HC scrape + sheet update + verify
node scripts/run-tailor-pipeline.mjs   # parallel tailor only
npm run job:purge:dry           # preview purge counts
npm run job:diagnose
npm run job:retailor            # re-tailor rows below 90% save min
npm run job:retailor:all        # one-time full sheet backfill (batch 999)
```

---

## Admin API

`GET /api/jobs` returns **Hiring Cafe rows only** by default (`category === "hiring-cafe"` or URL contains `hiring.cafe`).

For debugging legacy rows: `GET /api/jobs?includeLegacy=true`.

Apply is **manual** — use the job URL and mark as applied in the admin UI after submitting.

---

## Archived docs

- [FORM-DATA-COLLECTION.md](./FORM-DATA-COLLECTION.md) — apply/form capture (removed from codebase)
- [APPLICANT-MEMORY.md](./APPLICANT-MEMORY.md) — applicant memory for auto-apply (removed from codebase)

Historical captures under `data/form-intelligence/` are kept on disk but no longer referenced by scripts.
