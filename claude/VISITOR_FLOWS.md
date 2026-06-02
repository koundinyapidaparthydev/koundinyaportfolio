# Visitor Flows

Complete documentation of every flow a public visitor goes through on the portfolio.

---

## Flow 1 — Initial Page Load

```
Visitor opens https://koundinyapidaparthy.com
   │
   ▼
Next.js serves app/page.tsx (Server Component)
   │
   ▼
Metadata injected: title, description, OG image, canonical URL
   │
   ▼
Client hydration:
  - SessionProvider (NextAuth)
  - ThemeProvider (next-themes → dark/light)
  - QueryClientProvider (TanStack)
  - ZustandProvider (loads resume data into store)
   │
   ▼
Visitor sees the full single-page portfolio:
  Hero → About → Experience → Skills → Projects → Contact
```

### Scroll Reveals

As the visitor scrolls:
```
FadeInSection wrapper on each section
   │
   ▼
IntersectionObserver fires at 15% visibility
   │
   ▼
CSS: opacity-0 translate-y-8 → opacity-100 translate-y-0
Duration: 700ms ease-out
One-shot (observer disconnects after first trigger)
```

### Aurora Scroll Effect

```
useAuroraScroll() hook fires on every scroll event
   │
   ▼
Sets --scroll-y CSS variable on document.documentElement
   │
   ▼
Hero background gradient shifts position:
  background-position: 0 calc(var(--scroll-y) * 0.3px)
  → subtle parallax effect on the hero gradient
```

---

## Flow 2 — Magnetic Cursor Interaction

```
Visitor moves mouse
   │
   ▼
MagneticCursor component's rAF loop runs at 60fps
   │
   ▼
lerp(currentX, mouseX, 0.15) → smooth cursor lag
   │
   ▼
Visitor hovers over element with [data-magnetic]
   │
   ▼
Cursor is pulled toward the element's center
   │
   ▼
mix-blend-mode: difference creates inversion visual effect
```

Disabled on mobile (pointer: coarse detection).

---

## Flow 3 — Typewriter Effect (Hero Section)

```
Page loads → Hero section visible
   │
   ▼
useTypewriter hook starts with words[0]
   │
   ▼
State machine:
  "typing" phase:
    - Add character every 80ms
    - Until full word is visible
   │
  "pausing" phase:
    - Wait 1500ms
   │
  "deleting" phase:
    - Remove character every 40ms
    - Until word is empty
   │
  Back to "typing" with next word
   │
   ▼
Loop through:
  "Full Stack Engineer"
  "React Developer"
  "TypeScript Enthusiast"
  ...
```

---

## Flow 4 — 3D Tilt Card (Projects Section)

```
Visitor moves mouse over a project card
   │
   ▼
mousemove event on TiltCard
   │
   ▼
rotateX = ((mouseY - cardCenterY) / cardHeight) * maxTilt
rotateY = ((mouseX - cardCenterX) / cardWidth) * maxTilt
   │
   ▼
CSS transform: perspective(1000px) rotateX(Xdeg) rotateY(Ydeg)
   │
   ▼
Visitor moves mouse away (mouseleave)
   │
   ▼
Transform resets to rotateX(0) rotateY(0) with CSS transition
```

---

## Flow 5 — Contact Form Submission

```
Visitor fills Contact section form:
  - Name (min 2 chars)
  - Email (valid format)
  - Subject (optional)
  - Message (min 10 chars)
   │
   ▼
Zod schema validates client-side on submit
   │
   ├─ Validation fails → field-level error messages appear
   │
   └─ Valid → POST /api/contact
                  { name, email, subject, message }
                       │
                       ▼
                  Nodemailer sends email via SMTP:
                    From: Portfolio Contact <smtp_user>
                    To: koundinyapidaparthy@gmail.com
                    Reply-To: visitor's email
                    Subject: [Portfolio] <subject or "Message from <name>">
                    Body: HTML formatted message
                       │
                       ├─ Sent OK → { success: true } → success toast shown
                       └─ Failed → { error: "..." } → error toast shown
```

---

## Flow 6 — Visitor Tracking (Background)

```
Visitor opens any page on the portfolio
   │
   ▼
useEffect in TrackingProvider (or app/layout.tsx) fires
   │
   ▼
POST /api/track
  {
    page: window.location.pathname,
    referrer: document.referrer,
    language: navigator.language,
    screen: "1440x900",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }
   │
   ▼
Server extracts:
  - IP from x-forwarded-for / x-real-ip / socket.remoteAddress
  - Device type from user-agent (Desktop / Mobile / Tablet)
  - Browser name from user-agent
  - OS from user-agent
  - Country/City from ip-api.com (external free service)
   │
   ▼
VisitorEntry saved to data/visitors.json (local dev)
                              OR
              logged to console warning (Vercel production — read-only FS)
   │
   ▼
If EMAIL_PASSWORD configured:
  Nodemailer sends real-time notification email to koundinyapidaparthy@gmail.com:
  Subject: "New visitor on your portfolio"
  Body: IP, Device, Browser, Country, Page, Time
```

---

## Flow 7 — Dark / Light Mode Toggle

```
Visitor sees toggle button in Navbar
   │
   ▼
Default: system preference (prefers-color-scheme)
   │
   ▼
Visitor clicks toggle
   │
   ▼
next-themes setTheme() called
   │
   ▼
"dark" class toggled on <html> element
localStorage["theme"] updated to "light" or "dark"
   │
   ▼
All Tailwind dark: variants update instantly
   │
   ▼
No flash on subsequent loads:
  next-themes injects inline script before paint to read localStorage
  suppressHydrationWarning on <html> prevents React mismatch
```

---

## Flow 8 — Navigation (Navbar)

```
Visitor sees fixed Navbar at top
   │
   ▼
Links: About | Experience | Skills | Projects | Contact
   │
   ▼
Clicking a link:
  href="#about" → scrolls to section with scroll-behavior: smooth
   │
   ▼
Navbar highlights active section based on scroll position
(IntersectionObserver on section elements)
```

**Mobile**: Navbar collapses to hamburger menu. Clicking opens slide-in drawer with nav links.

---

## Flow 9 — Scroll to Top

```
Visitor scrolls down 300+ pixels
   │
   ▼
ScrollToTop button appears:
  Framer Motion AnimatePresence → fade + slide up animation
   │
   ▼
Visitor clicks the button
   │
   ▼
window.scrollTo({ top: 0, behavior: 'smooth' })
   │
   ▼
Button disappears when scroll position < 300px
```

---

## Flow 10 — Resume Download (Public)

```
Visitor clicks "Download Resume" button
   │
   ▼
GET /api/resume/pdf
  (public endpoint — no auth required)
   │
   ▼
Server generates PDF from current resume data
   │
   ▼
Browser receives PDF with:
  Content-Disposition: attachment; filename="Koundinya_Pidaparthy_Resume.pdf"
   │
   ▼
OS default PDF viewer opens or Save dialog appears
```

---

## Performance Characteristics

| Metric | Target |
|--------|--------|
| LCP (hero section) | < 2.5s |
| CLS | < 0.1 |
| FID/INP | < 200ms |
| Page weight | < 300KB JS (code-split) |
| PDF generation | < 5s (serverless) |
| Tracking call | < 500ms (non-blocking, fire-and-forget) |

The tracking `POST /api/track` does not block the page render — it fires in a `useEffect` after hydration.
