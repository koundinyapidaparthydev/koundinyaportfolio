"use client";

import { createContext, useContext, useEffect, useState } from "react";

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
  const [theme, setTheme] = useState<AdminTheme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("adminTheme") as AdminTheme | null;
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("adminTheme", next);
      return next;
    });
  };

  // Always render the same tree structure — no conditional wrapping that would
  // cause React to unmount/remount children and reset in-flight queries.
  return (
    <AdminThemeContext.Provider value={{ theme, toggle }}>
      <div
        className={[
          theme === "dark" ? "dark" : "",
          "min-h-[calc(100vh-4rem)]",
          theme === "dark" ? "bg-[#080808]" : "bg-slate-50",
        ].join(" ")}
      >
        {children}
      </div>
    </AdminThemeContext.Provider>
  );
}
