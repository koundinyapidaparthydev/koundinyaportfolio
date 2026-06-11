"use client";

/**
 * AssistantBot — floating AI assistant widget for the home page.
 *
 * Enters with a spring "jump in" from off-screen bottom-right, then rests
 * in the corner. Click toggles a compact intro panel with a contact CTA.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2.5c.4 2.1 1.8 3.5 3.9 3.9-2.1.4-3.5 1.8-3.9 3.9-.4-2.1-1.8-3.5-3.9-3.9 2.1-.4 3.5-1.8 3.9-3.9Z"
        fill="currentColor"
      />
      <path
        d="M12 6.2c.3 1.6 1.4 2.7 3 3-1.6.3-2.7 1.4-3 3-.3-1.6-1.4-2.7-3-3 1.6-.3 2.7-1.4 3-3Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M5.5 8.5c.3 1.4 1.2 2.3 2.6 2.6-1.4.3-2.3 1.2-2.6 2.6-.3-1.4-1.2-2.3-2.6-2.6 1.4-.3 2.3-1.2 2.6-2.6Z"
        fill="currentColor"
        opacity="0.7"
      />
      <path
        d="M18.5 8.5c.3 1.4 1.2 2.3 2.6 2.6-1.4.3-2.3 1.2-2.6 2.6-.3-1.4-1.2-2.3-2.6-2.6 1.4-.3 2.3-1.2 2.6-2.6Z"
        fill="currentColor"
        opacity="0.7"
      />
      <path
        d="M7 15.5c.25 1.1 1 1.85 2.1 2.1-1.1.25-1.85 1-2.1 2.1-.25-1.1-1-1.85-2.1-2.1 1.1-.25 1.85-1 2.1-2.1Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path
        d="M17 15.5c.25 1.1 1 1.85 2.1 2.1-1.1.25-1.85 1-2.1 2.1-.25-1.1-1-1.85-2.1-2.1 1.1-.25 1.85-1 2.1-2.1Z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  );
}

const ENTRANCE_DELAY_MS = 1200;

const springIn = {
  type: "spring" as const,
  stiffness: 520,
  damping: 22,
  mass: 0.85,
};

const panelSpring = {
  type: "spring" as const,
  stiffness: 380,
  damping: 28,
};

export function AssistantBot() {
  const prefersReducedMotion = useReducedMotion();
  const [ready, setReady] = useState(prefersReducedMotion);
  const [open, setOpen] = useState(false);
  const [landed, setLanded] = useState(prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = window.setTimeout(() => setReady(true), ENTRANCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion]);

  const scrollToContact = () => {
    setOpen(false);
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
      aria-live="polite"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="assistant-panel"
            role="dialog"
            aria-label="Portfolio assistant"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 16, scale: 0.92, transformOrigin: "bottom right" }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1, transformOrigin: "bottom right" }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 12, scale: 0.95, transformOrigin: "bottom right" }
            }
            transition={prefersReducedMotion ? { duration: 0.15 } : panelSpring}
            className="glass-strong pointer-events-auto w-[min(18rem,calc(100vw-3rem))] overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--glass-border)] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d97757]/15 text-[#c96442] ring-1 ring-[#d97757]/25 dark:bg-[#d97757]/20 dark:text-[#e8a88a]">
                  <ClaudeIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Portfolio assistant
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Here to help you explore
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="glass-btn-ghost rounded-lg p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-4 py-3">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Hi! I can point you to projects, experience, or help you get in
                touch with Koundinya.
              </p>
              <button
                type="button"
                onClick={scrollToContact}
                className="glass-btn-primary inline-flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              >
                <MessageCircle className="h-4 w-4" />
                Get in touch
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(ready || prefersReducedMotion) && (
          <motion.div
            key="assistant-trigger"
            className="pointer-events-auto relative"
            initial={
              prefersReducedMotion
                ? { opacity: 1, scale: 1 }
                : { opacity: 0, x: 72, y: 96, scale: 0.2, rotate: -18 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1, scale: 1 }
                : { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }
            }
            transition={
              prefersReducedMotion ? { duration: 0 } : { ...springIn, delay: 0.05 }
            }
            onAnimationComplete={() => {
              if (!prefersReducedMotion) setLanded(true);
            }}
          >
            {/* Landing ripple */}
            <AnimatePresence>
              {landed && !prefersReducedMotion && (
                <motion.span
                  key="ripple"
                  className="absolute inset-0 rounded-full bg-[#d97757]/30"
                  initial={{ scale: 1, opacity: 0.55 }}
                  animate={{ scale: 1.85, opacity: 0 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>

            {/* Idle glow ring */}
            <motion.span
              aria-hidden="true"
              className={cn(
                "absolute -inset-1 rounded-full bg-gradient-to-br from-[#d97757]/40 via-indigo-500/25 to-violet-500/30 blur-sm",
                prefersReducedMotion && "hidden"
              )}
              animate={
                prefersReducedMotion
                  ? undefined
                  : { opacity: [0.45, 0.75, 0.45], scale: [1, 1.06, 1] }
              }
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.button
              type="button"
              aria-label={open ? "Close portfolio assistant" : "Open portfolio assistant"}
              aria-expanded={open}
              onClick={() => setOpen((prev) => !prev)}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
              animate={
                prefersReducedMotion
                  ? undefined
                  : landed
                    ? { y: [0, -4, 0] }
                    : undefined
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : landed
                    ? { duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }
                    : undefined
              }
              className={cn(
                "glass-toggle relative flex h-14 w-14 items-center justify-center",
                "bg-gradient-to-br from-[#e8a88a]/90 via-[#d97757]/85 to-[#c96442]/90",
                "text-white shadow-lg shadow-[#d97757]/35",
                "transition-shadow hover:shadow-xl hover:shadow-[#d97757]/45",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d97757]"
              )}
            >
              <ClaudeIcon className="h-7 w-7 drop-shadow-sm" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
