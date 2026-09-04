"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useProjects } from "@/lib/store";
import { TiltCard } from "@/components/TiltCard";
import type { Project } from "@/types/resume";

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

interface ProjectCardProps {
  project: Project;
  index: number;
}

function ProjectCard({ project, index }: ProjectCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const hasWebsite = Boolean(project.website);
  const keyPoints = project.points.slice(0, 3);

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: "easeOut" }}
      style={{ breakInside: "avoid" }}
    >
      <TiltCard className="surface group flex flex-col overflow-hidden p-6 transition-colors duration-300 hover:border-slate-700">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">{project.name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{project.date}</p>
          </div>
          {hasWebsite && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          )}
        </div>

        <p className="mb-4 text-sm text-slate-400">{project.description}</p>

        <div className="mb-4 flex flex-wrap gap-2">
          {project.stack.map((tech) => (
            <span
              key={tech}
              className="rounded-full border border-slate-700/60 bg-slate-900/60 px-2.5 py-0.5 text-[11px] font-medium text-slate-400"
            >
              {tech}
            </span>
          ))}
        </div>

        <ul className="mb-6 flex-1 space-y-2">
          {keyPoints.map((pt, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-400">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
              <span>{pt}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-slate-800/60 pt-4">
          {project.website && (
            <a
              href={project.website.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${project.name} live site`}
              className="btn-secondary px-3 py-1.5 text-xs"
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
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              <GitHubIcon className="h-3.5 w-3.5" />
              GitHub
            </a>
          )}
        </div>
      </TiltCard>
    </motion.div>
  );
}

const ALL_FILTER = "All";

export default function Projects() {
  const projects = useProjects();
  const sectionRef = useRef<HTMLElement>(null);
  const headingInView = useInView(sectionRef, { once: true, amount: 0.1 });

  const allTech = Array.from(new Set(projects.flatMap((p) => p.stack))).sort();
  const [activeTech, setActiveTech] = useState<string>(ALL_FILTER);

  const visible =
    activeTech === ALL_FILTER
      ? projects
      : projects.filter((p) => p.stack.includes(activeTech));

  return (
    <section ref={sectionRef} id="projects" className="relative py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={headingInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-12 text-center"
        >
          <h2 className="section-heading heading-gradient">Projects</h2>
          <p className="section-subheading mx-auto">
            AI-powered products built end-to-end — from architecture to production deployment.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={headingInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="mb-10 flex flex-wrap justify-center gap-2"
          role="group"
          aria-label="Filter projects by technology"
        >
          {[ALL_FILTER, ...allTech].map((tech) => {
            const active = activeTech === tech;
            return (
              <button
                key={tech}
                onClick={() => setActiveTech(tech)}
                className={[
                  "inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
                  active
                    ? "border border-indigo-500/40 bg-indigo-500/15 text-indigo-300"
                    : "border border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-500 hover:bg-slate-800/60 hover:text-white",
                ].join(" ")}
              >
                {tech}
              </button>
            );
          })}
        </motion.div>

        <motion.div layout className="columns-1 gap-6 sm:columns-2 lg:columns-3">
          <AnimatePresence mode="popLayout">
            {visible.map((project, i) => (
              <div key={project.id} className="mb-6 break-inside-avoid">
                <ProjectCard project={project} index={i} />
              </div>
            ))}
          </AnimatePresence>
        </motion.div>

        {visible.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 text-center text-sm text-slate-600"
          >
            No projects use <span className="text-indigo-400">{activeTech}</span> yet.
          </motion.p>
        )}
      </div>
    </section>
  );
}
