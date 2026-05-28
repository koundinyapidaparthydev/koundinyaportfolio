# UI Description — Koundinya Pidaparthy Portfolio

> A single-page portfolio built with **Next.js 14 (App Router)**, **Tailwind CSS**, **shadcn/ui**, and **Framer Motion**. Default theme is **dark mode** (near-black background, indigo accent colour throughout).

---

## Global Elements

### Navbar
- **Fixed** to the top of the viewport; transparent over the hero, transitions to a dark blurred backdrop once the user scrolls more than 20 px.
- A thin **indigo scroll-progress bar** (3 px) runs along the very top of the screen and fills left-to-right as the user scrolls down the page.
- **Left** — circular indigo "KP" logo button; clicking it scrolls back to the top.
- **Centre** — navigation links: `Home`, `About`, `Skills`, `Projects`, `Resume` (PDF download icon), `Admin` (lock icon / dashboard icon depending on auth state).
- **Right** — `ThemeToggle` button (sun/moon icon).
- **Mobile** — links collapse into a hamburger menu that opens a Framer Motion slide-down drawer.

### Scroll-to-Top Button
- Appears in the bottom-left corner after scrolling; smooth-scrolls to the top on click.

### Theme
- Dark by default (`defaultTheme="dark"`, `enableSystem=false`).
- Light mode swaps background to white (`#fff`) and text to `slate-900`.
- Accent colour is `indigo-500/600` in both modes.

---

## Page Sections (top → bottom)

### 1. Hero
Full-viewport section (`min-h-screen`), dark background (`#0a0a0a` in dark, white in light).

| Element | Detail |
|---|---|
| **Particle field** | 50 floating white dots (CSS custom-property animation, deterministic positions) |
| **Radial glow** | Soft indigo ellipse centred behind the text |
| **"Open to work" badge** | Top-right pill with a pulsing green dot; fades + scales in on load |
| **Heading** | "Koundinya Pidaparthy" — staggered per-letter reveal (Framer Motion, 0.04 s stagger) |
| **Typewriter subtitle** | Cycles through roles: `Full-Stack Engineer`, `AI Systems Builder`, `MCP Server Architect`, `AWS Cloud Engineer` with an indigo mono `>` prefix and blinking cursor |
| **Bio line** | One-sentence summary from resume data, fades up with a 0.6 s delay |
| **CTA buttons** | `View my work` (indigo filled, hover shine sweep) · `Download resume` (glass/border style) |
| **Scroll indicator** | "SCROLL" label + animated chevron at the bottom |

---

### 2. About
Two-column layout (stacks to single column on mobile); fades in from opposite sides when scrolled into view.

| Column | Detail |
|---|---|
| **Left** | 200 × 200 px circular avatar (`/public/kp-avatar.svg`) with an indigo glow ring and an animated orbiting indigo dot |
| **Right** | `Full-Stack Engineer & AI Builder` heading, three bio paragraphs, three stat cards (`5+ Years experience`, `10+ Projects shipped`, `99.9% Uptime systems`) |

---

### 3. Technical Skills
Filterable badge grid.

- **Filter tabs** row at the top: `All`, `Languages`, `Frontend`, `Backend`, `Databases`, `Cloud & DevOps`, `Testing`, `Tools & Practices`.
- Selected tab has an indigo pill background; switching categories uses a Framer Motion `AnimatePresence` layout animation.
- Each skill is a **rounded pill badge** (border + subtle background).
- **Hover tooltip** shows the skill name and a filled proficiency bar (0–100 scale).
- Badges stagger in (0.03 s per badge) when the section enters the viewport.

---

### 4. Experience
Vertical timeline.

- A **centre vertical line** on desktop (left-aligned on mobile).
- Cards **alternate left/right** on desktop (single column on mobile), sliding in from their respective side via `useInView`.
- Each card contains:
  - Company name + "Current" green badge if `endDate === "Present"`
  - Role title, date range, location
  - Tech stack pills (colour-coded per technology)
  - Bullet-point achievements
- Cards have a subtle hover shadow lift and a left-border indigo highlight on current role.

---

### 5. Education
Two-column card grid.

- Clean white/dark cards with rounded corners and a drop shadow.
- Each card: institution name, graduation date, degree + field (indigo), location, GPA (indigo accent), achievement bullet points.

---

### 6. Projects
Masonry-style grid (3-col desktop → 2-col tablet → 1-col mobile).

- **Filter by tech** row — clicking a tech tag filters visible cards; Framer Motion `layout` prop animates the reflow.
- Each project card:
  - Project name + optional `Live` green badge (for deployed projects like AplifyAI)
  - Colour-coded tech pills (blue for Next.js/TypeScript, green for Node/MongoDB, purple for AI/LangChain, etc.)
  - Bullet-point highlights
  - Icon buttons: external link (live site) and GitHub repository
- Cards lift on hover with a brightened border.
- Per-card `useInView` entry animation.

---

### 7. Contact
Two-column dark section.

| Column | Detail |
|---|---|
| **Left** | Four clickable contact info cards — Email, Phone, LinkedIn, GitHub — each with an SVG icon; cards highlight on hover |
| **Right** | Contact form validated with `react-hook-form` + `zod`; fields: Name, Email, Message; submits to `POST /api/contact`; shows inline success or error toast via `AnimatePresence` |

---

## Admin Area (`/admin`)

Protected route (NextAuth middleware, `role === "admin"` required). Login page at `/login`.

### Layout
- Persistent **sidebar** on the left with tab navigation.
- **Content area** on the right; heavier tabs are lazy-loaded with a spinner.

### Tabs

| Tab | Content |
|---|---|
| **Overview** | Summary stats and recent activity |
| **Edit Resume** | Inline editor for all resume data (experience, skills, projects, education) |
| **Visitors** | Visitor analytics table / chart |
| **Settings** | Password change and other admin settings |

---

## Animations Summary

All entrance animations use `framer-motion` and fire **once** per page load (`once: true` in `useInView`).

| Pattern | Where used |
|---|---|
| Staggered letter reveal | Hero heading |
| Fade + slide up | Hero subtitle, bio, buttons; `FadeInSection` wrapper for every section |
| Fade + slide left/right | About columns, Experience timeline cards |
| Stagger badge grid | Skills section |
| Layout / `AnimatePresence` | Skills filter reflow, Projects filter reflow, Contact toast |
| Infinite rotation | Orbiting dot on the About avatar |
| Particle float | Hero background (pure CSS keyframes) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS, shadcn/ui |
| Animations | Framer Motion 12 |
| State | Zustand (resume data store) |
| Forms | react-hook-form + zod |
| Auth | NextAuth.js |
| Data fetching | TanStack Query |
| Email | Nodemailer (contact form notifications) |
| Deployment | Vercel |
