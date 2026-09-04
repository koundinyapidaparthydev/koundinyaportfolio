"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { resumeData } from "@/data/resume";

const currentRole = resumeData.experience[0];
const firstProject = resumeData.projects[0];
const companiesWorked = new Set(
  resumeData.experience.map((e) => e.companyName)
).size;

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

export default function About() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 24 },
    animate: inView ? { opacity: 1, y: 0 } : {},
    transition: { duration: 0.6, delay, ease: "easeOut" as const },
  });

  return (
    <section ref={ref} id="about" className="relative px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div {...fadeUp()} className="surface p-8 lg:p-12">
          <div className="grid gap-10 lg:grid-cols-5 lg:items-start lg:gap-14">
            {/* Left: heading + bio */}
            <div className="lg:col-span-3">
              <h2 className="section-heading">
                Engineering-led product builder
              </h2>

              <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-300">
                <p>{resumeData.personalInfo.summary}</p>

                <p>
                  Currently a{" "}
                  <span className="font-semibold text-white">
                    {currentRole.role}
                  </span>{" "}
                  at{" "}
                  <span className="font-semibold text-white">
                    {currentRole.companyName}
                  </span>
                  , building an AI-first operating system layer with Next.js 14,
                  TypeScript, and React Server Components.
                </p>

                <p>
                  I also shipped{" "}
                  <a
                    href={firstProject.website?.url || firstProject.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-indigo-400 transition-colors hover:text-indigo-300"
                  >
                    {firstProject.name}
                  </a>{" "}
                  — {firstProject.description}
                </p>
              </div>
            </div>

            {/* Right: stats */}
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                At a glance
              </h3>
              <dl className="mt-6 grid grid-cols-3 gap-4">
                {STATS.map(({ value, label }) => (
                  <div key={label}>
                    <dt className="text-2xl font-bold accent-gradient sm:text-3xl">
                      {value}
                    </dt>
                    <dd className="mt-1 text-xs text-slate-400">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
