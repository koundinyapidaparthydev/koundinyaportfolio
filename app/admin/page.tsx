"use client";

/**
 * app/admin/page.tsx — Admin dashboard.
 *
 * Protected by the NextAuth middleware in middleware.ts (role === "admin" required).
 * Renders a persistent sidebar + a tab content area.
 * Tabs: Overview · Edit Resume · Visitors · Settings
 */

import { useState } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import AdminSidebar, { type AdminTab } from "./_components/Sidebar";
import { useAdminTheme } from "./_components/AdminThemeProvider";

// Lazy-load the heavier tabs to keep initial JS small
const OverviewTab = dynamic(
  () => import("./_components/OverviewTab"),
  { loading: () => <TabLoader /> }
);
const EditResumeTab = dynamic(
  () => import("./_components/EditResumeTab"),
  { loading: () => <TabLoader /> }
);
const VisitorsTab = dynamic(
  () => import("./_components/VisitorsTab"),
  { loading: () => <TabLoader /> }
);
const SettingsTab = dynamic(
  () => import("./_components/SettingsTab"),
  { loading: () => <TabLoader /> }
);
const CompaniesTab = dynamic(
  () => import("./_components/CompaniesTab"),
  { loading: () => <TabLoader /> }
);

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  );
}

function ThemeToggleButton() {
  const { theme, toggle } = useAdminTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center gap-1.5 rounded-lg border border-white/10 dark:border-white/10 border-slate-200 bg-white/5 dark:bg-white/5 bg-white px-3 py-1.5 text-xs text-slate-400 dark:text-slate-400 hover:text-slate-200 dark:hover:text-slate-200 hover:text-slate-600 hover:bg-white/10 dark:hover:bg-white/10 transition-colors"
    >
      {theme === "dark" ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          Light
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          Dark
        </>
      )}
    </button>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const { data: session } = useSession();

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* ── Page header ── */}
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
            {session?.user && (
              <p className="mt-1 text-sm text-slate-500">
                Signed in as{" "}
                <span className="text-slate-400">{session.user.email}</span>
              </p>
            )}
          </div>
          <ThemeToggleButton />
        </header>

        {/* ── Two-column layout (sidebar + content) ── */}
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* Sidebar */}
          <AdminSidebar activeTab={activeTab} onSelect={setActiveTab} />

          {/* Tab content */}
          <main className="min-w-0 flex-1">
            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "edit-resume" && <EditResumeTab />}
            {activeTab === "visitors" && <VisitorsTab />}
            {activeTab === "settings" && <SettingsTab />}
            {activeTab === "companies" && <CompaniesTab />}
          </main>
        </div>
      </div>
    </div>
  );
}

