# Authentication & Authorization

## Overview

Authentication is handled by **NextAuth v4** with a `CredentialsProvider`. There is a single admin user; no public user registration exists.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXTAUTH_SECRET` | Yes | Random secret for signing JWTs |
| `NEXTAUTH_URL` | Yes (prod) | Full URL e.g. `https://koundinyapidaparthy.com` |
| `ADMIN_EMAIL` | Yes | Email address for the admin account |
| `ADMIN_PASSWORD` | Yes | Plaintext password (fallback if no PBKDF2 hash stored) |

---

## How Passwords Are Stored

The system supports two password storage methods:

### 1. Environment Variable (Default)
`ADMIN_PASSWORD` env var holds the plaintext password. Used on first login or when `data/admin.json` has no hash.

### 2. PBKDF2 Hash (Secure)
After the admin sets a new password via the admin dashboard, a **PBKDF2-SHA512** hash is stored in `data/admin.json`:

```json
{
  "passwordHash": "<salt>:<hex-hash>"
}
```

During login, `lib/auth.ts` reads this file and verifies using:
```ts
pbkdf2Sync(password, salt, 100_000, 64, "sha512")
```

Comparison uses `crypto.timingSafeEqual` to prevent timing attacks.

---

## Login Flow

```
POST /api/auth/callback/credentials
  { email, password }
        │
        ▼
  CredentialsProvider.authorize()
        │
        ├─ Check ADMIN_EMAIL match (timingSafeEqual)
        ├─ Check password:
        │    if admin.json has hash → verifyPbkdf2Hash()
        │    else → timingSafeEqual(password, ADMIN_PASSWORD)
        │
        ▼
  Success → { id: "admin-1", name, email, role: "admin" }
        │
        ▼
  jwt() callback → token.role = "admin", token.id = "admin-1"
        │
        ▼
  session() callback → session.user.role = "admin"
        │
        ▼
  HTTP-only cookie set (JWT strategy, 24h)
```

---

## Route Protection

### `middleware.ts`
Runs on every request matching `/admin/:path*`:

```ts
export const config = {
  matcher: ["/admin/:path*"],
};
```

Logic:
1. No JWT token → redirect to `/login?callbackUrl=<originalPath>`
2. Token exists but `role !== "admin"` → redirect to `/`
3. Token with `role === "admin"` → allow through

### Server-Side Guard
API route handlers that perform admin mutations call:

```ts
import { requireAdminSession } from "@/lib/auth";

const session = await requireAdminSession();
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

### Client-Side Guard
The `useAdminGuard` hook redirects non-admin users away from client-only admin UI:

```ts
// hooks/useAdminGuard.ts
const isAdmin = useIsAdmin();
// → redirect to "/" if !isAdmin
```

---

## Session Type Extensions

NextAuth types are extended in `lib/auth.ts`:

```ts
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "admin" | "viewer";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "viewer";
    id?: string;
  }
}
```

---

## Security Notes

- Password comparison always uses constant-time comparison to prevent timing attacks
- The PBKDF2 hash uses 100,000 iterations with SHA-512
- JWT session cookie is HTTP-only and expires after 24 hours
- The admin route is protected at the middleware layer (server-side), not just in UI
- `ADMIN_PASSWORD` in env is a fallback; production should use PBKDF2 hashes
- Email and password are **never logged**
