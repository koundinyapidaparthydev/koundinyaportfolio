import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getVisitors } from "@/lib/visitorStore";

// GET /api/visitors — admin-only visitor log
export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visitors = await getVisitors();
  return NextResponse.json(visitors);
}
