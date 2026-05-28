"use client";

import { useStore } from "@/lib/store";

/**
 * useAdminGuard – returns true only when the current user is an admin.
 * Use this hook to conditionally render edit controls.
 */
export function useAdminGuard(): boolean {
  return useStore((s) => s.isAdmin);
}
