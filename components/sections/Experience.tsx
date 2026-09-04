"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useExperience } from "@/lib/store";
import { TiltCard } from "@/components/TiltCard";
import type { Experience } from "@/types/resume";

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

export default function Experience() {
  const experience = useExperience();
  const sectionRef = useRef<HTMLElement>(null);
  const headingInView = useInView(sectionRef, { once: true, amount: 0.05 });

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

      </div>
    </section>
  );
}
