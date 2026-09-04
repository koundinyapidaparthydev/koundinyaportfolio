"use client";

/**
 * Skills.tsx — Clean editorial skill categories.
 *
 * Reads skill categories from the Zustand store.
 * Features:
 *  • Minimal filter tab row (all categories + "All")
 *  • Two-column grid of surface cards on desktop, single column on mobile
 *  • Each card shows an icon, category title, and subtle skill pills
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useSkills } from "@/lib/store";

const CATEGORY_ICONS: Record<string, string> = {
  Languages: "⚡",
  Frontend: "🎨",
  Backend: "⚙️",
  Databases: "🗄️",
  "Cloud & DevOps": "☁️",
  "AI & Automation": "🤖",
  Testing: "🧪",
  "Tools & Practices": "🛠️",
};

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
      className="relative py-24 px-6"
    >
      <div className="mx-auto max-w-5xl">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-10 text-center"
        >
          <h2 className="section-heading heading-gradient">
            Technical Skills
          </h2>
          <p className="section-subheading mx-auto">
            The tools, languages, and platforms I use most often.
          </p>
        </motion.div>

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="mb-10 flex flex-wrap justify-center gap-2"
          role="tablist"
          aria-label="Filter by skill category"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab)}
                className={[
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                    : "border border-slate-700/50 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-white",
                ].join(" ")}
              >
                {tab}
              </button>
            );
          })}
        </motion.div>

        {/* Category cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            {visibleCategories.map((category, i) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  delay: i * 0.05,
                  ease: "easeOut",
                }}
                className="surface p-5 transition-colors duration-200 hover:border-slate-700"
              >
                {/* Header */}
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-900/50 text-base"
                    role="img"
                    aria-label={category.title}
                  >
                    {CATEGORY_ICONS[category.title] ?? "🔧"}
                  </span>
                  <h3 className="text-sm font-semibold tracking-wide text-slate-200">
                    {category.title}
                  </h3>
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-2">
                  {category.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center rounded-full border border-slate-700/50 bg-slate-900/40 px-3 py-1 text-xs text-slate-300 transition-colors duration-200 hover:border-slate-500 hover:text-white"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
