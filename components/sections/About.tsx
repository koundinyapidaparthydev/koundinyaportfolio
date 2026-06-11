"use client";

/**
 * About.tsx — Two-column about section.
 *
 * Left: stylised KP avatar (purple gradient circle, 200 px)
 * Right: bio text, 3 stat cards
 */

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

// ─── Stat card data ───────────────────────────────────────────────────────────

const STATS = [
  { value: "5+", label: "Years experience" },
  { value: "10+", label: "Projects shipped" },
  { value: "99.9%", label: "Uptime systems" },
] as const;

// ─── Main component ───────────────────────────────────────────────────────────

export default function About() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  const fadeUp = {
    initial: { opacity: 0, y: 30 },
    animate: inView ? { opacity: 1, y: 0 } : {},
    transition: { duration: 0.65, ease: "easeOut" as const },
  };

  return (
    <section ref={ref} id="about" className="aurora-5 relative py-24 px-6">
        {/* Top aurora radial glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-56"
          style={{ background: "radial-gradient(ellipse at 50% -10%, rgba(139,92,246,0.12) 0%, transparent 65%)" }}
        />
        <div className="mx-auto max-w-6xl">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-14 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            About Me
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-indigo-500" />
        </motion.div>

        {/* Bio + stats */}
        <motion.div {...fadeUp} className="mx-auto max-w-3xl">
            <h3 className="mb-5 text-2xl font-bold text-gray-900 dark:text-white">
              Full-Stack Engineer & AI Builder
            </h3>

            <div className="space-y-4 text-base leading-relaxed text-gray-600 dark:text-slate-400">
              <p>
                I&apos;m a Full-Stack Software Engineer with over 5 years of
                experience designing and shipping production-grade web
                applications. My work spans the entire stack — from designing
                scalable system architectures to crafting pixel-perfect UIs that
                delight users.
              </p>
              <p>
                I&apos;m currently at{" "}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  Anchor Operating System
                </span>{" "}
                where I architect AI-first modules — including real-time
                collaboration engines, model context protocol (MCP) servers, and
                a plugin marketplace — powering the next generation of operating
                system experiences.
              </p>
              <p>
                Outside of work I built{" "}
                <a
                  href="https://aplifyai.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  AplifyAI
                </a>
                , a production AI SaaS that uses RAG + GPT-4 to tailor
                resumes and cover letters to job descriptions — now serving
                real users. I love turning ambitious ideas into reliable,
                performant software.
              </p>
            </div>

            {/* ── Stat cards ── */}
            <div className="mt-10 grid grid-cols-3 gap-4">
              {STATS.map(({ value, label }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    duration: 0.5,
                    delay: 0.3 + i * 0.1,
                    ease: "easeOut",
                  }}
                  className="glass-panel p-5 text-center"
                >
                  <p className="text-2xl font-bold text-indigo-400">{value}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-500">{label}</p>
                </motion.div>
              ))}
            </div>
        </motion.div>
      </div>
    </section>
  );
}
