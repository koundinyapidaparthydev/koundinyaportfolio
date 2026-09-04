"use client";

/**
 * Navbar — clean, minimal top bar that stays out of the way.
 *
 * Changes from the previous glass-pill version:
 *  • Full-width bar with a subtle bottom border instead of a floating capsule
 *  • Plain text nav links, no inner track
 *  • No scroll-progress strip
 *  • Smaller, simpler brand mark
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Lock, Menu, X, LayoutDashboard, FileDown, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
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

const linkBase =
  "relative px-1 py-1 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground";
const linkUnderline =
  "after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:rounded-full after:bg-indigo-500 after:transition-all after:duration-200 hover:after:w-full";

export default function Navbar() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handle = () => {
      setScrolled((window.scrollY || document.documentElement.scrollTop) > 10);
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
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={[
          "pointer-events-auto fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300",
          scrolled
            ? "border-white/10 bg-white/80 backdrop-blur-lg dark:bg-slate-950/80"
            : "border-transparent bg-white/10 backdrop-blur-md dark:bg-black/20",
        ].join(" ")}
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Brand */}
          {isAdminRoute ? (
            <Link
              href="/"
              aria-label="Go to home"
              className="text-base font-semibold tracking-tight text-foreground/90 transition-opacity hover:opacity-70"
            >
              Koundinya
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => scrollTo("hero")}
              aria-label="Go to top"
              className="text-base font-semibold tracking-tight text-foreground/90 transition-opacity hover:opacity-70"
            >
              Koundinya
            </button>
          )}

          {/* Center: desktop links */}
          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map(({ label, id }) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollTo(id)}
                className={[linkBase, linkUnderline].join(" ")}
              >
                {label}
              </button>
            ))}
            <a
              href={RESUME_PDF_API_PATH}
              download={RESUME_DOWNLOAD_FILENAME}
              className={[linkBase, linkUnderline, "flex items-center gap-1.5"].join(" ")}
            >
              <FileDown className="h-3.5 w-3.5 opacity-70" />
              Resume
            </a>
          </div>

          {/* Right: account + theme + mobile toggle */}
          <div className="flex items-center gap-2">
            {!isStaticPages && (
              <div className="hidden items-center gap-1 md:flex">
                {isAdmin ? (
                  <>
                    <Link
                      href="/admin"
                      className={[linkBase, "flex items-center gap-1.5"].join(" ")}
                    >
                      <LayoutDashboard className="h-4 w-4 opacity-80" />
                      <span className="hidden lg:inline">Dashboard</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => void signOut({ callbackUrl: "/" })}
                      aria-label="Logout"
                      className={[linkBase, "flex items-center gap-1.5"].join(" ")}
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="hidden lg:inline">Logout</span>
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    aria-label="Admin login"
                    className={[linkBase, "flex items-center gap-1.5"].join(" ")}
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
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-foreground/[0.06] md:hidden"
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
      </motion.header>

      {/* Mobile drawer */}
      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.div
            key="drawer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-x-0 top-[53px] z-40 overflow-hidden border-b border-white/10 bg-white/90 backdrop-blur-lg dark:bg-slate-950/90 md:hidden"
          >
            <div className="flex flex-col gap-0.5 px-4 py-3">
              {NAV_LINKS.map(({ label, id }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollTo(id)}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-base font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                >
                  {label}
                </button>
              ))}

              <a
                href={RESUME_PDF_API_PATH}
                download={RESUME_DOWNLOAD_FILENAME}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
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
                        className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
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
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-base font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
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
    </>
  );
}
