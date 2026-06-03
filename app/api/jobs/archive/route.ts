import { NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const JOBS_SHEET = "Jobs";
const ARCHIVE_SHEET = "Old Jobs";
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export async function POST() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sheetId = process.env.GOOGLE_SHEET_ID;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!sheetId || !serviceAccountJson) {
    return NextResponse.json({ error: "Sheets not configured" }, { status: 503 });
  }

  try {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // 1. Read all rows from Jobs sheet
    const jobsResp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${JOBS_SHEET}!A:G`,
    });
    const rows = jobsResp.data.values ?? [];
    if (rows.length <= 1) {
      return NextResponse.json({ archived: 0, kept: 0 });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const now = Date.now();

    // 2. Split old (>2 days) vs recent
    const oldRows: string[][] = [];
    const keepRows: string[][] = [];
    for (const row of dataRows) {
      const fetchedAt = row[5] ?? "";
      const age = fetchedAt ? now - new Date(fetchedAt).getTime() : Infinity;
      if (age > TWO_DAYS_MS) {
        oldRows.push(row);
      } else {
        keepRows.push(row);
      }
    }

    if (oldRows.length === 0) {
      return NextResponse.json({ archived: 0, kept: keepRows.length });
    }

    // 3. Ensure "Old Jobs" sheet exists
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const existingSheets = (meta.data.sheets ?? []).map(
      (s) => s.properties?.title
    );
    if (!existingSheets.includes(ARCHIVE_SHEET)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: ARCHIVE_SHEET } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${ARCHIVE_SHEET}!A1:G1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }

    // 4. Append old rows to "Old Jobs"
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${ARCHIVE_SHEET}!A:G`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: oldRows },
    });

    // 5. Rewrite Jobs sheet with headers + recent rows only
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: `${JOBS_SHEET}!A:G`,
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${JOBS_SHEET}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers, ...keepRows] },
    });

    return NextResponse.json({ archived: oldRows.length, kept: keepRows.length });
  } catch (error) {
    console.error("[api/jobs/archive]", error);
    return NextResponse.json({ error: "Archive failed" }, { status: 500 });
  }
}
