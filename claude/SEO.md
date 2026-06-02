# SEO & Metadata

## Strategy

This portfolio uses Next.js 14's built-in **Metadata API** for all SEO concerns. No third-party SEO libraries are used.

---

## Root Metadata (`app/layout.tsx`)

```ts
export const metadata: Metadata = {
  metadataBase: new URL("https://koundinyapidaparthy.com"),
  title: {
    default: "Koundinya Pidaparthy — Full Stack Engineer",
    template: "%s | Koundinya Pidaparthy",  // child pages insert their title
  },
  description: "Portfolio of Koundinya Pidaparthy — Full Stack Software Engineer specializing in React, Next.js, Node.js, and AI-powered applications.",
  keywords: ["Koundinya Pidaparthy", "Full Stack Engineer", "React", "Next.js", "TypeScript", "Software Engineer Portfolio"],
  authors: [{ name: "Koundinya Pidaparthy", url: "https://koundinyapidaparthy.com" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Koundinya Pidaparthy Portfolio",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@koundinyap",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: {
    canonical: "https://koundinyapidaparthy.com",
  },
};
```

---

## Open Graph Image (`app/opengraph-image.tsx`)

Next.js auto-discovers this file and serves it as the `og:image`.

- Renders a styled React component to a PNG via `ImageResponse`
- Shows the name, title, and branding
- Dimensions: **1200 × 630** (standard OG image size)

---

## Favicon / App Icon (`app/icon.tsx`)

Rendered dynamically using `ImageResponse`. Displays the "KP" monogram on an indigo background.

---

## Robots (`app/robots.ts`)

```ts
// Allows all crawlers, points to sitemap
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://koundinyapidaparthy.com/sitemap.xml",
  };
}
```

---

## Sitemap (`app/sitemap.ts`)

Generates a `sitemap.xml` with the main pages:
- `/` (priority 1.0)
- Any additional static routes

Updated `lastModified` is set dynamically.

---

## Structured Data (Future Enhancement)

Currently not implemented. Recommended additions:
- `Person` schema for the portfolio owner
- `WebSite` schema with `SearchAction`

---

## Performance Impact on SEO

| Optimization | Implementation |
|---|---|
| Static rendering | `app/page.tsx` is a Server Component; no JS needed for initial paint |
| Font optimization | `next/font/google` with `Inter`, loaded with `display: swap` |
| Image optimization | `next/image` with WebP/AVIF conversion + lazy loading |
| Core Web Vitals | FadeInSection defers off-screen section rendering |
| Canonical URL | Set in `alternates.canonical` |

---

## Lighthouse Configuration

**Config file**: `.lighthouserc.js`

Runs Lighthouse CI checks on pull requests. Target scores:
- Performance: ≥ 90
- Accessibility: ≥ 90
- Best Practices: ≥ 90
- SEO: ≥ 90
