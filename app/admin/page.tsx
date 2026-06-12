"use client";

/**
 * app/admin/page.tsx — Admin dashboard.
 *
 * Protected by the NextAuth middleware in middleware.ts (role === "admin" required).
 * Renders a dedicated admin shell with sidebar + animated tab content.
 */

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import AdminSidebar, { type AdminTab } from "./_components/Sidebar";
import { AdminTopBar, AdminTabPanel } from "./_components/AdminShell";

const OverviewTab = dynamic(() => import("./_components/OverviewTab"), {
  loading: () => <TabLoader />,
});
const EditResumeTab = dynamic(() => import("./_components/EditResumeTab"), {
  loading: () => <TabLoader />,
});
const VisitorsTab = dynamic(() => import("./_components/VisitorsTab"), {
  loading: () => <TabLoader />,
});
const SettingsTab = dynamic(() => import("./_components/SettingsTab"), {
  loading: () => <TabLoader />,
});
const AllJobsTab = dynamic(() => import("./_components/AllJobsTab"), {
  loading: () => <TabLoader />,
});

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return (
    <div className="relative flex min-h-screen flex-col pt-24">
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <AdminTopBar activeTab={activeTab} onRefresh={handleRefresh} refreshing={refreshing} />

        {session?.user?.email && (
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Signed in as <span className="text-slate-600 dark:text-slate-300">{session.user.email}</span>
          </p>
        )}

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <AdminSidebar activeTab={activeTab} onSelect={setActiveTab} />

          <main className="min-w-0 flex-1">
            <AdminTabPanel tabKey={activeTab}>
              {activeTab === "overview" && <OverviewTab />}
              {activeTab === "all-jobs" && <AllJobsTab />}
              {activeTab === "edit-resume" && <EditResumeTab />}
              {activeTab === "visitors" && <VisitorsTab />}
              {activeTab === "settings" && <SettingsTab />}
            </AdminTabPanel>
          </main>
        </div>
      </div>
    </div>
  );
}
