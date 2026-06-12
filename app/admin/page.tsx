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

  const fullBleed = activeTab === "edit-resume";

  return (
    <div
      className={[
        "relative flex min-h-screen flex-col",
        fullBleed ? "pt-20" : "pt-24",
      ].join(" ")}
    >
      <div
        className={[
          "mx-auto flex w-full flex-1 flex-col",
          fullBleed
            ? "max-w-none px-3 py-2 sm:px-4 lg:px-5"
            : "max-w-7xl px-4 py-6 sm:px-6 lg:px-8",
        ].join(" ")}
      >
        {!fullBleed && (
          <AdminTopBar activeTab={activeTab} onRefresh={handleRefresh} refreshing={refreshing} />
        )}

        {session?.user?.email && !fullBleed && (
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Signed in as{" "}
            <span className="text-slate-600 dark:text-slate-300">{session.user.email}</span>
          </p>
        )}

        <div
          className={[
            "flex flex-1 flex-col gap-6 lg:flex-row lg:gap-8",
            fullBleed && "min-h-0 gap-4 lg:gap-5",
          ].join(" ")}
        >
          <AdminSidebar activeTab={activeTab} onSelect={setActiveTab} />

          <main className={["min-w-0 flex-1", fullBleed && "flex min-h-0 flex-col"].join(" ")}>
            <AdminTabPanel
              tabKey={activeTab}
              className={fullBleed ? "flex min-h-0 flex-1 flex-col" : undefined}
            >
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
