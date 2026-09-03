"use client";

/**
 * Experience.tsx — Vertical timeline with alternating cards + education card.
 *
 * Reads experience + education arrays from the Zustand store.
 * Features:
 *  • Center vertical line on desktop, left-aligned on mobile
 *  • Cards alternate left/right on desktop (single column on mobile)
 *  • Each card: company, role, date, location, tech stack pills, bullet points
 *  • "Current" badge (green) for Anchor Operating System (endDate === "Present")
 *  • Cards animate in from left or right as they enter viewport (useInView)
 *  • Education block at the bottom (Pace University MS CS, GPA 3.95)
 */

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useExperience, useEducation } from "@/lib/store";
import { TiltCard } from "@/components/TiltCard";
import { glass } from "@/lib/glass";
import type { Experience, Education } from "@/types/resume";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return d === "Present" ? "Present" : d;
}

// ─── TimelineCard ─────────────────────────────────────────────────────────────

interface TimelineCardProps {
  exp: Experience;
  side: "left" | "right";
  index: number;
}

function TimelineCard({ exp, side, index }: TimelineCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const isCurrent = exp.endDate === "Present";

  const fromX = side === "left" ? -60 : 60;

  return (
    <div
      className={[
        "relative flex w-full items-start gap-4 md:gap-8",
        side === "left" ? "md:flex-row-reverse" : "md:flex-row",
      ].join(" ")}
    >
      {/* ── Card half (takes up ~45% on desktop) ── */}
      <motion.div
        ref={ref}
        initial={{ opacity: 0, x: fromX }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
        className="w-full md:w-[calc(50%-2rem)]"
      >
        <TiltCard>
          <div
            className={[
              `${glass.sectionCard} group relative overflow-hidden p-6`,
              isCurrent
                ? "border-emerald-500/30 hover:border-emerald-500/50"
                : "hover:border-white/20",
            ].join(" ")}
          >
            {/* Aurora left border accent bar */}
            <div
              aria-hidden="true"
              className={[
                "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl",
                isCurrent ? "aurora-timeline-glow" : "bg-indigo-900/40",
              ].join(" ")}
            />

            {/* Glow for current role */}
            {isCurrent && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(ellipse at top left, rgba(52,211,153,0.06) 0%, transparent 60%)",
                }}
              />
            )}

            {/* Header row */}
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-gray-900 leading-tight dark:text-white">
                {exp.role}
              </h3>
              <p className="mt-0.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                {exp.companyName}
              </p>
            </div>

            {isCurrent && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-500/30 dark:text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Current
              </span>
            )}
          </div>

          {/* Meta: date + location */}
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-slate-500">
            <span className="flex items-center gap-1">
              {/* Calendar icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              {formatDate(exp.startDate)} — {formatDate(exp.endDate)}
            </span>
            <span className="flex items-center gap-1">
              {/* Location icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {exp.location}
            </span>
          </div>

          {/* Bullet points */}
          <ul className="mb-5 space-y-2">
            {exp.points.map((pt, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-600 dark:text-slate-400">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                <span>{pt}</span>
              </li>
            ))}
          </ul>

          {/* Tech stack pills */}
          {exp.technologies && exp.technologies.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {exp.technologies.map((tech) => (
                <span
                  key={tech}
                  className="glass-chip px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}
        </div>
        </TiltCard>
      </motion.div>

      {/* ── Center dot (hidden on mobile — we use a left border instead) ── */}
      <div className="hidden flex-none md:flex flex-col items-center">
        <div
          className={[
            "z-10 h-4 w-4 rounded-full border-2 shadow-lg",
            isCurrent
              ? "border-emerald-400 bg-emerald-500 shadow-emerald-500/40"
              : "border-indigo-400 bg-indigo-600 shadow-indigo-500/40",
          ].join(" ")}
        />
      </div>

      {/* ── Spacer (fills the other 45% on desktop so cards alternate) ── */}
      <div className="hidden md:block md:w-[calc(50%-2rem)]" />
    </div>
  );
}

// ─── EducationCard ────────────────────────────────────────────────────────────

interface EducationCardProps {
  edu: Education;
  index: number;
}

function EducationCard({ edu, index }: EducationCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
      className={`${glass.sectionCard} p-6`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {edu.degree} — {edu.field}
          </h3>
          <p className="mt-0.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            {edu.institution}
          </p>
        </div>
        {edu.gpa && (
          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            GPA {edu.gpa}
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          {edu.graduationDate}
        </span>
        <span className="flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {edu.location}
        </span>
      </div>

      {edu.achievements && edu.achievements.length > 0 && (
        <ul className="space-y-1.5">
          {edu.achievements.map((a, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
              {a}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Experience() {
  const experience = useExperience();
  const education = useEducation();
  const sectionRef = useRef<HTMLElement>(null);
  const headingInView = useInView(sectionRef, { once: true, amount: 0.05 });

  // Filter to just the primary MS degree for the bottom block
  const primaryEdu = education.find(
    (e) => e.degree === "Master of Science" || e.gpa != null
  );

  return (
    <section
      ref={sectionRef}
      id="experience"
      className="relative py-24 px-6"
    >
      {/* Top aurora radial glow — dark mode only */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-40 dark:opacity-100"
        style={{
          background:
            "radial-gradient(ellipse at 50% -10%, rgba(99,102,241,0.2) 0%, transparent 65%)",
        }}
      />
      <div className="mx-auto max-w-6xl">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={headingInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-16 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Experience
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-indigo-500" />
        </motion.div>

        {/* Timeline container */}
        <div className="relative">
          {/* Center vertical rule — desktop only, aurora gradient */}
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-0 hidden h-full w-0.5 -translate-x-1/2 md:block"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(99,102,241,0.7) 12%, rgba(124,58,237,0.6) 50%, rgba(6,182,212,0.6) 88%, transparent 100%)",
            }}
          />

          {/* Mobile left border */}
          <div
            aria-hidden="true"
            className="absolute left-4 top-0 h-full w-0.5 md:hidden"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(99,102,241,0.7) 12%, rgba(124,58,237,0.6) 88%, transparent 100%)",
            }}
          />

          <div className="flex flex-col gap-12">
            {experience.map((exp, i) => (
              <TimelineCard
                key={exp.id}
                exp={exp}
                side={i % 2 === 0 ? "right" : "left"}
                index={i}
              />
            ))}
          </div>
        </div>

        {/* Education block */}
        {primaryEdu && (
          <div className="mt-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={headingInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
              className="mb-8 flex items-center gap-4"
            >
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-indigo-500/40" />
              <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                Education
              </h2>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-indigo-500/40" />
            </motion.div>

            <div className="grid gap-6 sm:grid-cols-2">
              {education.map((edu, i) => (
                <EducationCard key={edu.id} edu={edu} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
