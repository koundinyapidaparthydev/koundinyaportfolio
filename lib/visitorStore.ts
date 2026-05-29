/**
 * Server-side visitor data store.
 * Reads and writes data/visitors.json which the /api/track route appends to.
 *
 * IMPORTANT: Only import this in Route Handlers or Server Components.
 */

import { promises as fs } from "fs";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VisitorEntry {
  id: string;
  timestamp: string; // ISO-8601
  ip: string;
  userAgent: string;
  device: "Desktop" | "Mobile" | "Tablet";
  page: string;
  // ── Extended tracking fields ───────────────────────────────────────────────
  browser?: string;       // e.g. "Chrome 148", "Firefox 127", "Safari 17"
  os?: string;            // e.g. "Windows 11", "macOS", "iOS", "Android"
  referrer?: string;      // "direct" or referring URL hostname
  country?: string;       // ISO country code from Cloudflare/Vercel headers
  city?: string;          // City from Vercel geo headers
  language?: string;      // e.g. "en-US"
  screen?: string;        // e.g. "1920x1080"
  timezone?: string;      // e.g. "America/New_York"
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VISITORS_PATH = path.join(process.cwd(), "data", "visitors.json");
const MAX_ENTRIES = 500; // cap to prevent runaway file growth

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectDevice(ua: string): VisitorEntry["device"] {
  if (/tablet|ipad/i.test(ua)) return "Tablet";
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) return "Mobile";
  return "Desktop";
}

/**
 * Parse the primary browser name + major version from a User-Agent string.
 * Returns "Other" for bots, curl, or unrecognised agents.
 */
export function detectBrowser(ua: string): string {
  // Ordered: Edge must come before Chrome (Edge UA includes "Chrome")
  const rules: [RegExp, string][] = [
    [/Edg\/(\d+)/i, "Edge"],
    [/OPR\/(\d+)/i, "Opera"],
    [/Chrome\/(\d+)/i, "Chrome"],
    [/Firefox\/(\d+)/i, "Firefox"],
    [/Version\/(\d+).*Safari/i, "Safari"],
    [/MSIE (\d+)/i, "IE"],
    [/Trident\/.*rv:(\d+)/i, "IE"],
    [/(Googlebot|bingbot|DuckDuckBot|Baiduspider|YandexBot)/i, "Bot"],
  ];
  for (const [re, name] of rules) {
    const m = ua.match(re);
    if (m) return m[1] ? `${name} ${m[1]}` : name;
  }
  return "Other";
}

/**
 * Parse the operating system from a User-Agent string.
 */
export function detectOS(ua: string): string {
  if (/Windows NT 10\.0/i.test(ua)) return "Windows 10/11";
  if (/Windows NT 6\.3/i.test(ua)) return "Windows 8.1";
  if (/Windows NT 6\.1/i.test(ua)) return "Windows 7";
  if (/Windows/i.test(ua)) return "Windows";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Linux/i.test(ua)) return "Linux";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  return "Other";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Prepend a new visitor entry to visitors.json.
 * Uses atomic write (tmp → rename) to prevent partial-write corruption.
 */
export async function appendVisitor(
  data: Omit<VisitorEntry, "device" | "browser" | "os">
): Promise<void> {
  const entry: VisitorEntry = {
    ...data,
    device: detectDevice(data.userAgent),
    browser: detectBrowser(data.userAgent),
    os: detectOS(data.userAgent),
  };

  const existing = await getVisitors();
  existing.unshift(entry);
  if (existing.length > MAX_ENTRIES) existing.splice(MAX_ENTRIES);

  try {
    const tmp = `${VISITORS_PATH}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(existing, null, 2), "utf-8");
    await fs.rename(tmp, VISITORS_PATH);
  } catch (err) {
    // Vercel and other read-only filesystems cannot write to project files.
    // Log the entry and continue — the site should never crash due to tracking.
    console.warn("[visitorStore] write skipped (read-only fs):", (err as Error).message);
  }
}

/**
 * Read all visitor entries from visitors.json (newest first).
 * Returns [] if the file doesn't exist or contains invalid JSON.
 */
export async function getVisitors(): Promise<VisitorEntry[]> {
  try {
    const raw = await fs.readFile(VISITORS_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VisitorEntry[]) : [];
  } catch {
    return [];
  }
}
