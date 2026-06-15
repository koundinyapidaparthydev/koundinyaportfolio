import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StoreHydrator } from "@/components/StoreHydrator";
import { AuroraScrollInit } from "@/components/AuroraScrollInit";
import { Providers } from "./providers";
import {
  ConditionalNavbar,
  ConditionalFooter,
  ConditionalScrollToTop,
} from "@/components/ConditionalSiteChrome";

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
          <StoreHydrator />
          <ConditionalNavbar />
          {children}

          <ConditionalFooter />

          <ConditionalScrollToTop />
        </Providers>
      </body>
    </html>
  );
}
