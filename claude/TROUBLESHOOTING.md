# Troubleshooting

Common issues and how to fix them.

---

## Local Development

### `Error: NEXTAUTH_SECRET is not set`

**Fix**: Add to `.env.local`:
```
NEXTAUTH_SECRET=any-random-string-at-least-32-chars
```
Generate one: `openssl rand -base64 32`

---

### Login always fails

**Possible causes**:
1. `ADMIN_EMAIL` or `ADMIN_PASSWORD` not set in `.env.local`
2. Mismatched email (check exact case)
3. `data/admin.json` has a stale PBKDF2 hash from a different password

**Fix**: Delete `data/admin.json` (or set `passwordHash: null`) to fall back to the env var plaintext password.

---

### Emails not being sent

**Possible causes**:
1. `EMAIL_PASSWORD` not set (silently skipped)
2. "Less secure app" access not enabled — **use an App Password instead**
3. Gmail 2FA not enabled (App Passwords require 2FA)

**Fix**:
1. Enable 2-Step Verification on your Google account
2. Go to Security → App Passwords
3. Create a new App Password for "Mail"
4. Set `EMAIL_PASSWORD=<generated 16-char password>` in `.env.local`

---

### PDF download returns 500

**Possible causes**:
1. `@react-pdf/renderer` has render issues with certain Unicode characters (emoji)
2. Font not available

**Fix**: Check the terminal for the specific error. Remove emoji from resume content if they're causing the issue.

---

### `visitors.json` not being updated

**Possible causes**:
1. Running on Vercel (read-only filesystem — expected behaviour)
2. File permission issue on local machine

**Fix (local)**: `chmod 644 data/visitors.json`

**Fix (production)**: This is expected on Vercel. To fix permanently, migrate to Vercel KV or a database.

---

### AI tailoring returns `503 AI tailoring not configured`

**Fix**: Add `ANTHROPIC_API_KEY` to your `.env.local`.

---

### Hydration mismatch errors in dev

**Common causes**:
1. `useStore` being called outside a Client Component
2. `next-themes` not configured with `suppressHydrationWarning`

**Fix**: Ensure `suppressHydrationWarning` is on the `<html>` tag in `layout.tsx` (already set). Clear `.next/` cache:
```bash
rm -rf .next
npm run dev
```

---

### `Module not found: @/...` error

**Fix**: Ensure `tsconfig.json` has the path alias:
```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./*"] }
  }
}
```
Then restart the dev server.

---

## TypeScript Errors

### `Type '...' is not assignable to type 'Resume'`

The `Resume` type in `types/resume.ts` is strict. If you added a new required field, update `data/resume.ts` to include it.

### NextAuth type errors after adding `role`

Ensure the `declare module "next-auth"` block in `lib/auth.ts` is included (it extends the Session and JWT interfaces).

---

## Production (Vercel)

### `getServerSession()` returns `null` on Vercel

**Cause**: `NEXTAUTH_URL` not set or incorrect.

**Fix**: Set `NEXTAUTH_URL=https://yourdomain.com` in Vercel environment variables.

### Admin login works locally but not on Vercel

**Cause**: `ADMIN_EMAIL` / `ADMIN_PASSWORD` not set in Vercel env vars, or `NEXTAUTH_SECRET` differs between local and prod.

**Fix**: Verify all three are set in Vercel Dashboard → Project → Settings → Environment Variables (Production scope).

### Function timeout on `/api/resume/tailor`

Claude can take 5–15 seconds for complex rewrites. Vercel Hobby plan has a 10s timeout.

**Fix**: Upgrade to Vercel Pro (60s limit) or implement streaming with `ReadableStream`.

---

## Testing

### Jest: `Cannot find module '@/...'`

**Fix**: Ensure `moduleNameMapper` in `jest.config.ts` maps `@/(.*)` to `<rootDir>/$1`.

### Cypress: `baseUrl` connection refused

**Fix**: Start the dev server first:
```bash
npm run dev
# Then in another terminal:
npm run cypress:open
```

---

## Common Mistakes

| Mistake | Correct Pattern |
|---------|----------------|
| Importing `lib/auth.ts` in a Client Component | Only use in Server Components or Route Handlers |
| Importing `lib/visitorStore.ts` in a Client Component | Server-only — only use in Route Handlers |
| Reading `process.env.*` without `NEXT_PUBLIC_` prefix in client code | Use `NEXT_PUBLIC_` prefix for client-accessible vars |
| Mutating Zustand state directly without `set()` | Always use `set(state => { state.x = y })` inside actions |
| Forgetting to call `push(currentResume)` before editing in admin | History won't be recorded; undo won't work |
