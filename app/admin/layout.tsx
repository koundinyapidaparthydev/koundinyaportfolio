import type { Metadata } from "next";

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
    // Always dark — admin dashboard is dark-only regardless of global theme toggle.
    // The `dark` class activates all dark: CSS variables for descendant components.
    <div className="dark min-h-[calc(100vh-4rem)] bg-[#080808]">{children}</div>
  );
}
