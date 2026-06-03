# Issue 04: Admin Login / NextAuth

**Pages:** `/login`, `/admin`  
**Code:** `lib/auth.ts`, `middleware.ts`, `app/login/page.tsx`

## Symptoms (fixed)

- “Invalid email or password” despite correct `.env.local` credentials.
- Login worked locally only sometimes when multiple dev servers ran on 3000/3001/3002.
- `NEXTAUTH_URL` must match the port you use (default `http://localhost:3000`).

## Root causes

| Cause | Fix |
|--------|-----|
| `ADMIN_PASSWORD='secret'` in `.env` — quotes included in comparison | `lib/env.ts` → `normalizeEnvValue()` |
| `data/admin.json` PBKDF2 hash out of date after password change | Fallback to env password in `verifyAdminPassword()` |
| `signIn` returned `ok: false` without `error` | `app/login/page.tsx` checks both |
| Duplicate imports `lib/envUtils` + `lib/env` | Removed `envUtils`; single `lib/env.ts` |

## Commits

- `c2963a8` — auth + scrape workflow env alignment

## Verify

1. Single dev server: `npm run dev` → http://localhost:3000/login  
2. Email/password from `.env.local` (Profile 3 email: `koundinyapidaparthy@gmail.com`)  
3. Redirect to `/admin` with session `role: admin`

## Checklist

- [x] Local login works on port 3000
- [ ] Production: set `NEXTAUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` in Vercel env
