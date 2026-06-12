import type { Metadata } from "next";
import AdminThemeProvider from "./_components/AdminThemeProvider";

export const metadata: Metadata = {
  title: "Admin — Koundinya Pidaparthy Portfolio",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminThemeProvider>
      <div className="aurora-0 relative min-h-screen">{children}</div>
    </AdminThemeProvider>
  );
}
