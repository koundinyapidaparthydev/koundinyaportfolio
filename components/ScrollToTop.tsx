"use client";

/**
 * ScrollToTop — floating button that appears once the user scrolls
 * past 400 px and smooth-scrolls back to the top on click.
 */

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScrollToTop() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handle = () => {
      setVisible((window.scrollY || document.documentElement.scrollTop) > 400);
    };
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);

  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="scroll-top"
          initial={{ opacity: 0, scale: 0.6, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className={cn(
            "fixed right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
            isHome ? "bottom-[5.5rem]" : "bottom-6"
          )}
        >
          <ChevronUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
