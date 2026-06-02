# Components

## Directory Layout

```
components/
├── AuroraScrollInit.tsx   # Client-only: initialises scroll-linked aurora effect
├── FadeInSection.tsx      # IntersectionObserver fade-in wrapper
├── MagneticCursor.tsx     # Custom magnetic cursor follower
├── ScrollToTop.tsx        # Floating "back to top" button
├── StoreHydrator.tsx      # Seeds Zustand store from server data on mount
├── TiltCard.tsx           # 3D tilt-on-hover card effect
├── TrackerInit.tsx        # Fires the /api/track call once on page load
├── sections/              # Portfolio page sections
└── ui/                    # Generic UI primitives
```

---

## Section Components (`components/sections/`)

Each section has two files:
- **`<Name>Section.tsx`** — thin wrapper with `id`, aria role, layout container
- **`<Name>.tsx`** — the actual rich UI with data, animations, interactions

### Hero (`Hero.tsx` / `HeroSection.tsx`)
- Receives `personalInfo` from `resumeData` as a prop
- Displays name, animated typewriter title, tagline, CTA buttons
- Contains animated background effect (aurora/gradient)
- Uses `useTypewriter` hook for the animated role titles

### About (`About.tsx` / `AboutSection.tsx`)
- Summary text, fun facts, a personal "card" layout
- Reads from `usePersonalInfo()` Zustand selector

### Skills (`Skills.tsx` / `SkillsSection.tsx`)
- Renders grouped skill categories from `useSkills()` selector
- Visual chip/badge display per skill

### Experience (`Experience.tsx` / `ExperienceSection.tsx`)
- Timeline-style layout for each job
- Reads from `useExperience()` selector
- Each entry: company, role, date range, bullet points, tech tags

### Projects (`Projects.tsx` / `ProjectsSection.tsx`)
- Card-based layout with project name, description, stack, links
- Reads from `useProjects()` selector
- Cards use `TiltCard` for interactive hover effect

### Education (`EducationSection.tsx`)
- Receives `education` prop directly (not from Zustand)
- Displays institution, degree, GPA, achievements

### Contact (`Contact.tsx` / `ContactSection.tsx`)
- React Hook Form + Zod validation
- Submits to `POST /api/contact`
- Animated success/error states

---

## Utility Components

### `FadeInSection`
```tsx
// Wraps any children; uses IntersectionObserver to trigger a CSS fade-in
// once the element scrolls into view.
<FadeInSection>
  <About />
</FadeInSection>
```
Uses the `useScrollReveal` hook internally.

### `MagneticCursor`
- Renders a custom circular cursor overlay
- Uses `mousemove` event to follow + magnetic attraction to interactive elements
- Purely cosmetic; does not affect DOM interactivity

### `AuroraScrollInit`
- Calls `useAuroraScroll()` hook on mount
- Hook attaches a `scroll` listener that drives CSS custom property `--scroll-y`
- Used by Hero background gradient to react to scroll position

### `StoreHydrator`
- Runs once in a `useEffect`
- Calls `setUser(session?.user)` to sync NextAuth session into Zustand
- Ensures SSR and client state stay in sync without hydration mismatches

### `TrackerInit`
- Runs once in a `useEffect`
- Collects: `page`, `referrer`, `screen`, `timezone`, `language`
- POSTs to `/api/track`
- Deduplicates within the same browser session

### `ScrollToTop`
- Appears after scrolling past 300px
- Smooth-scrolls back to top on click
- Animated entrance/exit with Framer Motion

### `TiltCard`
- Wraps children in a div with `onMouseMove` 3D CSS transform
- Calculates tilt angle from cursor position relative to card center
- Resets on `onMouseLeave`

---

## UI Primitives (`components/ui/`)

These are shadcn/ui-based components (or custom analogs):

| Component | Purpose |
|-----------|---------|
| `Navbar` | Responsive navigation with dark-mode toggle, active link highlighting |
| `Button` | Styled button with variants (primary, outline, ghost) |
| `Input` / `Textarea` | Form inputs with error states |
| `Badge` | Small pill for skill tags and tech stacks |
| `Card` | Base card container |
| `ThemeToggle` | Light/dark mode switch using `next-themes` |
