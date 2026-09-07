"use client";

import { usePathname } from "next/navigation";

function isAdminRoute(pathname: string | null) {
  return pathname?.startsWith("/admin") ?? false;
}

export function ConditionalNavbar() {
  return null;
}

export function ConditionalFooter() {
  const pathname = usePathname();
  if (isAdminRoute(pathname)) return null;

  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-6">
      <div className="mx-auto max-w-3xl text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} Koundinya Pidaparthy</p>
      </div>
    </footer>
  );
}

export function ConditionalScrollToTop() {
  return null;
}
