# Developer Guide

A practical guide for making changes to the portfolio.

---

## Local Development Setup

```bash
# 1. Clone the repo
git clone https://github.com/koundinyapidaparthy2/koundinya-portfolio.git
cd koundinya-portfolio

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local — at minimum set NEXTAUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

# 4. Start dev server
npm run dev
# → http://localhost:3000
```

---

## Common Tasks

### Update Resume Content

Edit `data/resume.ts` directly. This is the source of truth.

```ts
// data/resume.ts
export const resumeData: Resume = {
  personalInfo: { name: "...", ... },
  experience: [ { companyName: "...", ... } ],
  // ...
};
```

Changes here take effect on the next page reload. No API call needed.

### Add a New Section to the Portfolio

1. Create `components/sections/MySection.tsx` (the rich UI)
2. Optionally create `components/sections/MySectionWrapper.tsx` (thin layout wrapper)
3. Add a new field to `Resume` type in `types/resume.ts` if needed
4. Add data to `data/resume.ts`
5. Import and render in `app/page.tsx`:

```tsx
<FadeInSection>
  <MySection />
</FadeInSection>
```

6. Add a nav link in `components/ui/Navbar.tsx`

### Add a New API Route

Create `app/api/my-route/route.ts`:

```ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ hello: "world" });
}

export async function POST(req: Request) {
  const body = await req.json();
  // ...
  return NextResponse.json({ result: "ok" });
}
```

For admin-only routes, add at the top:

```ts
import { requireAdminSession } from "@/lib/auth";

const session = await requireAdminSession();
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

### Add a New Skill Category

In `data/resume.ts`, add to the `skills` array:

```ts
{
  id: "skill-ai",
  title: "AI & ML",
  skills: ["OpenAI API", "LangChain", "Pinecone", "Hugging Face"],
},
```

### Add a New Project

In `data/resume.ts`, add to the `projects` array:

```ts
{
  id: "project-4",
  name: "My New Project",
  stack: ["React", "Node.js", "PostgreSQL"],
  date: "Jan 2026 – Present",
  description: "One-sentence description.",
  points: [
    "Achievement 1 with metrics.",
    "Achievement 2 with metrics.",
  ],
  github: "https://github.com/koundinyapidaparthy2/my-new-project",
  website: { url: "https://mynewproject.com", text: "mynewproject.com" },
},
```

### Change the Admin Password

1. Log in to `/admin`
2. Go to Settings tab
3. Enter current password + new password
4. Click "Update Password"
5. This calls `POST /api/internal/change-password` which writes a new PBKDF2 hash to `data/admin.json`

### Run Tests Before Pushing

```bash
npm test          # unit tests
npm run lint      # ESLint
npx tsc --noEmit  # TypeScript check
```

---

## Code Style

- **TypeScript strict mode** is enabled (`tsconfig.json`)
- **ESLint** with Next.js config (`.eslintrc.json`)
- Imports use the `@/` alias for the project root
- Components use named exports (not default where possible)
- Hooks prefix with `use`
- Server-only modules: never import `lib/auth.ts`, `lib/visitorStore.ts`, or `lib/emailNotification.ts` in Client Components

---

## Path Aliases

Configured in `tsconfig.json`:

```json
{
  "paths": {
    "@/*": ["./*"]
  }
}
```

Use `@/components/...`, `@/lib/...`, `@/types/...` everywhere.

---

## Key Files to Know

| File | When to edit |
|------|-------------|
| `data/resume.ts` | Changing any portfolio content |
| `app/page.tsx` | Adding/removing portfolio sections |
| `app/layout.tsx` | Changing global layout, navbar, footer |
| `app/globals.css` | Global CSS variables, Tailwind base styles |
| `lib/store.ts` | Adding new state slices or selectors |
| `types/resume.ts` | Changing data shape |
| `middleware.ts` | Changing route protection rules |
| `tailwind.config.ts` | Adding custom colors, fonts, animations |

---

## Debugging Tips

### Zustand State
Open browser DevTools → Redux DevTools extension → look for "KP Portfolio Store"

### API Routes
All route handlers log errors with a prefix like `[api/track]`. Check Vercel function logs or the local terminal.

### Next.js Server Components
Server component errors appear in the **terminal**, not the browser console. Always check both.

### Auth Issues
- Check `NEXTAUTH_SECRET` is the same across restarts
- JWT cookies are HTTP-only — inspect in DevTools → Application → Cookies
- `requireAdminSession()` logs `null` when session is missing; check terminal
