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



export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const { data: session } = useSession();

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 pt-24 pb-8 sm:px-6 lg:px-8">
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

