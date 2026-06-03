# Issue 07: Vercel Deployment Not Live

**Config:** `vercel.json`  
**Production URL (env):** `https://koundinyapidaparhty.vercel.app` (see `PORTFOLIO_BASE_URL` in `.env.local`)

## Symptoms

- GitHub **Deployments** show **inactive** / “Canceled from the Vercel Dashboard”.
- Site may not reflect latest `main` commits (`c2963a8`, `4b5160a`, etc.).
- CI build artifact uploads `.next` but Vercel uses its own build from Git integration.

## Root cause

Deployments were **manually canceled** in Vercel — not a code failure.

## Fix

1. Open [Vercel Dashboard](https://vercel.com) → project for this repo.
2. **Deployments** → **Redeploy** latest `main` (or undo cancel).
3. Set environment variables (mirror `.env.local` production values):
   - `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (production domain)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   - SMTP, optional analytics
4. Ensure Git integration deploys on push to `main`.

## Checklist

- [ ] Production deployment **Ready**
- [ ] `/admin` login works on production domain
- [ ] Env vars set in Vercel (not only GitHub)
