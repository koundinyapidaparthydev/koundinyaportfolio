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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("adminTheme") as AdminTheme | null;
    if (saved === "light" || saved === "dark") setTheme(saved);
    setMounted(true);
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("adminTheme", next);
      return next;
    });
  };

  // Avoid flash by not rendering until we know the saved preference
  if (!mounted) {
    return (
      <div className="dark min-h-[calc(100vh-4rem)] bg-[#080808]">
        {children}
      </div>
    );
  }

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
