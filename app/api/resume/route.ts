import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { ResumeSchema } from "@/lib/schemas";
import { getResume, saveResume } from "@/lib/resumeStore";

// ─── GET /api/resume ──────────────────────────────────────────────────────────
// Public endpoint — returns the full resume JSON.

export async function GET() {
  try {
    const resume = await getResume();
    return NextResponse.json(resume, {
      headers: {
        // Allow browsers / CDNs to cache the public resume for 60 s
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[GET /api/resume]", err);
    return NextResponse.json(
      { error: "Failed to load resume data." },
      { status: 500 }
    );
  }
}

// ─── PUT /api/resume ──────────────────────────────────────────────────────────
// Admin-only endpoint — validates and persists the full resume JSON.

export async function PUT(req: NextRequest) {
  // Auth guard — must be an authenticated admin
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized. Admin access required." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  // Validate against the Zod schema
  const parsed = ResumeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        details: parsed.error.flatten(),
      },
      { status: 422 }
    );
  }

  try {
    await saveResume(parsed.data);
    return NextResponse.json({ success: true, data: parsed.data });
  } catch (err) {
    console.error("[PUT /api/resume]", err);
    return NextResponse.json(
      { error: "Failed to save resume data." },
      { status: 500 }
    );
  }
}
