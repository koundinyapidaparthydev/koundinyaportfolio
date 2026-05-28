"use client";

/**
 * Navbar — sticky top navigation with scroll-progress bar.
 *
 * Features:
 *  • Transparent on hero, dark + blur when scrolled
 *  • Scroll-progress bar fixed above everything
 *  • "KP" logo in indigo circle → scrolls to top
 *  • Desktop links: Home / About / Skills / Projects / Resume
 *  • Admin lock icon when not authenticated; Dashboard link when admin
 *  • Mobile hamburger with Framer Motion slide-down drawer
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Lock, Menu, X, LayoutDashboard, FileDown, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

const NAV_LINKS = [
  { label: "Home", id: "hero" },
  { label: "About", id: "about" },
  { label: "Skills", id: "skills" },
  { label: "Projects", id: "projects" },
];

export default function Navbar() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";
  // Admin/login sections are always dark — keep navbar dark there too
  const isAdminPath = pathname.startsWith("/admin") || pathname === "/login";

  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handle = () => {
      const el = document.documentElement;
      const scrollY = el.scrollTop || window.scrollY;
      setScrolled(scrollY > 20);
      const total = Math.max(1, el.scrollHeight - el.clientHeight);
      setProgress((scrollY / total) * 100);
    };
    window.addEventListener("scroll", handle, { passive: true });
    handle();
    return () => window.removeEventListener("scroll", handle);
  }, []);

  // Close drawer on resize to desktop
  useEffect(() => {
    const handle = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  // If on home page, smooth-scroll to section. Otherwise navigate to /#id.
  const scrollTo = (id: string) => {
    if (isHome) {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    } else {
      void router.push(`/#${id}`);
    }
    setMenuOpen(false);
  };

  return (
    <>
      {/* ── Scroll progress bar (sits above navbar) ── */}
      <div
        aria-hidden="true"
        className="fixed left-0 top-0 z-[60] h-[3px] origin-left rounded-r-full bg-indigo-500 transition-none"
        style={{ width: `${progress}%` }}
      />

      {/* ── Navbar ── */}
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={[
          "fixed left-0 right-0 top-0 z-50 transition-[background,border,backdrop-filter] duration-300",
          isAdminPath ? "dark" : "",
          scrolled
            ? "border-b border-black/10 bg-white/90 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-black/75 dark:shadow-black/20"
            : "bg-transparent",
        ].join(" ")}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          {/* Logo / avatar */}
          <button
            onClick={() => scrollTo("hero")}
            aria-label="Go to top"
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-indigo-500/40 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            <Image
              src="/kp-photo.png"
              alt="Koundinya Pidaparthy"
              width={36}
              height={36}
              className="h-full w-full object-cover"
              priority
            />
          </button>

          {/* Desktop links */}
          <div className="hidden items-center gap-0.5 md:flex">
            {NAV_LINKS.map(({ label, id }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {label}
              </button>
            ))}

            <a
              href="/api/resume/pdf"
              download
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <FileDown className="h-3.5 w-3.5" />
              Resume
            </a>

            {/* Admin / Dashboard divider */}
            <div className="ml-2 flex items-center border-l border-slate-200 pl-2 dark:border-white/10">
              {isAdmin ? (
                <>
                  <Link
                    href="/admin"
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-200"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={() => void signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  aria-label="Admin login"
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                >
                  <Lock className="h-4 w-4" />
                  Admin
                </Link>
              )}
            </div>
          </div>

          {/* Theme toggle (desktop) — hidden in admin where it has no effect */}
          {!isAdminPath && (
            <div className="ml-1 hidden md:flex">
              <ThemeToggle />
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={menuOpen ? "x" : "menu"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </nav>

        {/* Mobile drawer */}
        <AnimatePresence initial={false}>
          {menuOpen && (
            <motion.div
              key="drawer"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden border-t border-slate-200 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-black/90 md:hidden"
            >
              <div className="flex flex-col gap-0.5 px-4 py-3">
                {NAV_LINKS.map(({ label, id }) => (
                  <button
                    key={id}
                    onClick={() => scrollTo(id)}
                    className="w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    {label}
                  </button>
                ))}

                <a
                  href="/api/resume/pdf"
                  download
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <FileDown className="h-4 w-4" />
                  Resume
                </a>

                <div className="mt-1 border-t border-slate-200 pt-1 dark:border-white/10">
                  {isAdmin ? (
                    <>
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-200"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </Link>
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); void signOut({ callbackUrl: "/" }); }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                    >
                      <Lock className="h-4 w-4" />
                      Admin
                    </Link>
                  )}
                  {/* Theme toggle in mobile drawer — hidden in admin */}
                  {!isAdminPath && (
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Theme</span>
                      <ThemeToggle />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
}
