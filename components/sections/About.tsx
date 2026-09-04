"use client";

/**
 * About.tsx — Two-column about section.
 *
 * Left: stylised KP avatar (purple gradient circle, 200 px)
 * Right: bio text, 3 stat cards
 */

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { glass } from "@/lib/glass";
import { resumeData } from "@/data/resume";

// ─── Derived data ─────────────────────────────────────────────────────────────

const currentRole = resumeData.experience[0];
const firstProject = resumeData.projects[0];
const companiesWorked = new Set(resumeData.experience.map((e) => e.companyName)).size;

const yearsExperience = (() => {
  const earliestYear = resumeData.experience.reduce((min, exp) => {
    const year = parseInt(exp.startDate.split(" ").pop() || "2026", 10);
    return year < min ? year : min;
  }, 2026);
  return Math.max(1, 2026 - earliestYear);
})();

const STATS = [
  { value: `${yearsExperience}+`, label: "Years experience" },
  { value: resumeData.projects.length.toString(), label: "Projects shipped" },
  { value: companiesWorked.toString(), label: "Companies" },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function AvatarCircle() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="relative mx-auto flex h-52 w-52 items-center justify-center rounded-full lg:h-56 lg:w-56"
      style={{
        background:
          "radial-gradient(circle at 30% 30%, #8b5cf6, #6366f1 45%, #4f46e5 100%)",
        boxShadow: "0 24px 80px -20px rgba(99,102,241,0.45)",
      }}
    >
      {/* subtle inner ring */}
      <div
        aria-hidden="true"
        className="absolute inset-3 rounded-full border border-white/20"
      />
      <span className="relative z-10 text-5xl font-bold tracking-tight text-white lg:text-6xl">
        KP
      </span>
    </motion.div>
  );
}

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
    <section ref={ref} id="about" className="relative py-24 px-6">
      {/* Top aurora radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{
          background:
            "radial-gradient(ellipse at 50% -10%, rgba(139,92,246,0.12) 0%, transparent 65%)",
        }}
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

        {/* Two-column layout */}
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:gap-14">
          {/* Left: avatar */}
          <div className="flex-shrink-0 lg:w-72">
            <AvatarCircle />
          </div>

          {/* Right: bio + stats */}
          <motion.div
            {...fadeUp}
            className="glass-panel w-full max-w-3xl p-6 sm:p-8"
          >
            <h3 className="mb-5 text-xl font-bold leading-tight break-keep text-gray-900 sm:text-2xl dark:text-white">
              Full-Stack Engineer & AI Systems Builder
            </h3>

            <div className="space-y-5 text-base leading-relaxed text-gray-700 dark:text-slate-200">
              <p>{resumeData.personalInfo.summary}</p>
              <p>
                I&apos;m currently a{" "}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {currentRole.role}
                </span>{" "}
                at{" "}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {currentRole.companyName}
                </span>
                . {currentRole.points[0]}
              </p>
              <p>
                Outside of work I built{" "}
                <a
                  href={firstProject.website?.url || firstProject.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  {firstProject.name}
                </a>
                . {firstProject.description} I love turning ambitious ideas into
                reliable, performant software.
              </p>
            </div>

            {/* ── Stat cards ── */}
            <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">
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
                  className={`${glass.sectionCard} p-4 text-center sm:p-5`}
                >
                  <p className="text-xl font-bold text-indigo-400 sm:text-2xl">
                    {value}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-500 sm:text-xs">
                    {label}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
