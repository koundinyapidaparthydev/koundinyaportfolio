"use client";

/**
 * ThemeToggle — Apple glass orb that switches next-themes theme.
 */

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { glass } from "@/lib/glass";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className={cn(glass.toggle, "opacity-0", className)}
        aria-hidden="true"
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        glass.toggle,
        "text-slate-600 dark:text-slate-300",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/40 via-transparent to-transparent dark:from-white/10"
      />
      <span className="relative transition-transform duration-300">
        {isDark ? (
          <Sun className="h-4 w-4 text-amber-400 drop-shadow-sm" />
        ) : (
          <Moon className="h-4 w-4 text-indigo-500 drop-shadow-sm" />
        )}
      </span>
    </button>
  );
}
