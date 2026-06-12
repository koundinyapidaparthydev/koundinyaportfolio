"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useTheme } from "next-themes";

type AdminTheme = "dark" | "light";

interface AdminThemeContextValue {
  theme: AdminTheme;
  toggle: () => void;
}

const AdminThemeContext = createContext<AdminThemeContextValue>({
  theme: "dark",
  toggle: () => {},
});

export function useAdminTheme() {
  return useContext(AdminThemeContext);
}

export default function AdminThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme: globalTheme, setTheme: setGlobalTheme } = useTheme();
  // Start in dark until hydration — avoids flash
  const [theme, setTheme] = useState<AdminTheme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("adminTheme") as AdminTheme | null;
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });
  const [mounted, setMounted] = useState(false);
  const hasMountedRef = useRef(false);

  // 1. On mount: read saved local preference, else fall back to global next-themes value
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("adminTheme") as AdminTheme | null;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      // Keep global in sync
      setGlobalTheme(saved);
    } else {
      // No local preference — use whatever next-themes resolved (respects OS pref)
      const resolved = globalTheme === "light" ? "light" : "dark";
      setTheme(resolved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // 2. If the global theme changes from OUTSIDE (e.g. navbar toggle),
  //    sync admin theme to match — but only after initial mount.
  useEffect(() => {
    if (!mounted) return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (globalTheme === "light" || globalTheme === "dark") {
      setTheme(globalTheme);
      localStorage.setItem("adminTheme", globalTheme);
    }
  }, [globalTheme, mounted]);

  // 3. Apply / remove dark class on <html>
  useEffect(() => {
    if (!mounted) return;
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme, mounted]);

  // 4. Toggle — updates local state, localStorage, and next-themes atomically
  const toggle = useCallback(() => {
    const next: AdminTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("adminTheme", next);
    setGlobalTheme(next);
  }, [theme, setGlobalTheme]);

  return (
    <AdminThemeContext.Provider value={{ theme, toggle }}>
      <div className={[theme === "dark" ? "dark" : "", "min-h-screen bg-background"].join(" ")}>
        {children}
      </div>
    </AdminThemeContext.Provider>
  );
}
