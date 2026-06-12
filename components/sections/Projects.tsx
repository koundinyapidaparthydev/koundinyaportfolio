"use client";

/**
 * Projects.tsx — Masonry-style project showcase.
 *
 * Reads projects from the Zustand store.
 * Features:
 *  • CSS Grid masonry: 3-col desktop, 2-col tablet, 1-col mobile
 *  • "Filter by tech" row — Framer Motion layout animations on reflow
 *  • Each card: name, live-site badge (AplifyAI), tech pills, bullets,
 *    external-link + GitHub icon buttons
 *  • Cards lift + border brightens on hover
 *  • per-card viewport entry animation via useInView
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useProjects } from "@/lib/store";
import { TiltCard } from "@/components/TiltCard";
import type { Project } from "@/types/resume";
import { glass, glassCn } from "@/lib/glass";

// ─── Tech pill colour map ─────────────────────────────────────────────────────

const TECH_COLORS: Record<string, string> = {
  // Blues
  "Next.js 14":    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  "Next.js":       "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  TypeScript:      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-600/15 dark:text-blue-300 dark:border-blue-600/30",
  React:           "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  "React Query":   "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  Socket:          "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-600/15 dark:text-sky-300 dark:border-sky-600/30",
  "Socket.io":     "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-600/15 dark:text-sky-300 dark:border-sky-600/30",
  "Tailwind CSS":  "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
  Vercel:          "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  // Yellows / Oranges
  Python:          "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30",
  JavaScript:      "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-400/15 dark:text-yellow-300 dark:border-yellow-400/30",
  Firebase:        "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  "AWS S3":        "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  AWS:             "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  // Greens
  "Node.js":       "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  Express:         "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  Supabase:        "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-600/15 dark:text-emerald-300 dark:border-emerald-600/30",
  Prisma:          "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-700/15 dark:text-emerald-300 dark:border-emerald-700/30",
  PostgreSQL:      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  MongoDB:         "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",
  // Purples / Pinks
  "OpenAI GPT-4":  "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  "GPT-4":         "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  LangChain:       "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
  Pinecone:        "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-600/15 dark:text-purple-300 dark:border-purple-600/30",
  "OpenAI Whisper":"bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:border-fuchsia-500/30",
  Stripe:          "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30",
};

const DEFAULT_PILL =
  "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30";

function techPillClass(tech: string) {
  // Partial match for long names like "AWS S3"
  const exact = TECH_COLORS[tech];
  if (exact) return exact;
  const partial = Object.keys(TECH_COLORS).find(
    (k) => tech.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(tech.toLowerCase())
  );
  return partial ? TECH_COLORS[partial] : DEFAULT_PILL;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

// ─── Live site IDs ─────────────────────────────────────────────────────────────
// Project IDs that have a production live site badge.

const LIVE_SITE_IDS = new Set(["project-1"]);

// ─── ProjectCard ──────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: Project;
  index: number;
}

function ProjectCard({ project, index }: ProjectCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const isLive = LIVE_SITE_IDS.has(project.id);

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
      style={{ breakInside: "avoid" }}
    >
      <TiltCard
        className={glassCn(
          glass.sectionCard,
          "group relative flex flex-col overflow-hidden transition-all duration-300 hover:border-indigo-500/40 dark:hover:border-white/15"
        )}
      >

      <div className="relative flex flex-1 flex-col p-6">
        {/* ── Card header ── */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-snug dark:text-white">
              {project.name}
            </h3>
            <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{project.date}</p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {isLive && (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            )}
          </div>
        </div>

        {/* ── Description ── */}
        <p className="mb-4 text-sm leading-relaxed text-gray-600 dark:text-slate-400">
          {project.description}
        </p>

        {/* ── Tech stack pills ── */}
        <div className="mb-5 flex flex-wrap gap-1.5">
          {project.stack.map((tech) => (
            <span
              key={tech}
              className={[
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-opacity",
                techPillClass(tech),
              ].join(" ")}
            >
              {tech}
            </span>
          ))}
        </div>

        {/* ── Bullet points ── */}
        <ul className="mb-6 flex-1 space-y-2">
          {project.points.map((pt, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-600 dark:text-slate-400">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
              <span>{pt}</span>
            </li>
          ))}
        </ul>

        {/* ── Action buttons ── */}
        <div className="flex items-center gap-3 border-t border-white/6 pt-4">
          {project.website && (
            <a
              href={project.website.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${project.name} live site`}
              className="glass-btn flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-300"
            >
              <ExternalLinkIcon className="h-3.5 w-3.5" />
              {project.website.text}
            </a>
          )}
          {project.github && (
            <a
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${project.name} on GitHub`}
              className="glass-btn flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
            >
              <GitHubIcon className="h-3.5 w-3.5" />
              GitHub
            </a>
          )}
        </div>
      </div>
      </TiltCard>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const ALL_FILTER = "All";

export default function Projects() {
  const projects = useProjects();
  const sectionRef = useRef<HTMLElement>(null);
  const headingInView = useInView(sectionRef, { once: true, amount: 0.1 });

  // Build a deduplicated sorted list of all tech across all projects
  const allTech = Array.from(
    new Set(projects.flatMap((p) => p.stack))
  ).sort();

  const [activeTech, setActiveTech] = useState<string>(ALL_FILTER);

  const visible =
    activeTech === ALL_FILTER
      ? projects
      : projects.filter((p) => p.stack.includes(activeTech));

  return (
    <section
      ref={sectionRef}
      id="projects"
      className="aurora-20 bg-white py-24 px-6"
    >
      <div className="mx-auto max-w-6xl">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={headingInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Projects
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-indigo-500" />
          <p className="mx-auto mt-4 max-w-xl text-sm text-gray-500 dark:text-slate-500">
            AI-powered products built end-to-end — from architecture to
            production deployment.
          </p>
        </motion.div>

        {/* Filter row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={headingInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
          className="mb-10 flex flex-wrap justify-center gap-2"
          role="group"
          aria-label="Filter projects by technology"
        >
          {[ALL_FILTER, ...allTech].map((tech) => (
            <button
              key={tech}
              onClick={() => setActiveTech(tech)}
              className={glassCn(
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
                activeTech === tech
                  ? glassCn(glass.pillActive, "text-indigo-600 dark:text-indigo-300")
                  : glass.pill
              )}
            >
              {tech}
            </button>
          ))}
        </motion.div>

        {/* Grid */}
        <motion.div
          layout
          className="columns-1 gap-6 sm:columns-2 lg:columns-3"
        >
          <AnimatePresence mode="popLayout">
            {visible.map((project, i) => (
              <div key={project.id} className="mb-6 break-inside-avoid">
                <ProjectCard project={project} index={i} />
              </div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Empty state */}
        {visible.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 text-center text-sm text-gray-400 dark:text-slate-600"
          >
            No projects use{" "}
            <span className="text-indigo-400">{activeTech}</span> yet.
          </motion.p>
        )}
      </div>
    </section>
  );
}
