import { NextResponse } from "next/server";
import { google } from "googleapis";

export const dynamic = "force-dynamic"; // never cache this route

const SHEET_NAME = "Jobs";

export interface Job {
  rowIndex: number;
  company: string;
  title: string;
  location: string;
  url: string;
  category: string;
  fetchedAt: string;
  description: string;
  resumeUrl?: string;
  coverLetter?: string;
  atsScore?: string;
  applyStatus?: string;
  appliedAt?: string;
  notes?: string;
}

export async function GET() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!sheetId || !serviceAccountJson) {
    return NextResponse.json(
      { jobs: [], error: "Google Sheets not configured" },
      { status: 503 }
    );
  }

  try {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A:M`,
    });

    const rows = response.data.values ?? [];
    // First row is headers — skip it
    const dataRows = rows.length > 1 ? rows.slice(1) : [];

    const jobs: Job[] = dataRows.map((row, idx) => ({
      rowIndex: idx + 2,
      company: row[0] ?? "",
      title: row[1] ?? "",
      location: row[2] ?? "",
      url: row[3] ?? "",
      category: row[4] ?? "",
      fetchedAt: row[5] ?? "",
      description: row[6] ?? "",
      resumeUrl: row[7] ?? "",
      coverLetter: row[8] ?? "",
      atsScore: row[9] ?? "",
      applyStatus: row[10] ?? "",
      appliedAt: row[11] ?? "",
      notes: row[12] ?? "",
    }));

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("[api/jobs] Failed to read Google Sheets:", error);
    return NextResponse.json(
      { jobs: [], error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}
