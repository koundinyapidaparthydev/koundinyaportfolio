/**
 * app/not-found.tsx — Custom 404 page.
 *
 * Rendered by Next.js when notFound() is thrown or no matching route is found.
 * Uses the global Navbar (already mounted by RootLayout) so navigation works.
 */

import Link from "next/link";

export const metadata = {
  title: "404 — Page not found | Koundinya Pidaparthy",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 text-center">
      {/* Large 404 */}
      <div aria-hidden="true" className="select-none">
        <span
          className="bg-gradient-to-b from-indigo-400 to-indigo-700 bg-clip-text font-bold text-transparent"
          style={{ fontSize: "clamp(6rem, 20vw, 12rem)", lineHeight: 1 }}
        >
          404
        </span>
      </div>

      {/* Copy */}
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-bold text-foreground">
          Page not found
        </h1>
        <p className="text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Head back home to find what you need.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="glass-btn-primary px-6 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          Back to home
        </Link>
        <Link
          href="/#contact"
          className="glass-btn px-6 py-3 text-sm font-medium"
        >
          Contact me
        </Link>
      </div>

      {/* Decorative grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"
      />
    </main>
  );
}
