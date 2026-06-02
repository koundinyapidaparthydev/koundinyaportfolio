# Issue #1: All GitHub Actions Workflows Are Failing

## Summary

Every GitHub Actions workflow in this repository is failing. The CI pipeline (unit tests, E2E tests, production build) has failures, and the automated job-scraping pipelines are also failing or will fail on run.

## Affected Workflows

| Workflow | File | Status | Primary Failure Reason |
|---|---|---|---|
| **CI** | `.github/workflows/ci.yml` | **Failing** | ESLint errors break `next build`; 1 Jest test fails |
| **Scrape Jobs** | `.github/workflows/scrape-jobs.yml` | **Will fail on run** | Depends on uncommitted script changes & missing secrets |
| **Weekly Summary** | `.github/workflows/weekly-summary.yml` | **Will fail on run** | Duplicate env key + depends on secrets |

---

## Root Cause Analysis

### 1. CI Workflow — `ci.yml`

#### 1A. Build / ESLint Errors (`next build` fails)

Running `npm run build` locally produces these ESLint errors, which cause the build to exit with code 1:

```
./app/admin/_components/CompaniesTab.tsx
  324:10  Error: 'EmptyCategory' is defined but never used.  @typescript-eslint/no-unused-vars
  579:9   Warning: The 'topMatches' conditional could make the dependencies
          of useCallback Hook (at line 623) change on every render.
          react-hooks/exhaustive-deps

./app/api/internal/generate-and-store/route.ts
  86:40  Error: 'jobUrl' is assigned a value but never used.  @typescript-eslint/no-unused-eslint/no-unused-vars

./components/ui/Navbar.tsx
  39:9  Error: 'isAdminPath' is assigned a value but never used.  @typescript-eslint/no-unused-vars
```

**Impact:**
- The `build` job in `ci.yml` fails.
- The `cypress` job depends on a successful `npm run build`, so it never runs.

#### 1B. Jest Unit Test Failure

```
FAIL __tests__/admin/AdminThemeProvider.test.tsx
  AdminThemeProvider › reads theme from localStorage on mount
    Expected: "light"
    Received: "dark"
```

The test mocks `localStorage.getItem("admin-theme")` to return `"light"`, but the component's implementation likely reads `"dark"` as a fallback or has a logic bug in how it handles the initial theme value.

**Impact:**
- The `test` job in `ci.yml` fails (even though 1,825 other tests pass).

### 2. Scrape Jobs Workflow — `scrape-jobs.yml`

This workflow runs every 30 minutes and executes three Node scripts in sequence:
1. `scripts/scrape-jobs.mjs`
2. `scripts/generate-applications.mjs`
3. `scripts/auto-apply.mjs`

**Why it fails (or will fail):**

