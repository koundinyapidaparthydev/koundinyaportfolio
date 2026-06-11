"use client";

/**
 * Skills.tsx — Filterable skill badge grid with Framer Motion stagger.
 *
 * Reads skill categories from the Zustand store.
 * Features:
 *  • Filter tab row at top (all categories + "All")
 *  • Each skill is a pill badge
 *  • On hover a tooltip shows with a proficiency bar
 *  • Badges stagger in when the section enters viewport (useInView)
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useSkills } from "@/lib/store";
import { TiltCard } from "@/components/TiltCard";
import { glass, glassCn } from "@/lib/glass";

// ─── Proficiency map ──────────────────────────────────────────────────────────
// Approximate proficiency (0–100) per skill name.
// Skills not listed here default to 70.

const PROFICIENCY: Record<string, number> = {
  // Languages
  "JavaScript (ES2022+)": 95,
  TypeScript: 92,
  Python: 78,
  Java: 70,
  HTML5: 95,
  CSS3: 90,
  SQL: 82,
  GraphQL: 80,
  // Frontend
  React: 95,
  "Next.js": 92,
  "React Native": 70,
  Redux: 85,
  Zustand: 90,
  "Framer Motion": 85,
  "Tailwind CSS": 92,
  "Material UI": 82,
  "shadcn/ui": 88,
  Storybook: 75,
  Webpack: 72,
  Vite: 78,
  // Backend
  "Node.js": 88,
  "Express.js": 85,
  "GraphQL (Apollo Server)": 80,
  "REST APIs": 92,
  WebSockets: 80,
  "NextAuth.js": 85,
  Prisma: 72,
  Redis: 78,
  // Databases
  MongoDB: 85,
  PostgreSQL: 80,
  DynamoDB: 78,
  MySQL: 75,
  "Firebase Firestore": 72,
  BigTable: 65,
  // Cloud & DevOps
  "GitHub Actions": 85,
  Docker: 80,
  Terraform: 68,
  Vercel: 90,
  Netlify: 85,
  "CI/CD Pipelines": 82,
  // Testing
  Jest: 88,
  "React Testing Library": 85,
  Cypress: 80,
  Vitest: 75,
  Playwright: 72,
};

function proficiency(skill: string): number {
  // Strip parenthetical suffixes for lookup ("JavaScript (ES2022+)" → still matched)
  return PROFICIENCY[skill] ?? 70;
}

// ─── Category color map ───────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Languages:          "bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30 dark:hover:bg-violet-500/25",
  Frontend:           "bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30 dark:hover:bg-sky-500/25",
  Backend:            "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 dark:hover:bg-emerald-500/25",
  Databases:          "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 dark:hover:bg-amber-500/25",
  "Cloud & DevOps":   "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30 dark:hover:bg-orange-500/25",
  "AI & Automation": "bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/30 dark:hover:bg-pink-500/25",
  Testing:            "bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30 dark:hover:bg-teal-500/25",
  "Tools & Practices": "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30 dark:hover:bg-slate-500/25",
};

const DEFAULT_COLOR =
  "bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30 dark:hover:bg-indigo-500/25";

function categoryColor(title: string) {
  return CATEGORY_COLORS[title] ?? DEFAULT_COLOR;
}

// Profile-bar fill color per category
const BAR_COLORS: Record<string, string> = {
  Languages: "bg-violet-400",
  Frontend: "bg-sky-400",
  Backend: "bg-emerald-400",
  Databases: "bg-amber-400",
  "Cloud & DevOps": "bg-orange-400",
  "AI & Automation": "bg-pink-400",
  Testing: "bg-teal-400",
  "Tools & Practices": "bg-slate-400",
};

const DEFAULT_BAR_COLOR = "bg-indigo-400";

// ─── Bento config ────────────────────────────────────────────────────────────

const BENTO_SPANS: Record<string, string> = {
  Languages:          "col-span-2 lg:col-span-2",
  Frontend:           "col-span-2 lg:col-span-2",
  Backend:            "col-span-2 lg:col-span-2",
  Databases:          "col-span-1",
  "Cloud & DevOps":   "col-span-1",
  "AI & Automation":  "col-span-2 lg:col-span-2",
  Testing:            "col-span-1",
  "Tools & Practices":"col-span-1",
};

const CATEGORY_ICONS: Record<string, string> = {
  Languages:          "⚡",
  Frontend:           "🎨",
  Backend:            "⚙️",
  Databases:          "🗄️",
  "Cloud & DevOps":   "☁️",
  "AI & Automation":  "🤖",
  Testing:            "🧪",
  "Tools & Practices":"🛠️",
};

// ─── SkillBadge ───────────────────────────────────────────────────────────────

interface SkillBadgeProps {
  skill: string;
  categoryTitle: string;
  index: number;
}

function SkillBadge({ skill, categoryTitle, index }: SkillBadgeProps) {
  const [hovered, setHovered] = useState(false);
  const pct = proficiency(skill);
  const barColor = BAR_COLORS[categoryTitle] ?? DEFAULT_BAR_COLOR;

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: "easeOut" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <span
        tabIndex={0}
        className={[
          "inline-flex cursor-default select-none items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
          categoryColor(categoryTitle),
        ].join(" ")}
      >
        {skill}
      </span>

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="glass-strong absolute bottom-full left-1/2 z-20 mb-2 w-36 -translate-x-1/2 p-3"
            role="tooltip"
          >
            <p className="mb-2 text-center text-[11px] font-semibold text-white">
              {skill}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={["h-full rounded-full", barColor].join(" ")}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <p className="mt-1 text-right text-[10px] text-slate-400">{pct}%</p>
            {/* Arrow */}
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── BentoCell ───────────────────────────────────────────────────────────────

