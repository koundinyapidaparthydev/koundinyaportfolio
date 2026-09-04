"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useExperience, useEducation } from "@/lib/store";
import { TiltCard } from "@/components/TiltCard";
import type { Experience, Education } from "@/types/resume";

function formatDate(d: string) {
  return d === "Present" ? "Present" : d;
}

interface TimelineCardProps {
  exp: Experience;
  side: "left" | "right";
  index: number;
}

function TimelineCard({ exp, side, index }: TimelineCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const isCurrent = exp.endDate === "Present";
  const fromX = side === "left" ? -40 : 40;

  const topPoints = exp.points.slice(0, 4);

  return (
    <div
      className={[
        "relative flex w-full items-start gap-6 md:gap-10",
        side === "left" ? "md:flex-row-reverse" : "md:flex-row",
      ].join(" ")}
    >
      <motion.div
        ref={ref}
        initial={{ opacity: 0, x: fromX }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
        className="w-full md:w-[calc(50%-2.5rem)]"
      >
        <TiltCard>
          <div className="surface group relative p-6 transition-colors duration-300 hover:border-slate-700">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">{exp.role}</h3>
                <p className="accent-gradient text-sm font-medium">{exp.companyName}</p>
              </div>
              {isCurrent && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Current
                </span>
              )}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>
                {formatDate(exp.startDate)} — {formatDate(exp.endDate)}
              </span>
              <span>{exp.location}</span>
            </div>

            <ul className="mb-5 space-y-2">
              {topPoints.map((pt, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-400">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>

            {exp.technologies && exp.technologies.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {exp.technologies.map((tech) => (
                  <span
                    key={tech}
                    className="rounded-full border border-slate-700/60 bg-slate-900/60 px-2.5 py-0.5 text-[11px] font-medium text-slate-400"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}
          </div>
        </TiltCard>
      </motion.div>

      <div className="hidden flex-none md:flex flex-col items-center pt-6">
        <div
          className={[
            "z-10 h-2.5 w-2.5 rounded-full border border-slate-600",
            isCurrent ? "bg-emerald-400" : "bg-slate-500",
          ].join(" ")}
        />
      </div>

      <div className="hidden md:block md:w-[calc(50%-2.5rem)]" />
    </div>
  );
}

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
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
      className="surface p-6"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">
            {edu.degree} — {edu.field}
          </h3>
          <p className="accent-gradient text-sm font-medium">{edu.institution}</p>
        </div>
        {edu.gpa && (
          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold text-indigo-300">
            GPA {edu.gpa}
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>{edu.graduationDate}</span>
        <span>{edu.location}</span>
      </div>

      {edu.achievements && edu.achievements.length > 0 && (
        <ul className="space-y-1.5">
          {edu.achievements.map((a, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-400">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
              {a}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

export default function Experience() {
  const experience = useExperience();
  const education = useEducation();
  const sectionRef = useRef<HTMLElement>(null);
  const headingInView = useInView(sectionRef, { once: true, amount: 0.05 });

  const primaryEdu = education.find(
    (e) => e.degree === "Master of Science" || e.gpa != null
  );

  return (
    <section ref={sectionRef} id="experience" className="relative py-24 px-6">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={headingInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-16 text-center"
        >
          <h2 className="section-heading heading-gradient">Experience</h2>
          <p className="section-subheading mx-auto">
            Building products across AI platforms, marketplaces, and high-traffic consumer apps.
          </p>
        </motion.div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute left-4 top-0 h-full w-px bg-slate-800 md:left-1/2 md:-translate-x-1/2"
          />

          <div className="flex flex-col gap-10">
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

        {primaryEdu && (
          <div className="mt-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={headingInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
              className="mb-8 text-center"
            >
              <h2 className="text-xl font-bold tracking-tight text-white">Education</h2>
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