| Problem | Detail |
|---|---|
| **Uncommitted changes** | `scripts/scrape-jobs.mjs`, `scripts/generate-applications.mjs`, and `scripts/auto-apply.mjs` all have **uncommitted modifications** in the working directory. The workflow checks out the repo but does not include these local changes unless they are committed and pushed. |
| **Missing secrets** | Requires `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_RECIPIENT`, `INTERNAL_API_KEY`, `PORTFOLIO_BASE_URL`. If any are missing or malformed in GitHub Secrets, the scripts will crash. |
| **Node version mismatch** | The workflow uses Node 22, but the project's `package.json` and `ci.yml` target Node 18. This may cause dependency resolution issues. |
| **Script dependency on `@react-pdf/renderer`** | `generate-applications.mjs` appears to import or depend on PDF rendering (see `scripts/pdf-render-helper.cjs`). If this helper is not present in the checked-out repo (it's currently **untracked**), the script will fail with `MODULE_NOT_FOUND`. |

### 3. Weekly Summary Workflow — `weekly-summary.yml`

**Why it fails:**

| Problem | Detail |
|---|---|
| **Duplicate environment variable** | `WHATSAPP_RECIPIENT` is defined **twice** in the env block (lines 36 and 37). YAML parsers may raise a warning or silently overwrite, but this is a definite bug. |
| **Missing secrets** | Same secret dependency issue as `scrape-jobs.yml`. |
| **Node version mismatch** | Uses Node 20 while the project targets Node 18. |

---

## How to Fix

### Fix 1A: Resolve ESLint Errors

**File:** `app/admin/_components/CompaniesTab.tsx`
- Remove or use the `EmptyCategory` variable at line 324.
- Wrap the `topMatches` computation in `useMemo()` to stabilize dependencies for the `useCallback` at line 623.

**File:** `app/api/internal/generate-and-store/route.ts`
- Remove the unused `jobUrl` variable at line 86, or pass it to the Claude prompt / response.

**File:** `components/ui/Navbar.tsx`
- Remove the unused `isAdminPath` variable at line 39, or use it in conditional rendering logic.

### Fix 1B: Fix Jest Test

**File:** `__tests__/admin/AdminThemeProvider.test.tsx`

Investigate why the component returns `"dark"` when `"light"` is expected. Check:
- Whether `AdminThemeProvider.tsx` has a hardcoded default.
- Whether `window.matchMedia('(prefers-color-scheme: dark)')` is being mocked.
- Whether the `localStorage` mock is actually being read before the system preference.

### Fix 2: Commit All Working Directory Changes

Before any workflow can use the latest script logic, **all 17 modified files and 3 untracked files must be committed and pushed**:

```bash
git add .
git commit -m "fix: resolve ESLint errors, update scripts, add missing test files"
git push origin main
```

### Fix 3: Audit GitHub Secrets

Go to **GitHub → Settings → Secrets and variables → Actions** and verify these exist and are valid:

- [ ] `GOOGLE_SHEET_ID`
- [ ] `GOOGLE_SERVICE_ACCOUNT_JSON` (raw JSON string)
- [ ] `WHATSAPP_PHONE_NUMBER_ID`
- [ ] `WHATSAPP_ACCESS_TOKEN`
- [ ] `WHATSAPP_RECIPIENT`
- [ ] `INTERNAL_API_KEY`
- [ ] `PORTFOLIO_BASE_URL`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `ADMIN_EMAIL`
- [ ] `ADMIN_PASSWORD`

### Fix 4: Fix `weekly-summary.yml`

Remove the duplicate `WHATSAPP_RECIPIENT` line (line 37).

### Fix 5: Align Node Versions

Either:
- **Option A:** Update `ci.yml` and `weekly-summary.yml` to use Node 22 (matching `scrape-jobs.yml`).
- **Option B:** Update `scrape-jobs.yml` and `weekly-summary.yml` to use Node 18 (matching `package.json` engines and `ci.yml`).

Recommended: **Option A** if the newer scripts require Node 22 features, but update `package.json` `engines` field to declare the minimum version.

---

## Verification Steps

1. **Local build must pass:**
   ```bash
   npm run lint
   npm run build
   ```

2. **Local tests must pass:**
   ```bash
   npm test
   ```

3. **Commit and push** all changes.

4. **Trigger CI manually** via GitHub Actions tab to verify `ci.yml` goes green.

5. **Run `scrape-jobs.yml` manually** (`workflow_dispatch`) and inspect logs for script errors or secret misconfigurations.

6. **Run `weekly-summary.yml` manually** and verify it completes without YAML parsing errors.

---

## Files Involved in Fixes

| File | Action Needed |
|---|---|
| `app/admin/_components/CompaniesTab.tsx` | Remove unused `EmptyCategory`; memoize `topMatches` |
| `app/api/internal/generate-and-store/route.ts` | Remove unused `jobUrl` |
| `components/ui/Navbar.tsx` | Remove unused `isAdminPath` |
| `__tests__/admin/AdminThemeProvider.test.tsx` | Fix assertion or mock setup |
| `app/admin/_components/AdminThemeProvider.tsx` | Investigate theme initialization logic |
| `.github/workflows/weekly-summary.yml` | Remove duplicate `WHATSAPP_RECIPIENT` |
| `.github/workflows/scrape-jobs.yml` | (Optional) Align Node version |
| `scripts/scrape-jobs.mjs` | Commit uncommitted changes |
| `scripts/generate-applications.mjs` | Commit uncommitted changes |
| `scripts/auto-apply.mjs` | Commit uncommitted changes |
| `scripts/pdf-render-helper.cjs` | Add to git (currently untracked) |

---

## Severity

**High** — The CI pipeline is completely broken, which means no code changes can be safely merged. The automated job application pipeline is also non-functional until secrets are verified and scripts are committed.

## Related Documentation

- `claude/DEPLOYMENT.md` — Environment variable checklist
- `claude/TROUBLESHOOTING.md` — Common build/test failures
- `claude/TESTING.md` — Jest and Cypress setup
