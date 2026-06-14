"use client";

/**
 * app/admin/page.tsx — Admin dashboard.
 *
 * Protected by the NextAuth middleware in middleware.ts (role === "admin" required).
 * Renders a dedicated admin shell with horizontal tabs + animated tab content.
 */

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import AdminTabNav, { type AdminTab } from "./_components/Sidebar";
import { AdminTopBar, AdminTabPanel } from "./_components/AdminShell";

const AllJobsTab = dynamic(() => import("./_components/AllJobsTab"), {
  loading: () => <TabLoader />,
});
const EditResumeTab = dynamic(() => import("./_components/EditResumeTab"), {
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
  const [activeTab, setActiveTab] = useState<AdminTab>("all-jobs");
  const [refreshing, setRefreshing] = useState(false);
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
      <div className="w-full flex-1 px-3 py-4 sm:px-4 lg:px-6">
        <AdminTopBar activeTab={activeTab} onRefresh={handleRefresh} refreshing={refreshing} />

        <AdminTabNav activeTab={activeTab} onSelect={setActiveTab} />

        <main className="min-w-0">
          <AdminTabPanel tabKey={activeTab}>
            {activeTab === "all-jobs" && <AllJobsTab />}
            {activeTab === "edit-resume" && <EditResumeTab />}
          </AdminTabPanel>
        </main>
      </div>
    </div>
  );
}
