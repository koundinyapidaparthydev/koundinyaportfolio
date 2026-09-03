"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import type { Resume } from "@/types/resume";

/**
 * StoreHydrator — fetches /api/resume on mount and updates the Zustand store.
 * Renders nothing; drop it anywhere inside the provider tree.
 */
export function StoreHydrator() {
  const updateResume = useStore((s) => s.updateResume);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    if (process.env.NEXT_PUBLIC_GITHUB_PAGES === "1") return;

    fetch("/api/resume")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/resume returned ${res.status}`);
        return res.json() as Promise<Resume>;
      })
      .then((data) => {
        updateResume(data);
      })
      .catch((err) => {
        // Non-fatal — store keeps its initial seed data
        console.warn("[StoreHydrator] Could not hydrate from API:", err);
      });
  }, [updateResume]);

  return null;
}
