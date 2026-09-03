"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import type { Education } from "@/types/resume";
import { glass, glassCn } from "@/lib/glass";

interface EducationSectionProps {
  education: Education[];
}

function EducationCard({ edu, index }: { edu: Education; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
      className={glassCn(
        glass.sectionCard,
        "glass-edu-card group relative overflow-hidden p-5 sm:p-6"
      )}
    >
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 top-0 w-1 rounded-l-2xl bg-gradient-to-b from-indigo-500 via-violet-500/80 to-cyan-500/50 opacity-75 transition-opacity group-hover:opacity-100"
      />

      <div className="relative pl-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {edu.institution}
          </h3>
          <time className="shrink-0 pt-0.5 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
            {edu.graduationDate}
          </time>
        </div>

        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          {edu.degree} in {edu.field}
        </p>

        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5 shrink-0 opacity-70"
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
        </p>

        {(edu.gpa || (edu.achievements && edu.achievements.length > 0)) && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {edu.gpa && (
              <span className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/12 dark:text-indigo-300">
                GPA {edu.gpa}
              </span>
            )}
            {edu.achievements?.map((achievement, i) => (
              <span
                key={i}
                className="rounded-full border border-slate-200/80 bg-slate-100/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              >
                {achievement}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function EducationSection({ education }: EducationSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <section
      ref={ref}
      id="education"
      className="relative py-24 px-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-30 dark:opacity-100"
        style={{
          background:
            "radial-gradient(ellipse at 50% -10%, rgba(99,102,241,0.14) 0%, transparent 65%)",
        }}
      />

      <div className="relative mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Education
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-indigo-600" />
        </motion.div>

        <div className="grid gap-8 sm:grid-cols-2">
          {education.map((edu, i) => (
            <EducationCard key={edu.id} edu={edu} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
