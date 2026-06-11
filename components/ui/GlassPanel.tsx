import * as React from "react";

import { glass, glassCn } from "@/lib/glass";

type GlassVariant = "panel" | "card" | "strong" | "nav" | "drawer" | "table";

const variantClass: Record<GlassVariant, string> = {
  panel: glass.panel,
  card: glass.card,
  strong: glass.strong,
  nav: glass.nav,
  drawer: glass.drawer,
  table: glass.table,
};

export interface GlassPanelProps extends React.ComponentProps<"div"> {
  variant?: GlassVariant;
  elevated?: boolean;
}

/**
 * Reusable frosted-glass surface. Prefer this over duplicating backdrop-blur classes.
 */
export function GlassPanel({
  variant = "panel",
  elevated = false,
  className,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <div
      data-slot="glass-panel"
      className={glassCn(
        variantClass[variant],
        elevated && glass.navElevated,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
