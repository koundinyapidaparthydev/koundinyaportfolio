import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SHEET_NAME = "Jobs";

export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sheetId = process.env.GOOGLE_SHEET_ID;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!sheetId || !serviceAccountJson) {
    return NextResponse.json({ error: "Sheets not configured" }, { status: 503 });
  }

  let body: { rowIndex?: number; applyStatus?: string; appliedAt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { rowIndex, applyStatus = "", appliedAt = "" } = body;
  if (!rowIndex || rowIndex < 2) {
    return NextResponse.json({ error: "rowIndex required" }, { status: 400 });
  }

  try {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `${SHEET_NAME}!K${rowIndex}`, values: [[applyStatus]] },
          { range: `${SHEET_NAME}!L${rowIndex}`, values: [[appliedAt]] },
        ],
      },
    });

    return NextResponse.json({ ok: true, rowIndex, applyStatus, appliedAt });
  } catch (error) {
    console.error("[api/jobs/apply-status]", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
