# Issue 06: Auto-Apply (Playwright) Not Working

**Script:** `scripts/auto-apply.mjs`  
**Dependency:** `playwright` (devDependency — must install with `npm ci --include=dev` in CI)

## Symptoms

- Workflow step **Auto-apply to jobs** fails or skips all rows.
- Sheet shows `Apply Status` = `failed` with notes in column M.
- Jobs never move to `applied`.

## Prerequisites (sheet)

For each row to auto-apply:

- Column **H** — Resume URL (PDF, signed GCS URL)
- Column **K** — `pending`
- Column **D** — Supported ATS URL (Greenhouse, Lever, Workday, Ashby, etc.)

## Applicant profile (Profile 3)

Job applications should use **Profile 3** from PersonalService:

| Field | Source |
|--------|--------|
| Email | `koundinyapidaparthy@gmail.com` |
| Env | `APPLICANT_EMAIL` or `PERSONAL_SERVICE_CONFIG` → profile `profile3` |

Script: `scripts/lib/applicant-profile.mjs` loads Profile 3 when `PERSONAL_SERVICE_CONFIG` points to PersonalService `config/user.json`.

## Root causes

| Cause | Detail |
|--------|--------|
| Playwright not installed in CI | `npm ci` without `--include=dev` |
| `DRY_RUN=true` | Logs only, no submit |
| ATS changed DOM | Selectors in `applyGreenhouse`, `applyWorkday`, etc. need updates |
| React-controlled inputs | Some boards need `input`/`change` events — script uses Playwright `fill` + React fallback |
| Resume download fails | Expired signed URL (7-day GCS signing) |
| CAPTCHA / login walls | Cannot automate — marked `failed` |

## Ideas from Ai browser extension

`/Users/koundinya.pidaparthy/Desktop/P1kp/Ai/aplifyai-web/apps/extension/src/smart-apply/`:

- `FormDetector` — label/aria mapping  
- `FormFiller` — bubbling `input`/`change` events for React  
- Future: optional Chrome extension bridge for manual-assist apply

## Verify

```bash
DRY_RUN=true APPLY_LIMIT=1 node scripts/auto-apply.mjs
```

## Checklist

- [ ] Playwright browsers installed (`npx playwright install chromium`)
- [ ] At least one sheet row: resume URL + `pending`
- [ ] `APPLICANT_*` secrets match Profile 3
- [ ] Workflow install uses `npm ci --include=dev`
