import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StoreHydrator } from "@/components/StoreHydrator";
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
    default: "Koundinya Pidaparthy — Software Engineer",
    template: "%s | Koundinya Pidaparthy",
  },
  description:
    "Resume of Koundinya Pidaparthy — Software Engineer with experience in React, Next.js, Node.js, TypeScript, and cloud platforms.",
  keywords: [
    "Koundinya Pidaparthy",
    "Software Engineer",
    "React",
    "Next.js",
    "TypeScript",
    "Resume",
  ],
  authors: [{ name: "Koundinya Pidaparthy", url: SITE_URL }],
  openGraph: {
    title: "Koundinya Pidaparthy — Software Engineer",
    description:
      "Resume of Koundinya Pidaparthy — Software Engineer with experience in React, Next.js, Node.js, TypeScript, and cloud platforms.",
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Koundinya Pidaparthy Portfolio",
    // /opengraph-image.tsx is auto-discovered by Next.js as og:image
  },
  twitter: {
    card: "summary_large_image",
    title: "Koundinya Pidaparthy — Software Engineer",
    description:
      "Resume of Koundinya Pidaparthy — Software Engineer.",
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
