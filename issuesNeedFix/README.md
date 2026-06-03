# Issues Need Fix — Index

| # | Issue | Status | Doc |
|---|--------|--------|-----|
| 01 | CI workflow (Jest / Cypress / build) | **Fixed in repo** — verify on GitHub | [01-ci-workflow.md](./01-ci-workflow.md) |
| 02 | Scrape Jobs workflow | **Fixed in repo** — needs GitHub secrets | [02-scrape-jobs-workflow.md](./02-scrape-jobs-workflow.md) |
| 03 | Weekly AI Career Summary | **Fixed in repo** — needs secrets | [03-weekly-summary-workflow.md](./03-weekly-summary-workflow.md) |
| 04 | Admin login / NextAuth | **Fixed** | [04-admin-login-auth.md](./04-admin-login-auth.md) |
| 05 | Claude resume generation (Haiku) | **Fixed in repo** — needs `ANTHROPIC_API_KEY` | [05-claude-resume-generation.md](./05-claude-resume-generation.md) |
| 06 | Auto-apply (Playwright) | **Fixed in repo** — ATS + Profile 3 defaults | [06-auto-apply-playwright.md](./06-auto-apply-playwright.md) |
| 07 | Vercel deployment | **Manual** — redeploy in Vercel Dashboard | [07-vercel-deployment.md](./07-vercel-deployment.md) |
| 08 | GitHub Actions secrets | **Manual** — copy from `.env.local` | [08-github-secrets-checklist.md](./08-github-secrets-checklist.md) |
| 09 | PersonalService + Ai integration | **Partial** — email sync script added | [09-integrations-personalservice-ai.md](./09-integrations-personalservice-ai.md) |

## What was fixed in code

- `npm ci --include=dev` in CI, scrape, weekly, Vercel install
- `NODE_ENV=test` for Jest/Cypress; `wait-on` devDependency
- Shared `scripts/lib/load-env.mjs`, `pipeline-env.mjs`, `applicant-profile.mjs`
- `scripts/validate-pipeline-env.mjs` + preflight steps in workflows
- Claude model via `ANTHROPIC_MODEL`; better API error messages
- Auto-apply: Profile 3 email, React form events, workflow applicant defaults
- `scripts/sync-job-emails.mjs` — Profile 3 Gmail → sheet Notes (column M)

## Commands

```bash
npm run job:validate-env          # check generate-stage env
npm run job:scrape
npm run generate:resumes:test
npm run auto:apply:dry
npm run job:sync-emails           # needs PERSONAL_SERVICE_CONFIG
```

## Still requires you

1. [08-github-secrets-checklist.md](./08-github-secrets-checklist.md) — paste secrets in GitHub Actions  
2. [07-vercel-deployment.md](./07-vercel-deployment.md) — redeploy production  
3. Run **Scrape Jobs** manually once secrets are set
