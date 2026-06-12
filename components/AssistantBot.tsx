"use client";

/**
 * AssistantBot — portfolio chat widget powered by /api/chat (Gemini).
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";

type ChatEntry = {
  role: ChatRole;
  content: string;
};

const ENTRANCE_DELAY_MS = 1200;

const SUGGESTED_PROMPTS = [
  "What are Koundinya's top skills?",
  "Tell me about AplifyAI",
  "Summarize his experience",
  "How can I contact him?",
] as const;

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

const WELCOME: ChatEntry = {
  role: "assistant",
  content:
    "Hi! Ask me about Koundinya's projects, skills, experience, or how to get in touch.",
};

export async function sendPortfolioChat(
  messages: ChatEntry[]
): Promise<{ reply?: string; error?: string }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  const data = (await res.json()) as { reply?: string; error?: string };
  if (!res.ok) {
    return { error: data.error ?? "Something went wrong. Please try again." };
  }
  return { reply: data.reply };
}

export function AssistantBot() {
  const prefersReducedMotion = useReducedMotion();
  const [ready, setReady] = useState(prefersReducedMotion);
  const [open, setOpen] = useState(false);
  const [landed, setLanded] = useState(prefersReducedMotion);
  const [messages, setMessages] = useState<ChatEntry[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = window.setTimeout(() => setReady(true), ENTRANCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [messages, loading, open, prefersReducedMotion]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  const scrollToContact = () => {
    setOpen(false);
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  };

  const submitMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError(null);
    const nextMessages: ChatEntry[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    const { reply, error: apiError } = await sendPortfolioChat(nextMessages);
    setLoading(false);

    if (apiError || !reply) {
      setError(apiError ?? "No reply received.");
      return;
    }

    setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitMessage(input);
  };

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6"
      aria-live="polite"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="assistant-panel"
            role="dialog"
            aria-label="Portfolio chat"
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
            className="glass-section-card pointer-events-auto flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden sm:w-[min(24rem,calc(100vw-3rem))]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--glass-border)] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d97757]/15 text-[#c96442] ring-1 ring-[#d97757]/25 dark:bg-[#d97757]/20 dark:text-[#e8a88a]">
                  <ClaudeIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Ask about Koundinya
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Projects, skills, experience
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="glass-btn-ghost rounded-lg p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              ref={listRef}
              className="max-h-[min(18rem,45vh)] space-y-3 overflow-y-auto px-4 py-3"
            >
              {messages.map((msg, i) => (
                <div
                  key={`${msg.role}-${i}`}
                  className={cn(
                    "text-sm leading-relaxed",
                    msg.role === "user"
                      ? "ml-6 rounded-2xl rounded-br-md bg-indigo-600/90 px-3 py-2 text-white"
                      : "mr-4 text-slate-600 dark:text-slate-300"
                  )}
                >
                  {msg.content}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              )}
              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
                  {error}
                </p>
              )}
            </div>

            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={loading}
                    onClick={() => void submitMessage(prompt)}
                    className="glass-chip text-left text-[11px] text-slate-600 dark:text-slate-300"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="flex items-end gap-2 border-t border-[var(--glass-border)] px-3 py-3"
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitMessage(input);
                  }
                }}
                placeholder="Ask a question…"
                disabled={loading}
                className="glass-input min-h-[2.5rem] flex-1 resize-none py-2"
                aria-label="Chat message"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="glass-btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-0 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            <div className="border-t border-[var(--glass-border)] px-4 py-2">
              <button
                type="button"
                onClick={scrollToContact}
                className="glass-btn-ghost inline-flex w-full items-center justify-center gap-2 py-2 text-xs font-medium"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Prefer email? Go to Contact
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
            <AnimatePresence>
              {landed && !prefersReducedMotion && !open && (
                <motion.span
                  key="ripple"
                  className="absolute inset-0 rounded-full bg-[#d97757]/30"
                  initial={{ scale: 1, opacity: 0.55 }}
                  animate={{ scale: 1.85, opacity: 0 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>

            <motion.button
              type="button"
              aria-label={open ? "Close portfolio chat" : "Open portfolio chat"}
              aria-expanded={open}
              onClick={() => setOpen((prev) => !prev)}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
              animate={
                prefersReducedMotion
                  ? undefined
                  : landed && !open
                    ? { y: [0, -4, 0] }
                    : undefined
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : landed && !open
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
