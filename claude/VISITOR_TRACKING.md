# Visitor Tracking System

## How It Works

The portfolio tracks every page visit and notifies the owner by email. The system has three parts:

1. **Client** — `TrackerInit` component fires a POST request on mount
2. **Server** — `/api/track` route handler processes and stores the visit
3. **Email** — `sendVisitorNotification()` sends a styled alert to Gmail

---

## `TrackerInit` (Client Component)

**File**: `components/TrackerInit.tsx`

Mounted once in `app/layout.tsx` (inside the `<Providers>` tree).

```ts
// What it collects client-side:
{
  page: window.location.pathname,
  referrer: document.referrer || "direct",
  screen: `${window.screen.width}x${window.screen.height}`,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  language: navigator.language,
}
```

It deduplicates within a browser session so a user refreshing the page doesn't generate multiple records per session.

---

## `/api/track` Route Handler

**File**: `app/api/track/route.ts`

### IP Extraction Priority
1. `CF-Connecting-IP` (Cloudflare)
2. `X-Forwarded-For` (first address in list)
3. `X-Real-IP`
4. `::1` fallback (local)

### Geo Extraction (Vercel Headers)
When deployed to Vercel, the platform injects geo headers:
- `x-vercel-ip-country` → `country`
- `x-vercel-ip-city` → `city`

### User-Agent Parsing
`lib/visitorStore.ts` contains the parsing logic:

```ts
detectDevice(ua)  → "Desktop" | "Mobile" | "Tablet"
detectBrowser(ua) → "Chrome 148" | "Firefox 127" | "Safari 17" | "Edge" | "Bot" | "Other"
detectOS(ua)      → "Windows 10/11" | "macOS" | "iOS" | "Android" | "Linux" | "ChromeOS"
```

Browser detection order (important — Edge UA contains "Chrome"):
1. Edge
2. Opera
3. Chrome
4. Firefox
5. Safari
6. IE
7. Known bots

---

## `data/visitors.json`

**Format**: Array of `VisitorEntry` objects, newest first.

**Max size**: 500 entries (oldest entries dropped when cap is exceeded).

**Write strategy**: Atomic — writes to a `.tmp` file then renames, preventing partial-write corruption.

**Vercel note**: Vercel's filesystem is read-only in production. Writes silently fail with a `console.warn`. The site does not crash.

---

## Email Notification

**File**: `lib/emailNotification.ts`

### Template
Styled HTML email with:
- Dark gradient header "New Portfolio Visit 🎉"
- Timestamp (Eastern Time)
- Approximate location (via ip-api.com)
- Device type
- Raw IP address (in footer)

### Location Lookup
Uses the free [ip-api.com](http://ip-api.com) service:
- No API key required
- Rate limit: 45 req/min
- 4-second timeout
- Private/local IPs return "Local / Private Network" without making a request

### Private IP Ranges Excluded
```
::1, 127.x, 10.x, 192.168.x, 172.16-31.x, ::ffff:127.x
```

### Error Handling
All errors in `sendVisitorNotification()` are swallowed. A mail failure never affects the visitor's experience.

---

## Admin View

The `/admin` page fetches visitor data from `GET /api/visitors` and displays it in a sortable table. Only users with `role === "admin"` can access this endpoint.

---

## Sequence Diagram

```
Browser                   Next.js Server              Gmail
   │                           │                        │
   │──── page loads ──────────▶│                        │
   │                           │                        │
   │──── POST /api/track ─────▶│                        │
   │     { page, referrer,     │                        │
   │       screen, timezone }  │                        │
   │                           │─── appendVisitor() ──▶ data/visitors.json
   │                           │                        │
   │                           │─── getApproxLocation() → ip-api.com
   │                           │                        │
   │                           │─── sendVisitorNotification() ─────────▶│
   │                           │                        │  "New Portfolio Visit 🎉"
   │◀─── { ok: true } ────────│                        │
```
