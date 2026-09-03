"use client";

/**
 * Navbar — floating Apple glass navigation with scroll-progress bar.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Lock, Menu, X, LayoutDashboard, FileDown, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { glass, glassCn } from "@/lib/glass";
import {
  RESUME_DOWNLOAD_FILENAME,
  RESUME_PDF_API_PATH,
} from "@/lib/resumeDownload";

const isStaticPages = process.env.NEXT_PUBLIC_GITHUB_PAGES === "1";

const NAV_LINKS = [
  { label: "Home", id: "hero" },
  { label: "About", id: "about" },
  { label: "Skills", id: "skills" },
  { label: "Projects", id: "projects" },
];

/** Minimal nav link — no per-button glass chrome */
const navLinkClass =
  "rounded-lg px-3 py-1.5 text-sm font-medium text-foreground/65 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

const navLinkActiveClass =
  "bg-foreground/[0.08] text-foreground shadow-sm";

export default function Navbar() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;

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

  useEffect(() => {
    const handle = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

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
      {/* Scroll progress bar */}
      <div
        aria-hidden="true"
        className="fixed left-0 top-0 z-[60] h-[3px] origin-left rounded-r-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 transition-none"
        style={{ width: `${progress}%` }}
      />

      {/* Positioning shell — avoids Framer Motion transform clobbering -translate-x-1/2 */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:px-6 sm:pt-5">
        <motion.header
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={glassCn(
            "pointer-events-auto w-full max-w-7xl",
            glass.nav,
            scrolled && "shadow-lg shadow-black/10 dark:shadow-black/40"
          )}
        >
          <nav className="flex min-h-[3.25rem] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
            {/* Brand */}
            <div className="flex shrink-0 items-center">
              {isAdminRoute ? (
                <Link
                  href="/"
                  aria-label="Go to home"
                  className="flex items-center gap-2 rounded-xl py-1 pr-2 transition-colors hover:bg-foreground/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-bold text-indigo-600 ring-1 ring-indigo-500/25 dark:text-indigo-300">
                    KP
                  </span>
                  <span className="hidden text-sm font-semibold tracking-tight text-foreground/90 sm:inline">
                    Koundinya
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => scrollTo("hero")}
                  aria-label="Go to top"
                  className="flex items-center gap-2 rounded-xl py-1 pr-2 transition-colors hover:bg-foreground/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-bold text-indigo-600 ring-1 ring-indigo-500/25 dark:text-indigo-300">
                    KP
                  </span>
                  <span className="hidden text-sm font-semibold tracking-tight text-foreground/90 sm:inline">
                    Koundinya
                  </span>
                </button>
              )}
            </div>

            {/* Center: section links in a subtle track */}
            <div className="flex min-w-0 flex-1 justify-center max-md:hidden">
              <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-foreground/[0.04] p-1 ring-1 ring-foreground/[0.06]">
                {NAV_LINKS.map(({ label, id }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => scrollTo(id)}
                    className={navLinkClass}
                  >
                    {label}
                  </button>
                ))}
                <a
                  href={RESUME_PDF_API_PATH}
                  download={RESUME_DOWNLOAD_FILENAME}
                  className={glassCn(navLinkClass, "flex items-center gap-1.5")}
                >
                  <FileDown className="h-3.5 w-3.5 opacity-70" />
                  Resume
                </a>
              </div>
            </div>

            {/* Right: account + theme + mobile */}
            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
              {!isStaticPages && (
                <div className="flex items-center gap-1 max-md:hidden">
                  {isAdmin ? (
                    <>
                      <Link
                        href="/admin"
                        className={glassCn(
                          navLinkClass,
                          "flex items-center gap-1.5",
                          isAdminRoute && navLinkActiveClass
                        )}
                      >
                        <LayoutDashboard className="h-4 w-4 opacity-80" />
                        <span className="hidden lg:inline">Dashboard</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => void signOut({ callbackUrl: "/" })}
                        aria-label="Logout"
                        className={glassCn(
                          navLinkClass,
                          "flex items-center gap-1.5 text-foreground/55 hover:text-foreground"
                        )}
                      >
                        <LogOut className="h-4 w-4" />
                        <span className="hidden lg:inline">Logout</span>
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      aria-label="Admin login"
                      className={glassCn(navLinkClass, "flex items-center gap-1.5")}
                    >
                      <Lock className="h-4 w-4 opacity-80" />
                      <span className="hidden lg:inline">Admin</span>
                    </Link>
                  )}
                </div>
              )}

              <ThemeToggle className="!h-9 !w-9" />

              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 ring-1 ring-foreground/10 transition-colors hover:bg-foreground/[0.06] max-md:flex md:hidden"
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
                    className="relative flex items-center justify-center"
                  >
                    {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>
          </nav>

          <AnimatePresence initial={false}>
            {menuOpen && (
              <motion.div
                key="drawer"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={glassCn(glass.drawer, "overflow-hidden max-md:block md:hidden")}
              >
                <div className="flex flex-col gap-0.5 px-3 py-3">
                  {NAV_LINKS.map(({ label, id }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => scrollTo(id)}
                      className={glassCn(navLinkClass, "w-full py-2.5 text-left")}
                    >
                      {label}
                    </button>
                  ))}

                  <a
                    href={RESUME_PDF_API_PATH}
                    download={RESUME_DOWNLOAD_FILENAME}
                    onClick={() => setMenuOpen(false)}
                    className={glassCn(navLinkClass, "flex items-center gap-2 py-2.5")}
                  >
                    <FileDown className="h-4 w-4" />
                    Resume
                  </a>

                  {!isStaticPages && (
                    <div className="mt-2 space-y-0.5 border-t border-foreground/10 pt-2">
                      {isAdmin ? (
                        <>
                          <Link
                            href="/admin"
                            onClick={() => setMenuOpen(false)}
                            className={glassCn(navLinkClass, "flex items-center gap-2 py-2.5")}
                          >
                            <LayoutDashboard className="h-4 w-4" />
                            Dashboard
                          </Link>
                          <button
                            type="button"
                            aria-label="Logout"
                            onClick={() => {
                              setMenuOpen(false);
                              void signOut({ callbackUrl: "/" });
                            }}
                            className={glassCn(
                              navLinkClass,
                              "flex w-full items-center gap-2 py-2.5 text-left"
                            )}
                          >
                            <LogOut className="h-4 w-4" />
                            Logout
                          </button>
                        </>
                      ) : (
                        <Link
                          href="/login"
                          onClick={() => setMenuOpen(false)}
                          className={glassCn(navLinkClass, "flex items-center gap-2 py-2.5")}
                        >
                          <Lock className="h-4 w-4" />
                          Admin
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>
      </div>
    </>
  );
}
