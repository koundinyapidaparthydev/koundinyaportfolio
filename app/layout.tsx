import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StoreHydrator } from "@/components/StoreHydrator";
import { TrackerInit } from "@/components/TrackerInit";
import { AuroraScrollInit } from "@/components/AuroraScrollInit";
import { MagneticCursor } from "@/components/MagneticCursor";
import { Providers } from "./providers";
import Navbar from "@/components/ui/Navbar";
import { ScrollToTop } from "@/components/ScrollToTop";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://koundinyapidaparthy.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Koundinya Pidaparthy — Full Stack Engineer",
    template: "%s | Koundinya Pidaparthy",
  },
  description:
    "Portfolio of Koundinya Pidaparthy — Full Stack Software Engineer specializing in React, Next.js, Node.js, and AI-powered applications.",
  keywords: [
    "Koundinya Pidaparthy",
    "Full Stack Engineer",
    "React",
    "Next.js",
    "TypeScript",
    "Software Engineer Portfolio",
  ],
  authors: [{ name: "Koundinya Pidaparthy", url: SITE_URL }],
  openGraph: {
    title: "Koundinya Pidaparthy — Full Stack Engineer",
    description:
      "Portfolio of Koundinya Pidaparthy — Full Stack Software Engineer specializing in React, Next.js, Node.js, and AI-powered applications.",
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Koundinya Pidaparthy Portfolio",
    // /opengraph-image.tsx is auto-discovered by Next.js as og:image
  },
  twitter: {
    card: "summary_large_image",
    title: "Koundinya Pidaparthy — Full Stack Engineer",
    description:
      "Portfolio of Koundinya Pidaparthy — Full Stack Software Engineer.",
    creator: "@koundinyap",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <AuroraScrollInit />
          <MagneticCursor />
          <StoreHydrator />
          <TrackerInit />
          <Navbar />
          {children}

          {/* ── Footer ── */}
          <footer className="glass-footer py-10 px-6">
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
              {/* Brand */}
              <div className="flex items-center gap-3">
                <span className="glass-toggle flex h-8 w-8 items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-300">
                  KP
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Koundinya Pidaparthy
                </span>
              </div>

              {/* Links */}
              <div className="flex items-center gap-6">
                <a
                  href="https://github.com/koundinyapidaparthy2"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="text-slate-400 transition-colors hover:text-slate-900 dark:text-slate-500 dark:hover:text-white"
                >
                  {/* GitHub icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </a>

                <a
                  href="https://linkedin.com/in/koundinyap"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="text-slate-400 transition-colors hover:text-slate-900 dark:text-slate-500 dark:hover:text-white"
                >
                  {/* LinkedIn icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>

                <a
                  href="mailto:koundinyapidaparthy@gmail.com"
                  aria-label="Email"
                  className="text-slate-400 transition-colors hover:text-slate-900 dark:text-slate-500 dark:hover:text-white"
                >
                  {/* Mail icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </a>
              </div>

              {/* Copyright */}
              <p className="text-xs text-slate-400 dark:text-slate-600">
                &copy; {new Date().getFullYear()} Koundinya Pidaparthy
              </p>
            </div>
          </footer>

          <ScrollToTop />
        </Providers>
      </body>
    </html>
  );
}
