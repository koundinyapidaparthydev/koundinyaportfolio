import { type ClassValue } from "clsx";
import { cn } from "@/lib/utils";

/** Shared Apple liquid-glass utility class names. */
export const glass = {
  base: "glass",
  panel: "glass-panel",
  card: "glass-card",
  strong: "glass-strong",
  nav: "glass-nav",
  navElevated: "glass-nav-elevated",
  btn: "glass-btn",
  btnGhost: "glass-btn-ghost",
  btnPrimary: "glass-btn-primary",
  chip: "glass-chip",
  input: "glass-input",
  toggle: "glass-toggle",
  pill: "glass-pill",
  pillActive: "glass-pill-active",
  pillBadge: "glass-pill-badge",
  tab: "glass-tab",
  tabActive: "glass-tab-active",
  tabGroup: "glass-tab-group",
  footer: "glass-footer",
  drawer: "glass-drawer",
  table: "glass-table",
  tableHead: "glass-table-head",
} as const;

export function glassCn(...inputs: ClassValue[]) {
  return cn(...inputs);
}
