# Issue 01: CI Workflow Failing

**Workflow file:** `.github/workflows/ci.yml`  
**GitHub UI name:** CI

## Symptoms

- Red X on pushes to `main` (e.g. runs for commits `c2963a8`, `4b5160a`, `e8892d5`).
- Job **Jest unit tests** fails in ~1s with `jest: command not found`, or React tests fail when `NODE_ENV=production`.
- **Cypress E2E** and **Next.js production build** jobs skipped when Jest fails.

## Root causes (historical)

| Cause | Fix commit / change |
|--------|---------------------|
| `npm ci` on runners with `NODE_ENV=production` skips `devDependencies` → no Jest | `4b5160a` — `npm ci --include=dev` on all install steps |
| React 18 tests need non-production `NODE_ENV` | `e8892d5`, `14bb912` — job-level `NODE_ENV: test` + `NODE_ENV=test npm run test:coverage` |
| ESLint unused vars in `CompaniesTab`, `Navbar`, `generate-and-store` | `885bc61` — resolved on `main` |
| `AdminThemeProvider` test expected wrong `localStorage` key | Test uses `adminTheme` (matches component) |

## Current status

- **Local:** `npm run lint`, `npm run build`, `npm run test:coverage` pass (1829 tests).
- **GitHub:** Watch the latest run for `main` after `14bb912` — Jest was green; Cypress/build may still fail for other reasons.

## How to verify

```bash
npm ci --include=dev
NODE_ENV=test npm run test:coverage
npm run build
```

## If CI still fails

1. Open the failed run → **Jest unit tests** → expand **Run Jest with coverage**.
2. If Cypress fails: ensure `wait-on` reaches `http://localhost:3000` and admin E2E secrets match `cypress.env.json`.
3. Re-run workflow from Actions tab (no code change needed if flaky).

## Checklist

- [ ] Latest CI run on `main` is green (all 3 jobs)
- [ ] `ADMIN_EMAIL` / `ADMIN_PASSWORD` optional secrets set for Cypress (or defaults in workflow)