interface BentoCellProps {
  category: { id: string; title: string; skills: string[] };
  colSpan?: string;
  index: number;
}

function BentoCell({ category, colSpan, index }: BentoCellProps) {
  const icon = CATEGORY_ICONS[category.title] ?? "🔧";
  const badgeColor = CATEGORY_COLORS[category.title] ?? DEFAULT_COLOR;
  const span = colSpan ?? BENTO_SPANS[category.title] ?? "col-span-1";

  return (
    <TiltCard className={span} maxTilt={4}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
        className="glass-card h-full p-5 hover:border-indigo-300/40 dark:hover:border-indigo-400/30"
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl" role="img" aria-label={category.title}>
              {icon}
            </span>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
              {category.title}
            </h3>
          </div>
          <span className={["rounded-full border px-2 py-0.5 text-[10px] font-bold", badgeColor].join(" ")}>
            {category.skills.length}
          </span>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-2">
          {category.skills.map((skill, i) => (
            <SkillBadge
              key={skill}
              skill={skill}
              categoryTitle={category.title}
              index={index * 12 + i}
            />
          ))}
        </div>
      </motion.div>
    </TiltCard>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const ALL_TAB = "All";

export default function Skills() {
  const skills = useSkills();
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.1 });

  const categories = skills.map((c) => c.title);
  const tabs = [ALL_TAB, ...categories];

  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);

  const visibleCategories =
    activeTab === ALL_TAB
      ? skills
      : skills.filter((c) => c.title === activeTab);

  return (
    <section
      ref={sectionRef}
      id="skills"
      className="aurora-10 relative bg-slate-50 py-24 px-6"
    >
      {/* Top aurora radial glow — dark mode only */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-40 dark:opacity-100"
        style={{
          background:
            "radial-gradient(ellipse at 50% -10%, rgba(139,92,246,0.18) 0%, transparent 65%)",
        }}
      />
      <div className="mx-auto max-w-6xl">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Technical Skills
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-indigo-500" />
        </motion.div>

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
          className="mb-10 flex flex-wrap justify-center gap-2"
          role="tablist"
          aria-label="Filter by skill category"
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={glassCn(
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
                activeTab === tab
                  ? glassCn(glass.pillActive, "text-indigo-600 dark:text-indigo-300")
                  : glass.pill
              )}
            >
              {tab}
            </button>
          ))}
        </motion.div>

        {/* Bento grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {visibleCategories.map((category, i) => (
              <BentoCell
                key={category.id}
                category={category}
                index={i}
                colSpan={
                  activeTab !== ALL_TAB
                    ? "col-span-2 lg:col-span-4"
                    : undefined
                }
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
