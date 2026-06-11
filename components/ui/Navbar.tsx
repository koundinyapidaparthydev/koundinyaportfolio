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
            "pointer-events-auto w-full max-w-6xl",
            glass.nav,
            scrolled && glass.navElevated
          )}
        >
          <nav className="relative flex h-14 items-center px-4 sm:px-5">
            {/* Left: brand */}
            <div className="flex flex-1 items-center justify-start">
              <button
                onClick={() => scrollTo("hero")}
                aria-label="Go to top"
                className="flex items-center gap-2.5 rounded-full transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              >
                <span className="glass-toggle flex h-9 w-9 shrink-0 items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-300">
                  KP
                </span>
                <span className="hidden text-sm font-semibold text-foreground/80 sm:inline">
                  Koundinya
                </span>
              </button>
            </div>

            {/* Center: desktop nav links */}
            <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 md:flex">
              {NAV_LINKS.map(({ label, id }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className={glass.btnGhost}
                >
                  {label}
                </button>
              ))}

              <a
                href="/api/resume/pdf"
                download
                className={glassCn(glass.btnGhost, "flex items-center gap-1.5")}
              >
                <FileDown className="h-3.5 w-3.5" />
                Resume
              </a>

              <div className="ml-2 flex items-center border-l border-black/5 pl-2 dark:border-white/10">
                {isAdmin ? (
                  <>
                    <Link
                      href="/admin"
                      className={glassCn(
                        glass.btnGhost,
                        "flex items-center gap-1.5 text-indigo-600 dark:text-indigo-300"
                      )}
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={() => void signOut({ callbackUrl: "/" })}
                      className={glassCn(
                        glass.btnGhost,
                        "flex items-center gap-1.5 text-red-500/80 hover:text-red-500"
                      )}
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    aria-label="Admin login"
                    className={glassCn(glass.btnGhost, "flex items-center gap-1.5")}
                  >
                    <Lock className="h-4 w-4" />
                    Admin
                  </Link>
                )}
              </div>
            </div>

            {/* Right: theme toggle + mobile menu */}
            <div className="flex flex-1 items-center justify-end gap-2">
              <div className="hidden md:flex">
                <ThemeToggle />
              </div>

              <button
                className={glassCn(glass.toggle, "h-9 w-9 md:hidden")}
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
                    className="relative"
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
                className={glassCn(glass.drawer, "overflow-hidden md:hidden")}
              >
                <div className="flex flex-col gap-0.5 px-3 py-3">
                  {NAV_LINKS.map(({ label, id }) => (
                    <button
                      key={id}
                      onClick={() => scrollTo(id)}
                      className={glassCn(glass.btnGhost, "w-full py-2.5 text-left")}
                    >
                      {label}
                    </button>
                  ))}

                  <a
                    href="/api/resume/pdf"
                    download
                    onClick={() => setMenuOpen(false)}
                    className={glassCn(glass.btnGhost, "flex items-center gap-2 py-2.5")}
                  >
                    <FileDown className="h-4 w-4" />
                    Resume
                  </a>

                  <div className="mt-1 border-t border-black/5 pt-1 dark:border-white/10">
                    {isAdmin ? (
                      <>
                        <Link
                          href="/admin"
                          onClick={() => setMenuOpen(false)}
                          className={glassCn(
                            glass.btnGhost,
                            "flex items-center gap-2 py-2.5 text-indigo-600 dark:text-indigo-300"
                          )}
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          Dashboard
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            void signOut({ callbackUrl: "/" });
                          }}
                          className={glassCn(
                            glass.btnGhost,
                            "flex w-full items-center gap-2 py-2.5 text-red-500/80"
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
                        className={glassCn(glass.btnGhost, "flex items-center gap-2 py-2.5")}
                      >
                        <Lock className="h-4 w-4" />
                        Admin
                      </Link>
                    )}
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <span className="text-sm font-medium text-muted-foreground">
                        Theme
                      </span>
                      <ThemeToggle />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>
      </div>
    </>
  );
}
