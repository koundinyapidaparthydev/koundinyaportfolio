# Dependencies

## Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.2.35 | Core framework (App Router) |
| `react` | ^18 | UI library |
| `react-dom` | ^18 | React DOM renderer |
| `typescript` | ^5 | Type safety |
| `next-auth` | ^4.24.14 | Authentication (JWT, CredentialsProvider) |
| `next-themes` | ^0.4.6 | Dark/light mode |
| `zustand` | ^5.0.13 | Client state management |
| `immer` | ^11.1.8 | Immutable state updates |
| `framer-motion` | ^12.40.0 | Animations |
| `tailwindcss` | ^3.4.1 | Utility CSS framework |
| `react-hook-form` | ^7.76.0 | Form state management |
| `@hookform/resolvers` | ^5.4.0 | Zod integration for react-hook-form |
| `zod` | ^4.4.3 | Schema validation |
| `nodemailer` | ^7.0.13 | Email sending (Gmail) |
| `@react-pdf/renderer` | ^4.5.1 | PDF generation |
| `@anthropic-ai/sdk` | ^0.100.1 | Anthropic Claude API |
| `@google-cloud/storage` | ^7.19.0 | Google Cloud Storage uploads |
| `googleapis` | ^173.0.0 | Google APIs client |
| `@tanstack/react-query` | ^5.100.11 | Server state management / caching |
| `@dnd-kit/core` | ^6.3.1 | Drag & drop base |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable list DnD |
| `@dnd-kit/utilities` | ^3.2.2 | DnD utilities |
| `lucide-react` | ^1.16.0 | Icon library |
| `shadcn` | ^4.8.0 | Component library CLI |
| `clsx` | ^2.1.1 | Conditional class names |
| `tailwind-merge` | ^3.6.0 | Merge Tailwind classes intelligently |
| `class-variance-authority` | ^0.7.1 | Typed component variants |
| `@base-ui/react` | ^1.5.0 | Headless UI primitives |
| `tw-animate-css` | ^1.4.0 | Tailwind animation utilities |

---

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `jest` | ^30.4.2 | Unit test runner |
| `jest-environment-jsdom` | ^30.4.1 | Browser DOM for Jest |
| `@testing-library/react` | ^16.3.2 | Component testing |
| `@testing-library/jest-dom` | ^6.9.1 | DOM matchers |
| `@testing-library/user-event` | ^14.6.1 | User interaction simulation |
| `cypress` | ^13.17.0 | E2E browser testing |
| `playwright` | ^1.60.0 | Cross-browser E2E testing |
| `@babel/preset-env` | ^7.29.5 | Babel transform for Jest |
| `@babel/preset-react` | ^7.28.5 | Babel JSX transform for Jest |
| `eslint` | ^8 | Linting |
| `eslint-config-next` | 14.2.35 | Next.js ESLint rules |
| `postcss` | ^8 | CSS processing |
| `ts-node` | ^10.9.2 | TypeScript execution |

---

## Notable Design Decisions

### Why Zustand over Redux?
- Much less boilerplate for a single-user portfolio
- Works seamlessly with Immer for immutable updates
- Built-in `persist` middleware for localStorage sync
- Smaller bundle size

### Why `@react-pdf/renderer` over Puppeteer?
- No headless browser needed (faster cold start on Vercel serverless)
- Declarative React-based PDF layout
- Smaller function memory footprint

### Why NextAuth CredentialsProvider?
- Simple single-admin use case — no OAuth provider needed
- Keeps credentials entirely server-side (PBKDF2 hash)
- JWT strategy avoids any database dependency

### Why Nodemailer + Gmail?
- Zero infrastructure cost (free Gmail + App Password)
- Sufficient for low-volume personal portfolio alerts
- Can be swapped for SendGrid/Resend by changing the transporter config

### Why file-based storage over a database?
- Eliminates external service dependency for a personal portfolio
- Sufficient for the traffic volume
- Trade-off: not suitable for serverless environments with persistent writes (Vercel)

---

## Upgrade Notes

### Next.js 14 → 15
- `async` Server Components will need `await` on params/searchParams
- Route Handler API changes for dynamic segments

### Zustand v4 → v5
- `createStore` API changed — the project already uses v5 patterns

### NextAuth v4 → v5 (Auth.js)
- Complete API overhaul — migration guide at authjs.dev
- Currently pinned to v4 for stability
