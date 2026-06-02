# Custom Hooks

All hooks live in the `hooks/` directory.

---

## `useTypewriter`

**File**: `hooks/useTypewriter.ts`

Animates through an array of strings, simulating a typewriter effect.

```ts
const text = useTypewriter({
  words: ["Full Stack Engineer", "React Developer", "TypeScript Enthusiast"],
  typeSpeed: 80,      // ms per character
  deleteSpeed: 40,    // ms per character on delete
  pauseMs: 1500,      // pause at end of each word
});
```

**Returns**: `string` — the current visible substring

**Used by**: `Hero.tsx` for the animated role title below the name.

**Algorithm**:
1. Type characters one-by-one until full word is shown
2. Pause for `pauseMs`
3. Delete characters one-by-one
4. Advance to next word (cyclic)

---

## `useScrollReveal`

**File**: `hooks/useScrollReveal.ts`

Returns a `ref` and a `isVisible` boolean. Uses `IntersectionObserver` to detect when an element enters the viewport.

```ts
const { ref, isVisible } = useScrollReveal({ threshold: 0.15 });

return (
  <div ref={ref} className={isVisible ? "fade-in" : "fade-hidden"}>
    ...
  </div>
);
```

**Used by**: `FadeInSection` wrapper component.

**Disconnects** the observer after the element becomes visible (one-shot animation).

---

## `useAuroraScroll`

**File**: `hooks/useAuroraScroll.ts`

Attaches a `scroll` event listener and sets `--scroll-y` on `:root` as a CSS custom property.

```ts
// In AuroraScrollInit.tsx:
useAuroraScroll();
```

Allows CSS to read `var(--scroll-y)` for scroll-driven parallax effects in the Hero background.

**Cleanup**: Removes the event listener on component unmount.

---

## `useResume`

**File**: `hooks/useResume.ts`

A higher-level hook combining multiple Zustand selectors and the `/api/resume` API for the admin editor flow.

```ts
const {
  resume,
  isEditing,
  isDirty,
  save,        // PATCH /api/resume
  discard,     // resetToSaved()
  undo,
  redo,
  canUndo,
  canRedo,
} = useResume();
```

Internally coordinates between:
- `useResumeHistoryStore` (undo/redo)
- `useStore` (live resume state)
- `fetch PATCH /api/resume` (persistence)

---

## `useAdminGuard`

**File**: `hooks/useAdminGuard.ts`

Client-side route guard for admin-only UI. Redirects to `/` if the user is not admin.

```ts
// In admin client components:
useAdminGuard();
```

Uses `useIsAdmin()` from Zustand + Next.js router `push("/")`.

> **Note**: This is a secondary guard. The primary protection is `middleware.ts` which runs server-side. This hook just prevents a brief flash of admin UI on client navigation.
