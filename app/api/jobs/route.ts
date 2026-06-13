import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { isHiringCafeJob } from "@/lib/admin/hiringCafeJobs";

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
  /** ATS position posted date (sheet column N). */
  postedAt: string;
  description: string;
  resumeUrl?: string;
  coverLetter?: string;
  atsScore?: string;
  applyStatus?: string;
  appliedAt?: string;
  notes?: string;
  atsMatchSummary?: string;
  keyGaps?: string;
  recommendedKeywords?: string;
  /** "yes" when resume was AI-tailored for this role. */
  resumeModified?: string;
  /** ATS score before tailoring (base resume). */
  preTailorAtsScore?: string;
}

export async function GET(req: NextRequest) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const includeLegacy = req.nextUrl.searchParams.get("includeLegacy") === "true";

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
      range: `${SHEET_NAME}!A:S`,
    });

    const rows = response.data.values ?? [];
    // First row is headers — skip it
    const dataRows = rows.length > 1 ? rows.slice(1) : [];

    const allJobs: Job[] = dataRows.map((row, idx) => ({
      rowIndex: idx + 2,
      company: row[0] ?? "",
      title: row[1] ?? "",
      location: row[2] ?? "",
      url: row[3] ?? "",
      category: row[4] ?? "",
      fetchedAt: row[5] ?? "",
      postedAt: row[13] ?? "",
      description: row[6] ?? "",
      resumeUrl: row[7] ?? "",
      coverLetter: row[8] ?? "",
      atsScore: row[9] ?? "",
      applyStatus: row[10] ?? "",
      appliedAt: row[11] ?? "",
      notes: row[12] ?? "",
      atsMatchSummary: row[14] ?? "",
      keyGaps: row[15] ?? "",
      recommendedKeywords: row[16] ?? "",
      resumeModified: row[17] ?? "",
      preTailorAtsScore: row[18] ?? "",
    }));

    const jobs = includeLegacy ? allJobs : allJobs.filter(isHiringCafeJob);

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("[api/jobs] Failed to read Google Sheets:", error);
    return NextResponse.json(
      { jobs: [], error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}
