# Testing

## Test Stack

| Tool | Purpose |
|------|---------|
| **Jest** | Unit & integration test runner |
| **React Testing Library** | Component testing utilities |
| **@testing-library/user-event** | Simulates real user interactions |
| **jest-environment-jsdom** | Browser-like DOM environment for Jest |
| **Cypress** | End-to-end (e2e) browser tests |
| **Playwright** | Additional e2e / cross-browser testing |

---

## Running Tests

```bash
# Unit tests
npm test

# Unit tests with coverage report
npm run test:coverage

# Watch mode (re-runs on file changes)
npm run test:watch

# Cypress — open interactive GUI
npm run cypress:open

# Cypress — headless with Electron
npm run cypress:run

# Cypress — headless with Chrome
npm run cypress:run:headless

# Cypress — both browsers
npm run cypress:run:all
```

---

## Jest Configuration

**Config file**: `jest.config.ts`

Key settings:
- `testEnvironment: 'jsdom'`
- Path aliases (`@/`) mapped to match `tsconfig.json`
- Module name mapper handles CSS imports (via `__mocks__`)
- Coverage collected from `lib/`, `components/`, `hooks/`

**Setup file**: `jest.setup.ts`
- Imports `@testing-library/jest-dom` for DOM matchers

---

## Test Organization

```
__tests__/          # Jest unit tests
__mocks__/          # Module mocks (CSS, assets)
cypress/
├── e2e/            # Cypress e2e specs
├── fixtures/       # Test data files
└── support/        # Commands and global setup
```

---

## What to Test

### Unit Tests (Jest)
- `lib/atsScoring.ts` — `calculateAtsScore()` with varied job descriptions
- `lib/visitorStore.ts` — `detectBrowser()`, `detectOS()` with sample UA strings
- `lib/auth.ts` — `verifyPbkdf2Hash()`, `timingSafeEqual()`
- `lib/schemas.ts` — Zod validation schemas (valid + invalid inputs)
- Zustand store actions (login, logout, updateExperience, undo/redo)
- `FadeInSection` — renders children, applies visible class after observer fires
- `TiltCard` — correct CSS transform on mouse move
- `Contact` form — validation errors, submit success/failure states

### E2E Tests (Cypress)
- Portfolio page loads and all sections are visible
- Contact form submits successfully
- Navbar links scroll to correct sections
- Dark mode toggle persists preference
- Admin login → redirect to `/admin`
- Admin logout → redirect to `/login`
- Visitor tracking fires on page load (network request intercepted)

---

## Coverage Targets

The project targets **80%+ coverage** on critical paths:
- Authentication logic
- ATS scoring algorithm
- Zustand store mutations
- Form validation schemas

---

## Mocking Conventions

### Next.js Router
```ts
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
}));
```

### Zustand Store
```ts
jest.mock('@/lib/store', () => ({
  useIsAdmin: () => true,
  useResume: () => mockResume,
  // ...
}));
```

### Fetch / API calls
Use `jest.spyOn(global, 'fetch')` or `msw` (Mock Service Worker) for API mocking.

---

## Cypress Configuration

**Config file**: `cypress.config.ts`

- `baseUrl`: reads from `cypress.env.json` or defaults to `http://localhost:3000`
- Spec pattern: `cypress/e2e/**/*.cy.{ts,tsx}`

**`cypress.env.json`** holds local-only env vars like `ADMIN_EMAIL` and `ADMIN_PASSWORD` for e2e login tests (not committed to git).
