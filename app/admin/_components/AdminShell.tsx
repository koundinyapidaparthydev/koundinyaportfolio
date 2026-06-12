"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { glass, glassCn } from "@/lib/glass";
import { useAdminTheme } from "./AdminThemeProvider";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-50 dark:opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.18), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(139,92,246,0.1), transparent), radial-gradient(ellipse 50% 30% at 0% 80%, rgba(59,130,246,0.08), transparent)",
        }}
      />
      {children}
    </div>
  );
}

const TAB_TITLES: Record<string, string> = {
  overview: "Overview",
  "all-jobs": "Hiring Cafe Jobs",
  "edit-resume": "Edit Resume",
  visitors: "Visitors",
  settings: "Settings",
};

export function AdminTopBar({
  activeTab,
  onRefresh,
  refreshing,
}: {
  activeTab: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { theme, toggle } = useAdminTheme();
  const title = TAB_TITLES[activeTab] ?? "Admin";

  return (
    <header className="mb-6 flex items-center justify-between gap-4 border-b border-border/40 pb-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </p>
        <p className="truncate text-[10px] text-slate-500">Admin dashboard</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className={glassCn(glass.btn, "px-3 py-1.5 text-xs font-medium")}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
        <button
          type="button"
          onClick={toggle}
          className={glassCn(glass.btn, "px-3 py-1.5 text-xs font-medium")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </header>
  );
}

export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={glassCn(glass.adminPanel, "flex flex-wrap items-start justify-between gap-3 p-5")}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={glassCn(
        glass.adminPanel,
        "p-5 transition-colors",
        accent && "border-indigo-500/30 bg-indigo-500/10"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p
        className={[
          "mt-2 text-3xl font-bold",
          accent
            ? "text-indigo-600 dark:text-indigo-300"
            : "text-slate-900 dark:text-white",
        ].join(" ")}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function AdminSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      {title && (
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          {title}
        </p>
      )}
      {children}
    </section>
  );
}

export function AdminTabPanel({
  tabKey,
  children,
}: {
  tabKey: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      key={tabKey}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/** @deprecated Use AdminTabPanel */
export const AdminTabContent = AdminTabPanel;
