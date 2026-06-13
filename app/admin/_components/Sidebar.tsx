"use client";

import { glass, glassCn } from "@/lib/glass";

/**
 * AdminSidebar — vertical nav for the admin dashboard.
 *
 * Renders as a fixed left column on desktop and as a top scrollable bar on mobile.
 * Highlights the active tab and fires onSelect when a nav item is clicked.
 */

export type AdminTab = "edit-resume" | "all-jobs";

const NAV_ITEMS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "all-jobs",
    label: "Jobs",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
        <path d="M9 12h6" />
        <path d="M9 16h6" />
        <path d="M9 8h6" />
      </svg>
    ),
  },
  {
    id: "edit-resume",
    label: "Edit Resume",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
];

interface SidebarProps {
  activeTab: AdminTab;
  onSelect: (tab: AdminTab) => void;
}

export default function AdminSidebar({ activeTab, onSelect }: SidebarProps) {
  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className={glassCn(glass.adminPanel, "hidden w-56 shrink-0 flex-col gap-1 p-3 lg:flex")}>
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Dashboard
        </p>
        {NAV_ITEMS.map(({ id, label, icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={[
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                  : "text-slate-600 hover:bg-muted/50 dark:text-slate-400",
              ].join(" ")}
            >
              <span
                className={active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 transition-colors"}
              >
                {icon}
              </span>
              {label}
            </button>
          );
        })}

      </aside>

      {/* ── Mobile tab strip ── */}
      <nav className="flex gap-1 overflow-x-auto pb-1 lg:hidden">
        {NAV_ITEMS.map(({ id, label, icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={[
                "flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
                active
                  ? glassCn(glass.adminPillActive, "text-indigo-600 dark:text-indigo-300")
                  : glass.adminPill,
              ].join(" ")}
            >
              <span className={active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}>
                {icon}
              </span>
              {label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
