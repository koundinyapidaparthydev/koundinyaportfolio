# Animations & UI Effects

## Library

**Framer Motion** (`framer-motion` v12) is the primary animation library. CSS transitions are used for simple hover states.

---

## Fade-In on Scroll

**Component**: `FadeInSection`  
**Hook**: `useScrollReveal`

```tsx
// Usage in app/page.tsx:
<FadeInSection>
  <About />
</FadeInSection>
```

**Implementation**:
- `IntersectionObserver` with `threshold: 0.15` (fires when 15% of the element is visible)
- Applies CSS classes: `opacity-0 translate-y-8` → `opacity-100 translate-y-0`
- Transition: `transition-all duration-700 ease-out`
- Observer disconnects after first trigger (one-shot)

---

## Magnetic Cursor

**Component**: `MagneticCursor`

A custom circular cursor overlay that follows the mouse with smooth lag:

```
Mouse position ──► lerp() ──► cursor position
```

**Magnetic attraction**: Elements with `data-magnetic` attribute pull the cursor toward them on hover.

**Implementation**:
- `requestAnimationFrame` loop for smooth 60fps interpolation
- `lerp(current, target, 0.15)` — 15% interpolation factor per frame
- `mix-blend-mode: difference` for the cursor's visual effect
- Hidden on mobile (pointer: coarse)

---

## Aurora Scroll Effect

**Component**: `AuroraScrollInit`  
**Hook**: `useAuroraScroll`

Sets `--scroll-y` CSS custom property on `document.documentElement` on every scroll event:

```css
/* In Hero's background element: */
background-position: 0 calc(var(--scroll-y) * 0.3px);
```

Creates a subtle parallax effect on the Hero gradient background.

---

## Typewriter Effect

**Hook**: `useTypewriter`

Animates through an array of role titles:
- `["Full Stack Engineer", "React Developer", "TypeScript Enthusiast", ...]`

States: `typing` → `pausing` → `deleting` → `typing` (next word)

```ts
const { text } = useTypewriter({
  words: rolesList,
  typeSpeed: 80,
  deleteSpeed: 40,
  pauseMs: 1500,
});
```

---

## 3D Tilt Card

**Component**: `TiltCard`

On `mousemove`, calculates tilt angles:

```ts
const rotateX = ((y - centerY) / height) * maxTilt;  // vertical tilt
const rotateY = ((x - centerX) / width) * maxTilt;   // horizontal tilt
```

Applied as CSS `transform: perspective(1000px) rotateX() rotateY()`.

Reset to `rotateX(0) rotateY(0)` on `mouseleave` with transition.

**Used by**: Project cards in the Projects section.

---

## Page Transition Animations

Portfolio sections use Framer Motion `variants` for staggered entrance:

```tsx
// Example pattern in section components:
const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

<motion.div variants={container} initial="hidden" animate="show">
  {items.map(item => (
    <motion.div key={item.id} variants={item} />
  ))}
</motion.div>
```

---

## Scroll-To-Top Button

**Component**: `ScrollToTop`

- Appears with a Framer Motion `AnimatePresence` fade+slide after scrolling 300px
- `window.scrollTo({ top: 0, behavior: 'smooth' })` on click

---

## Dark Mode

**Library**: `next-themes`

- Default: system preference
- Toggle: `ThemeToggle` button in Navbar
- Stored in `localStorage` as `theme: "light" | "dark"`
- Root HTML class `dark` is applied, enabling Tailwind's `dark:` variants

**No flash of wrong theme**: `suppressHydrationWarning` on `<html>` + `next-themes`'s script injection prevents FOUC.

---

## Hover States (CSS)

Standard Tailwind hover utilities used throughout:

```css
/* Link hover */
hover:text-indigo-600 transition-colors duration-200

/* Button hover */
hover:bg-indigo-700 hover:shadow-lg transition-all duration-200

/* Card hover */
hover:-translate-y-1 hover:shadow-xl transition-transform duration-300
```

---

## Performance Considerations

- All Framer Motion animations respect `prefers-reduced-motion` via `useReducedMotion()`
- Heavy animations (MagneticCursor, AuroraScroll) are disabled or simplified on mobile
- `FadeInSection` avoids layout shift by using `opacity` + `transform` (compositor-only properties)
