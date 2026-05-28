/**
 * POST /api/track
 *
 * Called by the client-side TrackerInit component when a visitor lands on the
 * site. Records visit metadata and fires a non-blocking email notification to
 * the portfolio owner.
 *
 * The response is always fast (< 10 ms) because email sending is fire-and-forget.
 */

import { type NextRequest, NextResponse } from "next/server";
import { sendVisitorNotification } from "@/lib/emailNotification";
import { appendVisitor } from "@/lib/visitorStore";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── Extract visitor IP ─────────────────────────────────────────────────
    const forwarded = req.headers.get("x-forwarded-for");
    const cfIp = req.headers.get("cf-connecting-ip");
    const realIp = req.headers.get("x-real-ip");

    const ip =
      (forwarded ? forwarded.split(",")[0].trim() : null) ??
      cfIp ??
      realIp ??
      "Unknown";

    // ── Geo headers (Cloudflare or Vercel Edge) ────────────────────────────
    const country =
      req.headers.get("cf-ipcountry") ??
      req.headers.get("x-vercel-ip-country") ??
      undefined;
    const city =
      req.headers.get("x-vercel-ip-city") ??
      undefined;

    // ── Other headers ──────────────────────────────────────────────────────
    const userAgent = req.headers.get("user-agent") ?? "";
    const headerLang = req.headers.get("accept-language")?.split(",")[0].trim();
    const timestamp = new Date().toISOString();

    // ── Parse optional body ────────────────────────────────────────────────
    let page = "/";
    let referrer: string | undefined;
    let language: string | undefined = headerLang;
    let screen: string | undefined;
    let timezone: string | undefined;

    try {
      const body = await req.json() as Record<string, unknown>;
      if (typeof body.page === "string") page = body.page;
      if (typeof body.referrer === "string") referrer = body.referrer;
      if (typeof body.language === "string") language = body.language;
      if (typeof body.screen === "string") screen = body.screen;
      if (typeof body.timezone === "string") timezone = body.timezone;
    } catch {
      // body is optional — no-op if absent or unparseable
    }

    // ── Persist to visitors.json (fire-and-forget) ─────────────────────────
    appendVisitor({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp,
      ip,
      userAgent,
      page,
      referrer,
      country,
      city,
      language,
      screen,
      timezone,
    }).catch((err: unknown) => {
      console.error("[POST /api/track] Failed to write visitor:", err);
    });

    // ── Fire-and-forget email ──────────────────────────────────────────────
    sendVisitorNotification({ ip, userAgent, timestamp }).catch((err: unknown) => {
      console.error("[POST /api/track] Email notification failed:", err);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/track] Unexpected error:", err);
    return NextResponse.json({ ok: false });
  }
}
